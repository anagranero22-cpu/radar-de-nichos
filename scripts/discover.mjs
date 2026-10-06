// Busca de lacunas: para cada tema configurado em docs/data/channels.json
// (campo "discovery"), procura os vídeos mais vistos publicados nos últimos
// N dias, mede demanda, espaço para canais pequenos e vídeos virais, e grava
// docs/data/gaps.json com o resultado do dia e o histórico do score por tema.
//
// Custo: 100 unidades por busca (search.list) + 1 a cada 50 vídeos e 1 a cada
// 50 canais. Temas já buscados hoje são pulados, então rodar de novo no mesmo
// dia (ao salvar o catálogo, "Coletar agora") só busca temas novos.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseDuration } from '../docs/js/refs.js';
import { normLang } from '../docs/js/language.js';
import {
  discoveryConfig,
  pickThemes,
  themeKey,
  analyzeVideo,
  themeMetrics,
  languageGap,
  gapScore,
  themeNiche,
} from '../docs/js/gaps.js';
import { api, chunk, readJson, QuotaError, KEY } from './youtube.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANNELS_FILE = path.join(ROOT, 'docs/data/channels.json');
const GAPS_FILE = path.join(ROOT, 'docs/data/gaps.json');
const KEEP_VIDEOS = 12;
const KEEP_HISTORY = 90;
const STALE_DAYS = 30;

