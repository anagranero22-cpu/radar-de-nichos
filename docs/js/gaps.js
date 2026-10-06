// Lacunas (sem DOM): a partir de buscas por tema no YouTube, mede se há
// demanda (views altas em vídeos recentes), espaço para canais pequenos
// (eles aparecem entre os mais vistos) e sinais de viralização (vídeos que
// passaram muito do número de inscritos do canal, canais novos explodindo).
// Usado pela coleta (scripts/discover.mjs) e pela aba Lacunas do site.

import { median } from './metrics.js';
import { normalize, classifyNiche } from './niche.js';
import { suggestTier } from './insights.js';

export const SHORTS_MAX = 180;
export const NEW_CHANNEL_DAYS = 180;
export const OUTLIER_RATIO = 3;
const TOP_N = 20;

// Temas iniciais, focados em canais gringos. "local" = a mesma busca em outro
// idioma ("localLang"), para medir a lacuna de idioma: o tema rende num
// mercado e quase não existe no outro (arbitragem entre idiomas).
export const DEFAULT_QUERIES = [
  { group: 'Cotidiano explicado', q: 'the real reason why', lang: 'en', local: 'nicht aus dem Grund, den du denkst', localLang: 'de' },
  { group: 'Cotidiano explicado', q: 'la vraie raison', lang: 'fr' },
  { group: 'Cotidiano explicado', q: 'hidden features everyday objects', lang: 'en' },
  { group: 'Cotidiano explicado', q: 'what really happens to your body', lang: 'en' },
  { group: 'Mistério & história', q: 'unsolved mysteries', lang: 'en', local: 'mystères non résolus', localLang: 'fr' },
  { group: 'Mistério & história', q: 'dark history', lang: 'en', local: 'dunkle Geschichte', localLang: 'de' },
  { group: 'Mistério & história', q: 'abandoned places', lang: 'en', local: 'lieux abandonnés', localLang: 'fr' },
  { group: 'Mistério & história', q: 'ancient civilizations', lang: 'en', local: 'civilizaciones antiguas', localLang: 'es' },
  { group: 'Psicologia', q: 'stoicism', lang: 'en', local: 'Stoizismus', localLang: 'de' },
  { group: 'Psicologia', q: 'psychology facts', lang: 'en', local: 'datos de psicología', localLang: 'es' },
  { group: 'Mistério & história', q: 'true crime documentary', lang: 'en', local: 'true crime doku', localLang: 'de' },
  { group: '60+ & prepping', q: 'retirement tips seniors', lang: 'en', local: 'Rente Tipps', localLang: 'de' },
  { group: '60+ & prepping', q: 'food storage prepping', lang: 'en', local: 'Notvorrat Krise', localLang: 'de' },
  { group: '60+ & prepping', q: 'how the rich avoid taxes', lang: 'en' },
  { group: 'Por que [país] é assim', q: 'why is america like this', lang: 'en' },
  { group: 'Por que [país] é assim', q: 'warum ist Deutschland so', lang: 'de' },
  { group: 'Mistério & história', q: 'histoire sombre', lang: 'fr' },
];

export const DEFAULT_DISCOVERY = {
  days: 14,
  maxSubs: 100000,
  minViews: 10000,
  maxSearches: 40,
  homeLang: 'en',
  focus: '',
  focusShare: 0.8,
};

export const NO_GROUP = 'Sem grupo';
export const groupOf = (t) => t.group || NO_GROUP;
export const groupsOf = (queries) => [...new Set(queries.map(groupOf))];

export function discoveryConfig(doc = {}) {
  const d = doc.discovery ?? {};
  return {
    ...DEFAULT_DISCOVERY,
    ...Object.fromEntries(Object.entries(d).filter(([k, v]) => k !== 'queries' && v != null && v !== '')),
    queries: Array.isArray(d.queries) && d.queries.length ? d.queries : DEFAULT_QUERIES,
  };
}

export const themeKey = (q, lang) => `${lang || '?'}:${normalize(q).trim()}`;

