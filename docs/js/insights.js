// Leituras de oportunidade (sem DOM): CPM por nicho, ganhos estimados,
// análise dos vídeos recentes, score 0–100 e uma "tese" em texto.

import { median, daysBetween } from './metrics.js';
import { fmtN, fmtPct, fmtUSD } from './format.js';

// RPM = quanto o criador recebe por 1.000 views (USD). Faixas conservadoras
// para vídeos longos monetizados; Shorts pagam bem menos.
export const CPM_TIERS = {
  alto: { label: 'Alto', rpm: [4, 12], points: 15 },
  medio: { label: 'Médio', rpm: [1.5, 4], points: 8 },
  baixo: { label: 'Baixo', rpm: [0.3, 1.5], points: 3 },
};
const TIER_ORDER = ['alto', 'medio', 'baixo'];
const SHORTS_RPM_FACTOR = 0.1;
export const SHORTS_MAX_SECONDS = 180;

// Palavras-chave para sugerir a faixa de CPM quando o nicho não tem faixa definida.
const KEYWORDS = {
  alto: [
    'finan', 'invest', 'dinheiro', 'renda', 'negócio', 'negocio', 'empreend', 'marketing', 'vendas',
    'tecnolog', 'software', 'program', 'nuvem', 'cloud', 'ciberseg', 'segurança digital', 'cripto', 'bitcoin',
    'imóve', 'imove', 'seguro', 'direito', 'advoc', 'jurídic', 'saúde', 'saude', 'medicin', 'carreira',
    'inteligência artificial', ' ia ', 'b2b', 'saas', 'educação financeira', 'contab', 'imposto',
  ],
  medio: [
    'culin', 'comida', 'receita', 'fitness', 'treino', 'beleza', 'moda', 'viagem', 'automo', 'carro',
    'ciênc', 'cienc', 'histór', 'histor', 'produtiv', 'desenvolvimento', 'idioma', 'pet', 'casa',
    'decora', 'diy', 'jardim', 'espirit', 'psicolog', 'mindset', 'motiva', 'educa', 'documentár',
    'arte', 'desenho', 'fotograf', 'maternidade', 'relacionamento', 'nutri',
  ],
  baixo: [
    'game', 'jogo', 'humor', 'comédia', 'comedia', 'músic', 'music', 'infantil', 'kids', 'curiosidade',
    'dark', 'true crime', 'mistério', 'misterio', 'anime', 'fofoca', 'celebr', 'react', 'shorts', 'meme',
    'esporte', 'futebol', 'cultura pop', 'asmr', 'vlog', 'novela', 'filme', 'série', 'serie',
  ],
};

export function suggestTier(tag) {
  const t = ` ${String(tag).toLowerCase()} `;
  return TIER_ORDER.find((tier) => KEYWORDS[tier].some((k) => t.includes(k))) ?? null;
}

// Faixa do canal = a mais alta entre as tags. `overrides` = { tag: 'alto'|'medio'|'baixo' }.
export function cpmTier(tags = [], overrides = {}) {
  let best = null;
  let source = 'padrão';
  for (const tag of tags) {
    const manual = overrides[tag];
    const tier = manual ?? suggestTier(tag);
    if (!tier) continue;
    if (!best || TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(best)) {
      best = tier;
      source = manual ? 'manual' : 'automático';
    }
  }
  return { tier: best ?? 'medio', source: best ? source : 'padrão' };
}

// Vídeos recentes: mediana de views, outliers, cadência e formato.
export function recentStats(recent = [], subs = null, today = new Date().toISOString().slice(0, 10)) {
  const vids = recent.filter((v) => v.v != null);
  const views = vids.map((v) => v.v);
  const med = median(views);
  const top = vids.reduce((a, v) => (!a || v.v > a.v ? v : a), null);
  const dated = recent.filter((v) => v.d).map((v) => v.d).sort();
  let perWeek = null;
  if (dated.length >= 2) {
    const span = Math.max(1, daysBetween(dated[0], today));
    perWeek = (dated.length / span) * 7;
  }
  const withDur = recent.filter((v) => v.s != null);
  const shortsShare = withDur.length ? withDur.filter((v) => v.s <= SHORTS_MAX_SECONDS).length / withDur.length : null;
  // Views dos vídeos publicados nos últimos 30 dias (aproximação de views novas no mês).
  const last30 = vids.filter((v) => daysBetween(v.d, today) <= 30);
  return {
    count: vids.length,
    median: med,
    avg: views.length ? views.reduce((a, b) => a + b, 0) / views.length : null,
    top,
    outlierRatio: top && med ? top.v / med : null,
    viewsPerSub: med != null && subs ? med / subs : null,
    perWeek,
    shortsShare,
    last30Views: last30.length ? last30.reduce((a, v) => a + v.v, 0) : null,
  };
}