async function search(q, lang, days) {
  const after = new Date(Date.now() - days * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  const r = await api('search', {
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    publishedAfter: after,
    maxResults: '50',
    q,
    relevanceLanguage: lang,
  });
  return (r.items ?? []).map((it) => it.id?.videoId).filter(Boolean);
}

// Views, duração, idioma e canal de cada vídeo; inscritos e idade de cada canal.
async function hydrate(videoIds, channelCache) {
  const videos = [];
  for (const batch of chunk([...new Set(videoIds)], 50)) {
    const r = await api('videos', { part: 'snippet,statistics,contentDetails', id: batch.join(','), maxResults: '50' });
    for (const it of r.items ?? []) {
      videos.push({
        id: it.id,
        t: it.snippet?.title ?? '',
        p: it.snippet?.publishedAt ?? null,
        v: Number(it.statistics?.viewCount ?? 0),
        s: parseDuration(it.contentDetails?.duration),
        l: normLang(it.snippet?.defaultAudioLanguage ?? it.snippet?.defaultLanguage),
        ch: it.snippet?.channelId,
        chT: it.snippet?.channelTitle ?? '',
      });
    }
  }
  const missing = [...new Set(videos.map((v) => v.ch))].filter((id) => id && !channelCache.has(id));
  for (const batch of chunk(missing, 50)) {
    const r = await api('channels', { part: 'snippet,statistics', id: batch.join(','), maxResults: '50' });
    for (const it of r.items ?? []) {
      const s = it.statistics ?? {};
      channelCache.set(it.id, {
        subs: s.hiddenSubscriberCount ? null : Number(s.subscriberCount ?? 0),
        chAt: it.snippet?.publishedAt ?? null,
        vids: Number(s.videoCount ?? 0),
        thumb: (it.snippet?.thumbnails?.default ?? it.snippet?.thumbnails?.medium)?.url ?? null,
      });
    }
  }
  return videos.map((v) => ({ ...v, ...(channelCache.get(v.ch) ?? { subs: null, chAt: null }) }));
}

async function measure(q, lang, cfg, channelCache) {
  const ids = await search(q, lang, cfg.days);
  const raw = await hydrate(ids, channelCache);
  // Descarta vídeos com áudio declarado em outro idioma (a busca às vezes mistura).
  const videos = raw.filter((v) => !v.l || v.l === lang).map((v) => analyzeVideo(v, cfg));
  return { videos, m: themeMetrics(videos) };
}

const slim = (v) => ({
  id: v.id,
  t: v.t,
  d: v.p?.slice(0, 10) ?? null,
  v: v.v,
  s: v.s,
  ch: v.ch,
  chT: v.chT,
  chThumb: v.thumb ?? null,
  subs: v.subs,
  chAge: v.chAgeDays != null ? Math.round(v.chAgeDays) : null,
  vids: v.vids ?? null,
  r: v.ratio != null ? Math.round(v.ratio * 10) / 10 : null,
});

async function main() {
  if (!KEY) {
    console.warn('YOUTUBE_API_KEY não configurada — busca de lacunas ignorada.');
    return;
  }
  const catalog = await readJson(CHANNELS_FILE, { channels: [] });
  const gaps = await readJson(GAPS_FILE, {});
  gaps.themes ??= {};
  gaps.errors = {};
  const cfg = discoveryConfig(catalog);
  const today = new Date().toISOString().slice(0, 10);
  const focus = cfg.focus ? { group: cfg.focus, share: Number(cfg.focusShare) || 0.8 } : null;
  const todo = pickThemes(cfg.queries, gaps.themes, cfg.maxSearches, today, focus);
  console.log(`Lacunas: ${todo.length} de ${cfg.queries.length} tema(s) para buscar hoje${focus ? ` (foco: ${focus.group})` : ''}.`);

  const channelCache = new Map();
  let done = 0;
  try {
    for (const t of todo) {
      const key = themeKey(t.q, t.lang);
      try {
        const main = await measure(t.q, t.lang, cfg, channelCache);
        const local = t.local ? await measure(t.local, t.localLang ?? cfg.homeLang, cfg, channelCache) : null;
        const { niche, tier } = themeNiche(t.q, main.videos);
        const langGap = local ? languageGap(main.m, local.m, cfg) : null;
        const { score, parts, bonus } = gapScore(main.m, tier, langGap);
        const prev = gaps.themes[key] ?? {};
        const history = (prev.history ?? []).filter((h) => h[0] !== today);
        history.push([today, score, Math.round(main.m.medianViews), main.m.outliers]);
        const pickVideos = (list) =>
          list
            .filter((v) => v.v >= cfg.minViews || v.outlier)
            .sort((a, b) => (b.outlier - a.outlier) || (b.ratio ?? 0) - (a.ratio ?? 0) || b.v - a.v)
            .slice(0, KEEP_VIDEOS)
            .map(slim);
        gaps.themes[key] = {
          q: t.q,
          lang: t.lang,
          local: t.local ?? null,
          localLang: t.local ? (t.localLang ?? cfg.homeLang) : null,
          lastRun: today,
          niche,
          tier,
          score,
          parts,
          bonus,
          m: main.m,
          localM: local?.m ?? null,
          langGap,
          videos: pickVideos(main.videos),
          localVideos: local ? pickVideos(local.videos).slice(0, 6) : [],
          history: history.slice(-KEEP_HISTORY),
        };
        done++;
        console.log(`  ${score.toString().padStart(3)}  ${t.q} [${t.lang}]`);
      } catch (err) {
        if (err instanceof QuotaError) throw err;
        gaps.errors[key] = err.message;
        console.warn(`  ⚠ ${t.q}: ${err.message}`);
      }
    }
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    console.log(`::warning::${err.message} ${done} tema(s) gravados; o restante entra amanhã.`);
  }

  // Temas removidos da configuração somem depois de 30 dias sem busca.
  const active = new Set(cfg.queries.map((t) => themeKey(t.q, t.lang)));
  for (const [key, th] of Object.entries(gaps.themes)) {
    const idle = (Date.parse(today) - Date.parse(th.lastRun ?? today)) / 86400000;
    if (!active.has(key) && idle > STALE_DAYS) delete gaps.themes[key];
  }

  if (!done && gaps.updatedAt) {
    console.log('Nenhum tema novo para buscar hoje.');
    return;
  }
  gaps.updatedAt = new Date().toISOString();
  gaps.config = { days: cfg.days, maxSubs: cfg.maxSubs, minViews: cfg.minViews, homeLang: cfg.homeLang };
  await writeFile(GAPS_FILE, `${JSON.stringify(gaps)}\n`);
  console.log(`Pronto: ${done} tema(s) atualizados.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