// "termo | idioma | termo em outro idioma | outro idioma" — um tema por linha.
// Sem o quarto campo, o outro idioma é o idioma alvo padrão (homeLang).
// Uma linha "# Nome" abre um grupo (nicho): os temas abaixo dela pertencem a ele.
export function parseQueryLines(text, homeLang = 'en') {
  const seen = new Set();
  const out = [];
  let group = '';
  for (const line of String(text).split('\n')) {
    const head = line.match(/^\s*#+\s*(.*)$/);
    if (head) {
      group = head[1].trim();
      continue;
    }
    const [q, lang, local, localLang] = line.split('|').map((s) => s.trim());
    if (!q) continue;
    const l = (lang || homeLang).toLowerCase().slice(0, 5);
    const key = themeKey(q, l);
    if (seen.has(key)) continue;
    seen.add(key);
    const ll = (localLang || homeLang).toLowerCase().slice(0, 5);
    out.push({ ...(group ? { group } : {}), q, lang: l, ...(local && ll !== l ? { local, localLang: ll } : {}) });
  }
  return out;
}

const queryLine = (t) => [t.q, t.lang, t.local, t.local ? t.localLang : null].filter(Boolean).join(' | ');

// Agrupa por nicho na ordem em que os grupos aparecem; temas sem grupo vêm primeiro, sem cabeçalho.
export function formatQueryLines(queries) {
  const groups = new Map();
  for (const t of queries) {
    const g = t.group || '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const blocks = [];
  if (groups.has('')) blocks.push(groups.get('').map(queryLine).join('\n'));
  for (const [g, list] of groups) if (g) blocks.push([`# ${g}`, ...list.map(queryLine)].join('\n'));
  return blocks.join('\n\n');
}

export const searchCost = (t) => (t.local ? 2 : 1);

// Escolhe quais temas buscar hoje dentro do limite de buscas: primeiro os que
// nunca rodaram, depois os mais antigos. Temas já buscados hoje ficam de fora.
// Modo foco: o grupo em foco recebe `share` das buscas; o que sobrar de um lado
// passa para o outro.
export function pickThemes(queries, previous = {}, maxSearches, today, focus = null) {
  if (!focus?.group) return pickPool(queries, previous, maxSearches, today).picked;
  const inFocus = queries.filter((t) => groupOf(t) === focus.group);
  const others = queries.filter((t) => groupOf(t) !== focus.group);
  const focusBudget = Math.round(maxSearches * (focus.share ?? 0.8));
  const a = pickPool(inFocus, previous, focusBudget, today);
  const b = pickPool(others, previous, maxSearches - focusBudget + a.left, today);
  const c = b.left ? pickPool(inFocus.filter((t) => !a.picked.includes(t)), previous, b.left, today) : { picked: [] };
  return [...a.picked, ...c.picked, ...b.picked];
}

function pickPool(queries, previous, maxSearches, today) {
  const order = queries
    .map((t, i) => ({ t, i, last: previous[themeKey(t.q, t.lang)]?.lastRun ?? '' }))
    .filter((x) => x.last !== today)
    .sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : a.i - b.i));
  const out = [];
  let budget = maxSearches;
  for (const { t } of order) {
    const cost = searchCost(t);
    if (cost > budget) continue;
    budget -= cost;
    out.push(t);
  }
  return { picked: out, left: budget };
}

const daysSince = (iso, now) => (iso ? Math.max(0, (now - Date.parse(iso)) / 86400000) : null);

// v = { id, t, p: publicado (ISO), v: views, s: duração, ch, subs, chAt: criação do canal }
export function analyzeVideo(v, cfg, now = Date.now()) {
  const ageDays = daysSince(v.p, now);
  const chAgeDays = daysSince(v.chAt, now);
  const known = v.subs != null;
  const ratio = known ? v.v / Math.max(v.subs, 100) : null;
  const small = known && v.subs <= cfg.maxSubs;
  return {
    ...v,
    ageDays,
    chAgeDays,
    ratio,
    vpd: ageDays != null ? v.v / Math.max(ageDays, 0.5) : null,
    short: v.s != null && v.s <= SHORTS_MAX,
    small,
    newChannel: chAgeDays != null && chAgeDays <= NEW_CHANNEL_DAYS,
    outlier: small && ratio >= OUTLIER_RATIO && v.v >= cfg.minViews,
  };
}