export function isOutlier(video, med) {
  return med > 0 && video.v >= med * 2;
}

// Views por mês: ritmo medido no histórico > vídeos do último mês > média da vida do canal.
export function monthlyViews(metrics, rs) {
  if (metrics.viewsPerDay != null) return { value: metrics.viewsPerDay * 30, basis: 'histórico' };
  if (rs?.last30Views) return { value: rs.last30Views, basis: 'vídeos recentes' };
  if (metrics.views != null && metrics.ageDays > 30) return { value: (metrics.views / metrics.ageDays) * 30, basis: 'média de vida' };
  return { value: null, basis: null };
}

export function estimateEarnings(metrics, rs, tier) {
  const mv = monthlyViews(metrics, rs);
  if (mv.value == null) return { min: null, max: null, basis: null };
  const shorts = rs?.shortsShare ?? 0;
  // Mistura RPM de vídeo longo e de Shorts pela proporção de Shorts recentes.
  const factor = 1 - shorts * (1 - SHORTS_RPM_FACTOR);
  const [lo, hi] = CPM_TIERS[tier].rpm;
  return {
    min: (mv.value / 1000) * lo * factor,
    max: (mv.value / 1000) * hi * factor,
    basis: mv.basis,
    monthlyViews: mv.value,
  };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Score de oportunidade 0–100: canal pequeno + crescendo + views desproporcionais
// aos inscritos + ativo + nicho que paga bem.
export function opportunityScore(metrics, rs, tier) {
  const s = metrics.subs;
  const parts = {
    tamanho: s == null ? 0 : s <= 10000 ? 20 : s <= 100000 ? 16 : s <= 500000 ? 8 : 2,
    crescimento: metrics.momentum != null ? clamp01(metrics.momentum / 0.3) * 25 : 0,
    tração: rs?.viewsPerSub != null ? clamp01(rs.viewsPerSub / 1.5) * 25 : 0,
    constância:
      metrics.daysSinceUpload == null ? 0 : metrics.daysSinceUpload <= 14 ? 15 : metrics.daysSinceUpload <= 30 ? 8 : 0,
    cpm: CPM_TIERS[tier].points,
  };
  // Sem histórico de crescimento ainda, a tração dos vídeos recentes ocupa esse peso.
  if (metrics.momentum == null && rs?.viewsPerSub != null) parts.crescimento = clamp01(rs.viewsPerSub / 3) * 15;
  const score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  return { score, parts };
}

export function verdict(score) {
  if (score >= 65) return { key: 'testar', label: 'Eu testaria agora' };
  if (score >= 45) return { key: 'promissor', label: 'Promissor' };
  return { key: 'observar', label: 'Em observação' };
}

// Texto curto explicando por que o canal chama atenção.
export function thesis(row, rs, tier, earnings) {
  const m = row.metrics;
  const niche = row.channel.tags?.[0] ?? 'seu nicho';
  const out = [];
  if (rs?.viewsPerSub != null && rs.viewsPerSub >= 0.5) {
    out.push(
      `${row.title} se destaca em ${niche} com visualizações desproporcionais à base de inscritos: a mediana dos vídeos recentes é ${fmtN(rs.median)} views (${rs.viewsPerSub.toFixed(1).replace('.', ',')}× os inscritos)`,
    );
  } else {
    out.push(`${row.title} atua em ${niche} com ${fmtN(m.subs)} inscritos`);
  }
  if (m.momentum != null && m.momentum > 0) out.push(`cresce ${fmtPct(m.momentum)} por mês em inscritos`);
  if (rs?.outlierRatio != null && rs.outlierRatio >= 3 && rs.top) {
    out.push(`o vídeo “${rs.top.t}” fez ${rs.outlierRatio.toFixed(0)}× a mediana, sinal de tema com demanda reprimida`);
  }
  if (m.ageDays != null && m.ageDays <= 365) out.push(`é um canal jovem (${Math.max(1, Math.round(m.ageDays / 30))} meses)`);
  if (rs?.perWeek != null) out.push(`publica cerca de ${rs.perWeek.toFixed(1).replace('.', ',')} vídeos por semana`);
  if (rs?.shortsShare != null) {
    out.push(rs.shortsShare >= 0.6 ? 'o formato é majoritariamente Shorts' : rs.shortsShare <= 0.2 ? 'aposta em vídeos longos' : 'mistura Shorts e vídeos longos');
  }
  let text = `${out[0]}.`;
  if (out.length > 1) {
    const rest = out.slice(1);
    const last = rest.pop();
    text += ` O canal ${rest.length ? `${rest.join(', ')} e ${last}` : last}.`;
  }
  if (earnings?.max != null) {
    text += ` Nicho de CPM ${CPM_TIERS[tier].label.toLowerCase()}, com ganho estimado de ${fmtUSD(earnings.min)}–${fmtUSD(earnings.max)} por mês.`;
  }
  return text;
}
