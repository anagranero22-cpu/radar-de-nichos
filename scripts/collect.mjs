// Coleta diária: lê docs/data/channels.json (catálogo editado pelo usuário),
// consulta a YouTube Data API v3 e grava em docs/data/stats.json os metadados
// e uma linha de histórico por canal por dia:
//   [data, inscritos, viewsTotais, numeroDeVideos, dataDoUltimoUpload]
// Rodar de novo no mesmo dia substitui a linha do dia (não duplica).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseRef, parseDuration } from '../docs/js/refs.js';
import { normLang, detectLanguage } from '../docs/js/language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANNELS_FILE = path.join(ROOT, 'docs/data/channels.json');
const STATS_FILE = path.join(ROOT, 'docs/data/stats.json');
const API = 'https://www.googleapis.com/youtube/v3';
const KEY = process.env.YOUTUBE_API_KEY;

class QuotaError extends Error {}

async function api(endpoint, params) {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new QuotaError('Cota diária da YouTube API esgotada.');
    }
    if (res.status === 404) return { items: [], notFound: true };
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`YouTube API ${endpoint} respondeu ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
}

async function resolveRef(ref) {
  const parsed = parseRef(ref);
  switch (parsed.type) {
    case 'id':
      return parsed.value;
    case 'handle': {
      const r = await api('channels', { part: 'id', forHandle: parsed.value });
      return r.items?.[0]?.id ?? null;
    }
    case 'username': {
      const r = await api('channels', { part: 'id', forUsername: parsed.value });
      if (r.items?.[0]?.id) return r.items[0].id;
      const h = await api('channels', { part: 'id', forHandle: `@${parsed.value}` });
      return h.items?.[0]?.id ?? null;
    }
    case 'video': {
      const r = await api('videos', { part: 'snippet', id: parsed.value });
      return r.items?.[0]?.snippet?.channelId ?? null;
    }
    case 'search': {
      // search.list custa 100 unidades de cota; só é usado na primeira resolução.
      const r = await api('search', { part: 'snippet', type: 'channel', maxResults: '1', q: parsed.value });
      return r.items?.[0]?.snippet?.channelId ?? null;
    }
    default:
      return null;
  }
}

const RECENT_VIDEOS = 8;

// Últimos vídeos do canal (playlist de uploads): 1 unidade de cota por canal.
async function recentUploads(uploadsPlaylistId) {
  if (!uploadsPlaylistId) return [];
  const r = await api('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(RECENT_VIDEOS),
  });
  return (r.items ?? [])
    .filter((it) => it.contentDetails?.videoPublishedAt)
    .map((it) => ({
      id: it.contentDetails.videoId,
      t: it.snippet?.title ?? '',
      d: it.contentDetails.videoPublishedAt.slice(0, 10),
    }))
    .sort((a, b) => (a.d < b.d ? 1 : -1));
}

// Views, duração e idioma do áudio dos vídeos em lotes de 50 (1 unidade por lote).
async function fillVideoStats(videos) {
  const byId = new Map(videos.map((v) => [v.id, v]));
  for (const batch of chunk([...byId.keys()], 50)) {
    const r = await api('videos', { part: 'snippet,statistics,contentDetails', id: batch.join(','), maxResults: '50' });
    for (const item of r.items ?? []) {
      const v = byId.get(item.id);
      v.v = Number(item.statistics?.viewCount ?? 0);
      v.s = parseDuration(item.contentDetails?.duration);
      const l = normLang(item.snippet?.defaultAudioLanguage ?? item.snippet?.defaultLanguage);
      if (l) v.l = l;
      if (item.snippet?.categoryId) v.c = item.snippet.categoryId;
    }
  }
}

function bestThumb(thumbnails = {}) {
  return (thumbnails.medium ?? thumbnails.default ?? thumbnails.high)?.url ?? null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function main() {
  if (!KEY) {
    console.warn('YOUTUBE_API_KEY não configurada — coleta ignorada. Veja o README para configurar o secret.');
    return;
  }

  const catalog = await readJson(CHANNELS_FILE, { channels: [] });
  const stats = await readJson(STATS_FILE, {});
  stats.resolve ??= {};
  stats.channels ??= {};
  stats.history ??= {};
  stats.errors = {};

  const today = new Date().toISOString().slice(0, 10);
  const refs = [...new Set(catalog.channels.map((c) => c.ref).filter(Boolean))];

  try {
    await collectInto(stats, refs, today);
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    // Grava o que já foi coletado; o restante entra na próxima execução.
    console.log(`::warning::${err.message} Dados parciais gravados.`);
  }

  stats.updatedAt = new Date().toISOString();
  await writeFile(STATS_FILE, `${JSON.stringify(stats)}\n`);
  const errorCount = Object.keys(stats.errors).length;
  console.log(`Pronto: dados de ${today} gravados${errorCount ? `, ${errorCount} canal(is) com erro` : ''}.`);
  for (const [ref, msg] of Object.entries(stats.errors)) console.log(`  ⚠ ${ref}: ${msg}`);
}

async function collectInto(stats, refs, today) {
  // 1. Resolver referências novas (as já resolvidas ficam em cache em stats.resolve).
  for (const ref of refs) {
    if (stats.resolve[ref]) continue;
    try {
      const id = await resolveRef(ref);
      if (id) stats.resolve[ref] = id;
      else stats.errors[ref] = 'Canal não encontrado. Confira o @handle ou cole a URL do canal.';
    } catch (err) {
      if (err instanceof QuotaError) throw err;
      stats.errors[ref] = err.message;
    }
  }

  const ids = [...new Set(refs.map((r) => stats.resolve[r]).filter(Boolean))];
  console.log(`Coletando ${ids.length} canais (${refs.length} no catálogo)…`);

  // 2. Estatísticas em lotes de 50 (1 unidade de cota por lote).
  const found = new Set();
  const fresh = [];
  const declared = new Map();
  for (const batch of chunk(ids, 50)) {
    const r = await api('channels', {
      part: 'snippet,statistics,contentDetails,brandingSettings,topicDetails',
      id: batch.join(','),
      maxResults: '50',
    });
    for (const item of r.items ?? []) {
      found.add(item.id);
      const s = item.statistics ?? {};
      const uploads = item.contentDetails?.relatedPlaylists?.uploads ?? null;
      let recent = null;
      try {
        recent = await recentUploads(uploads);
      } catch (err) {
        if (err instanceof QuotaError) throw err;
        console.warn(`Últimos vídeos de ${item.id}: ${err.message}`);
      }
      const prev = stats.channels[item.id] ?? {};
      const lastUpload = recent ? (recent[0]?.d ?? null) : (prev.lastUpload ?? null);
      stats.channels[item.id] = {
        title: item.snippet?.title ?? '',
        handle: item.snippet?.customUrl ?? null,
        thumbnail: bestThumb(item.snippet?.thumbnails),
        banner: item.brandingSettings?.image?.bannerExternalUrl ?? null,
        description: (item.snippet?.description ?? '').slice(0, 600),
        // Tópicos que o YouTube atribui ao canal (slug da Wikipédia), usados na detecção de nicho.
        topics: (item.topicDetails?.topicCategories ?? []).map((u) => decodeURIComponent(u.split('/').pop())),
        country: item.snippet?.country ?? null,
        publishedAt: item.snippet?.publishedAt?.slice(0, 10) ?? null,
        hiddenSubscribers: Boolean(s.hiddenSubscriberCount),
        lastUpload,
        // [{ id, t: título, d: data, v: views, s: duração em segundos, l: idioma do áudio, c: categoria }], mais recente primeiro
        recent: recent ?? prev.recent ?? [],
      };
      if (recent) fresh.push(...recent);
      declared.set(item.id, item.snippet?.defaultLanguage ?? item.brandingSettings?.channel?.defaultLanguage ?? null);
      const row = [
        today,
        s.hiddenSubscriberCount ? null : Number(s.subscriberCount ?? 0),
        Number(s.viewCount ?? 0),
        Number(s.videoCount ?? 0),
        lastUpload,
      ];
      const hist = (stats.history[item.id] ??= []);
      if (hist.length && hist[hist.length - 1][0] === today) hist[hist.length - 1] = row;
      else hist.push(row);
    }
  }

  // 3. Views e duração dos vídeos recentes.
  try {
    await fillVideoStats(fresh);
  } catch (err) {
    if (err instanceof QuotaError) throw err;
    console.warn(`Estatísticas dos vídeos: ${err.message}`);
  }

  // 4. Idioma do canal (áudio dos vídeos recentes > idioma declarado > país).
  for (const id of found) {
    const c = stats.channels[id];
    const { language, source } = detectLanguage({
      videoLanguages: c.recent.map((v) => v.l),
      declared: declared.get(id),
      country: c.country,
    });
    c.language = language;
    c.languageSource = source;
  }

  for (const ref of refs) {
    const id = stats.resolve[ref];
    if (id && !found.has(id)) stats.errors[ref] = 'Canal não retornou dados (removido, encerrado ou privado).';
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