// Métricas de um tema a partir dos vídeos da busca (já com analyzeVideo).
export function themeMetrics(videos) {
  const top = videos.slice().sort((a, b) => b.v - a.v).slice(0, TOP_N);
  const known = top.filter((v) => v.subs != null);
  const outliers = videos.filter((v) => v.outlier);
  const newChannels = new Set(outliers.filter((v) => v.newChannel).map((v) => v.ch));
  const shorts = top.filter((v) => v.short).length;
  return {
    n: videos.length,
    medianViews: top.length ? median(top.map((v) => v.v)) : 0,
    smallShare: known.length ? known.filter((v) => v.small).length / known.length : 0,
    outliers: new Set(outliers.map((v) => v.ch)).size,
    newChannels: newChannels.size,
    shortsShare: top.length ? shorts / top.length : null,
    channels: new Set(top.map((v) => v.ch)).size,
  };
}

// Lacuna de idioma: muita demanda no idioma de origem e pouca oferta no seu.
export function languageGap(main, local, cfg) {
  if (!main || !local) return null;
  const ratio = local.medianViews > 0 ? main.medianViews / local.medianViews : Infinity;
  const strong = main.medianViews >= cfg.minViews && (ratio >= 5 || local.n < 10);
  const some = main.medianViews >= cfg.minViews && ratio >= 2;
  return { ratio, level: strong ? 'forte' : some ? 'média' : null };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const GAP_MAX = { demanda: 30, pequenos: 25, virais: 20, novos: 15, cpm: 10 };
const TIER_POINTS = { alto: 10, medio: 6, baixo: 2 };

export function gapScore(m, tier = 'medio', langGap = null) {
  const parts = {
    demanda: clamp01((Math.log10(Math.max(m.medianViews, 1)) - 3) / 3) * GAP_MAX.demanda,
    pequenos: clamp01(m.smallShare) * GAP_MAX.pequenos,
    virais: clamp01(m.outliers / 5) * GAP_MAX.virais,
    novos: clamp01(m.newChannels / 3) * GAP_MAX.novos,
    cpm: TIER_POINTS[tier] ?? TIER_POINTS.medio,
  };
  const bonus = langGap?.level === 'forte' ? 10 : langGap?.level === 'média' ? 5 : 0;
  const total = Object.values(parts).reduce((a, b) => a + b, 0) + bonus;
  return { score: Math.round(Math.min(100, total)), parts, bonus };
}

export function gapVerdict(score) {
  if (score >= 65) return { key: 'testar', label: 'Lacuna forte' };
  if (score >= 45) return { key: 'promissor', label: 'Vale testar' };
  return { key: 'observar', label: 'Concorrido ou fraco' };
}

// Nicho e faixa de CPM do tema, pelo termo buscado e títulos dos vídeos.
export function themeNiche(q, videos) {
  const { niches } = classifyNiche({ title: q, recent: videos.slice(0, 12).map((v) => ({ t: v.t })) });
  const niche = niches[0] ?? null;
  return { niche, tier: (niche && suggestTier(niche)) || suggestTier(q) || 'medio' };
}

export function themeThesis(t) {
  const m = t.m;
  const bits = [];
  if (m.outliers) bits.push(`${m.outliers} canal(is) pequeno(s) com vídeo acima de ${OUTLIER_RATIO}× os inscritos`);
  if (m.newChannels) bits.push(`${m.newChannels} deles com menos de 6 meses`);
  bits.push(`${Math.round(m.smallShare * 100)}% dos mais vistos são de canais pequenos`);
  if (t.langGap?.level) {
    bits.push(`lacuna de idioma ${t.langGap.level}: em ${String(t.lang).toUpperCase()} a mediana é ${Number.isFinite(t.langGap.ratio) ? `${t.langGap.ratio.toFixed(1).replace('.', ',')}×` : 'muito'} maior que em ${String(t.localLang ?? '').toUpperCase()} ("${t.local}")`);
  }
  return bits.join(' · ');
}
