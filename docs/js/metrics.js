// Cálculos puros sobre o histórico (sem DOM) — usados pelo site e pelos testes.
// Linha de histórico: [data 'AAAA-MM-DD', inscritos|null, views, vídeos, últimoUpload|null]

export const DAY = 86400000;
export const UNTAGGED = 'sem nicho';

export const toTime = (d) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);
export const addDays = (d, n) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Última linha com data <= alvo; se o histórico começa depois do alvo, a primeira linha.
export function snapshotAt(hist, target) {
  let found = null;
  for (const row of hist) {
    if (row[0] <= target) found = row;
    else break;
  }
  return found ?? hist[0] ?? null;
}

// Crescimento numa janela de `days` dias até a coleta mais recente.
// Se o histórico for mais curto que a janela, usa o que existe e marca `partial`.
export function growth(hist, days) {
  if (!hist?.length) return null;
  const last = hist[hist.length - 1];
  const base = snapshotAt(hist, addDays(last[0], -days));
  const span = daysBetween(base[0], last[0]);
  if (span <= 0) return null;
  const subs0 = base[1];
  const subs1 = last[1];
  const dSubs = subs0 != null && subs1 != null ? subs1 - subs0 : null;
  const pctSubs = dSubs != null && subs0 > 0 ? dSubs / subs0 : null;
  return {
    span,
    partial: span < days,
    dSubs,
    dViews: last[2] - base[2],
    dVideos: last[3] - base[3],
    pctSubs,
    // Normalizado para 30 dias, para comparar canais com históricos de tamanhos diferentes.
    monthlyPct: pctSubs != null ? (pctSubs * 30) / span : null,
    subsPerDay: dSubs != null ? dSubs / span : null,
    viewsPerDay: (last[2] - base[2]) / span,
  };
}

export const MIN_SPAN_FOR_TREND = 3;

export function channelMetrics(hist, meta = {}, now = new Date()) {
  const last = hist?.[hist.length - 1] ?? null;
  const today = now.toISOString().slice(0, 10);
  const lastUpload = last?.[4] ?? meta.lastUpload ?? null;
  const g7 = growth(hist, 7);
  const g30 = growth(hist, 30);
  const g90 = growth(hist, 90);
  // Ritmo de referência: janela de 30 dias (ou o que houver, desde que >= 3 dias).
  const trend = g30 && g30.span >= MIN_SPAN_FOR_TREND ? g30 : null;
  const subs = last?.[1] ?? null;
  const views = last?.[2] ?? null;
  const videos = last?.[3] ?? null;
  const ageDays = meta.publishedAt ? daysBetween(meta.publishedAt, today) : null;
  return {
    subs,
    views,
    videos,
    lastUpload,
    daysSinceUpload: lastUpload ? daysBetween(lastUpload, today) : null,
    ageDays,
    viewsPerVideo: videos ? views / videos : null,
    viewsPerSub: subs ? views / subs : null,
    lifetimeSubsPerMonth: subs != null && ageDays > 0 ? (subs * 30) / ageDays : null,
    historyDays: hist?.length ? daysBetween(hist[0][0], last[0]) : 0,
    g7,
    g30,
    g90,
    momentum: trend?.monthlyPct ?? null,
    dSubs30: trend?.dSubs ?? null,
    viewsPerDay: trend?.viewsPerDay ?? null,
  };
}

export const DEFAULT_RISING = { maxSubs: 100000, minMonthlyPct: 0.1, minSubs: 100 };

// "Pequeno crescendo rápido": abaixo do teto de inscritos e com crescimento
// mensal (normalizado) acima do limiar.
export function isRisingSmall(m, opts = DEFAULT_RISING) {
  return (
    m.subs != null &&
    m.subs <= opts.maxSubs &&
    m.subs >= opts.minSubs &&
    m.momentum != null &&
    m.momentum >= opts.minMonthlyPct
  );
}

export function tagsOf(channel) {
  return channel.tags?.length ? channel.tags : [UNTAGGED];
}

// Agregados por nicho. `rows` = [{ channel, metrics, rising }]
export function nicheStats(rows) {
  const groups = new Map();
  for (const row of rows) {
    for (const tag of tagsOf(row.channel)) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(row);
    }
  }
  return [...groups].map(([tag, items]) => {
    const ms = items.map((r) => r.metrics);
    const withData = ms.filter((m) => m.subs != null);
    const withUploads = ms.filter((m) => m.daysSinceUpload != null);
    return {
      tag,
      count: items.length,
      totalSubs: withData.reduce((s, m) => s + m.subs, 0),
      medianSubs: median(withData.map((m) => m.subs)),
      medianMomentum: median(ms.map((m) => m.momentum)),
      withTrend: ms.filter((m) => m.momentum != null).length,
      dSubs30: ms.reduce((s, m) => s + (m.dSubs30 ?? 0), 0),
      viewsPerDay: ms.reduce((s, m) => s + (m.viewsPerDay ?? 0), 0),
      medianViewsPerVideo: median(ms.map((m) => m.viewsPerVideo)),
      activeShare: withUploads.length
        ? withUploads.filter((m) => m.daysSinceUpload <= 30).length / withUploads.length
        : null,
      risingCount: items.filter((r) => r.rising).length,
    };
  });
}

// Índice encadeado (base 100) de um grupo de canais ao longo do tempo.
// Cada passo usa só canais presentes nas duas datas, então adicionar
// um canal novo ao nicho não cria um salto artificial.
// col: 1 = inscritos, 2 = views.
export function chainIndex(histories, col = 1) {
  const byDate = new Map();
  for (const hist of histories) {
    for (const row of hist) {
      if (row[col] == null) continue;
      if (!byDate.has(row[0])) byDate.set(row[0], new Map());
      byDate.get(row[0]).set(hist, row[col]);
    }
  }
  const dates = [...byDate.keys()].sort();
  const out = [];
  let value = 100;
  let prev = null;
  for (const d of dates) {
    const cur = byDate.get(d);
    if (prev) {
      let a = 0;
      let b = 0;
      for (const [h, v] of cur) {
        if (prev.has(h)) {
          a += prev.get(h);
          b += v;
        }
      }
      if (a > 0) value *= b / a;
    }
    out.push([d, value]);
    prev = cur;
  }
  return out;
}
