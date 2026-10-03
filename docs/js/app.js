import {
  channelMetrics,
  isRisingSmall,
  nicheStats,
  chainIndex,
  daysBetween,
  tagsOf,
  DEFAULT_RISING,
  MIN_SPAN_FOR_TREND,
  UNTAGGED,
} from './metrics.js';
import {
  loadConfig,
  saveConfig,
  canWrite,
  fetchChannelsDoc,
  updateChannelsDoc,
  triggerCollect,
} from './github.js';

const app = document.getElementById('app');
const MAX_COMPARE = 8;
const CHANNEL_ID = /^UC[\w-]{22}$/;

const state = {
  doc: { channels: [] },
  stats: {},
  rows: [],
  cfg: loadConfig(),
  rising: loadPrefs(),
  filters: { q: '', tags: new Set(), size: 'all', risingOnly: false, sort: { key: 'momentum', dir: -1 } },
  nicheSort: { key: 'medianMomentum', dir: -1 },
  selected: new Set(),
  compare: { metric: 1, mode: 'index', q: '' },
  nicheChart: { metric: 1, tags: null },
};
let charts = [];

/* ---------- utilidades ---------- */

function loadPrefs() {
  try {
    return { ...DEFAULT_RISING, ...JSON.parse(localStorage.getItem('radar.rising') ?? '{}') };
  } catch {
    return { ...DEFAULT_RISING };
  }
}
function savePrefs() {
  try {
    localStorage.setItem('radar.rising', JSON.stringify(state.rising));
  } catch {
    /* sem armazenamento */
  }
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nfCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const nfInt = new Intl.NumberFormat('pt-BR');
const nfPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const nfPctPlain = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

const fmtN = (n) => (n == null || !Number.isFinite(n) ? '—' : nfCompact.format(n));
const fmtInt = (n) => (n == null ? '—' : nfInt.format(Math.round(n)));
const fmtSigned = (n) => (n == null || !Number.isFinite(n) ? '—' : (n > 0 ? '+' : '') + nfCompact.format(n));
const fmtPct = (p) => (p == null || !Number.isFinite(p) ? '—' : nfPct.format(p));
const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—');
const signClass = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

function fmtAgo(days) {
  if (days == null) return '—';
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 60) return `há ${days} dias`;
  if (days < 730) return `há ${Math.round(days / 30)} meses`;
  return `há ${Math.round(days / 365)} anos`;
}
function fmtAge(days) {
  if (days == null) return '—';
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30)} m`;
  return `${(days / 365).toFixed(1).replace('.', ',')} a`;
}

function partialMark(g) {
  return g?.partial ? `<span class="muted" title="Baseado em ${g.span} dias de histórico">~</span>` : '';
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = 'toast'), isError ? 6000 : 3000);
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const seriesColor = (i) => cssVar(`--s${(i % 8) + 1}`);

const normTags = (text) => [
  ...new Set(
    String(text)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  ),
];

const channelHref = (row) => `#/canal/${encodeURIComponent(row.ref)}`;

/* ---------- dados ---------- */

async function fetchJson(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const [doc, stats] = await Promise.all([
    fetchJson('data/channels.json').catch(() => ({ channels: [] })),
    fetchJson('data/stats.json').catch(() => ({})),
  ]);
  state.doc = doc;
  state.stats = stats;
  // Com token, o catálogo vem direto do repositório (o site publicado pode estar alguns minutos atrás).
  if (canWrite(state.cfg)) {
    try {
      state.doc = (await fetchChannelsDoc(state.cfg)).doc;
    } catch (err) {
      console.warn('Não foi possível ler o catálogo pelo GitHub:', err);
    }
  }
  buildRows();
}

function buildRows() {
  const { resolve = {}, channels = {}, history = {}, errors = {} } = state.stats;
  const now = new Date();
  state.rows = (state.doc.channels ?? []).map((c) => {
    const id = resolve[c.ref] ?? (CHANNEL_ID.test(c.ref) ? c.ref : null);
    const meta = (id && channels[id]) || {};
    const hist = (id && history[id]) || [];
    const metrics = channelMetrics(hist, meta, now);
    const row = {
      ref: c.ref,
      id,
      channel: c,
      meta,
      hist,
      metrics,
      title: meta.title || c.ref,
      error: errors[c.ref] ?? null,
    };
    row.status = row.error ? 'erro' : hist.length ? 'ok' : 'pendente';
    row.rising = isRisingSmall(metrics, state.rising);
    return row;
  });
}

function allTags() {
  const counts = new Map();
  for (const r of state.rows) for (const t of r.channel.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/* ---------- gráficos ---------- */

function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}

function lineChart(canvas, { labels, datasets, yFormat = fmtN, type = 'line' }) {
  if (!window.Chart) return;
  const grid = cssVar('--grid');
  const muted = cssVar('--muted');
  const multi = datasets.length > 1;
  const chart = new window.Chart(canvas, {
    type,
    data: {
      labels: labels.map(fmtDate),
      datasets: datasets.map((d, i) => {
        const color = d.color ?? seriesColor(i);
        return {
          label: d.label,
          data: d.data,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: labels.length < 3 ? 4 : 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: cssVar('--surface'),
          tension: 0.2,
          spanGaps: true,
          borderRadius: 4,
          maxBarThickness: 18,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: multi,
          position: 'top',
          align: 'start',
          labels: { color: cssVar('--ink-2'), boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 },
        },
        tooltip: {
          backgroundColor: cssVar('--surface'),
          titleColor: cssVar('--ink'),
          bodyColor: cssVar('--ink-2'),
          borderColor: cssVar('--axis'),
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          itemSort: (a, b) => (b.parsed.y ?? -Infinity) - (a.parsed.y ?? -Infinity),
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${yFormat(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: cssVar('--axis') },
          ticks: { color: muted, maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          grid: { color: grid },
          border: { display: false },
          ticks: { color: muted, callback: (v) => yFormat(v) },
        },
      },
    },
  });
  charts.push(chart);
}

// Junta históricos de vários canais num eixo de datas comum.
function alignSeries(series) {
  const labels = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort();
  return {
    labels,
    datasets: series.map((s) => {
      const map = new Map(s.points);
      return { ...s, data: labels.map((d) => map.get(d) ?? null) };
    }),
  };
}

/* ---------- roteamento ---------- */

function route() {
  destroyCharts();
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const page = parts[0] ?? 'painel';
  document.querySelectorAll('.tabs a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === (page === 'canal' ? '' : page));
    if (a.dataset.route === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (page === 'nichos') renderNiches();
  else if (page === 'comparar') renderCompare(params);
  else if (page === 'canal') renderChannel(decodeURIComponent(parts.slice(1).join('/')));
  else if (page === 'gerenciar') renderManage();
  else renderDashboard(params);
  renderFooter();
}

function renderFooter() {
  const at = state.stats.updatedAt ? new Date(state.stats.updatedAt) : null;
  document.getElementById('footer').innerHTML = at
    ? `Última coleta: ${at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · dados da YouTube Data API`
    : 'Nenhuma coleta feita ainda.';
}

/* ---------- Painel ---------- */

const SIZE_BUCKETS = {
  all: ['Todos os tamanhos', 0, Infinity],
  xs: ['Até 1 mil', 0, 1e3],
  s: ['1 mil – 10 mil', 1e3, 1e4],
  m: ['10 mil – 100 mil', 1e4, 1e5],
  l: ['100 mil – 1 mi', 1e5, 1e6],
  xl: ['Acima de 1 mi', 1e6, Infinity],
};

const TABLE_COLS = [
  { key: 'title', label: 'Canal', get: (r) => r.title.toLowerCase() },
  { key: 'subs', label: 'Inscritos', num: true, get: (r) => r.metrics.subs },
  { key: 'd7', label: 'Δ 7 dias', num: true, get: (r) => r.metrics.g7?.dSubs },
  { key: 'momentum', label: 'Crescimento / mês', num: true, get: (r) => r.metrics.momentum },
  { key: 'd30', label: 'Δ 30 dias', num: true, get: (r) => r.metrics.dSubs30 },
  { key: 'vpd', label: 'Views / dia', num: true, get: (r) => r.metrics.viewsPerDay },
  { key: 'vpv', label: 'Views / vídeo', num: true, get: (r) => r.metrics.viewsPerVideo },
  { key: 'videos', label: 'Vídeos', num: true, get: (r) => r.metrics.videos },
  { key: 'upload', label: 'Último upload', num: true, get: (r) => r.metrics.daysSinceUpload },
  { key: 'age', label: 'Idade', num: true, get: (r) => r.metrics.ageDays },
];

function sortRows(rows, cols, sort) {
  const col = cols.find((c) => c.key === sort.key) ?? cols[0];
  return [...rows].sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // vazios sempre no fim
    if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });
}

function filteredRows() {
  const f = state.filters;
  const [, min, max] = SIZE_BUCKETS[f.size] ?? SIZE_BUCKETS.all;
  const q = f.q.trim().toLowerCase();
  return state.rows.filter((r) => {
    if (q && !`${r.title} ${r.ref} ${r.meta.handle ?? ''} ${r.channel.notes ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.tags.size && !tagsOf(r.channel).some((t) => f.tags.has(t))) return false;
    if (f.size !== 'all' && (r.metrics.subs == null || r.metrics.subs < min || r.metrics.subs >= max)) return false;
    if (f.risingOnly && !r.rising) return false;
    return true;
  });
}

function chanCell(r, { tags = true } = {}) {
  const img = r.meta.thumbnail
    ? `<img src="${esc(r.meta.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '<span class="avatar"></span>';
  const tagHtml = tags
    ? `<span class="tags">${(r.channel.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${
        r.rising ? '<span class="badge-rise">▲ em alta</span>' : ''
      }${r.status !== 'ok' ? `<span class="status${r.status === 'erro' ? ' err' : ''}">${r.status === 'erro' ? 'erro' : 'aguardando coleta'}</span>` : ''}</span>`
    : '';
  return `<div class="chan">${img}<div><a class="name" href="${channelHref(r)}">${esc(r.title)}</a>${tagHtml}</div></div>`;
}

function trendNotice() {
  const maxDays = Math.max(0, ...state.rows.map((r) => r.metrics.historyDays));
  if (!state.rows.length || maxDays >= MIN_SPAN_FOR_TREND) return '';
  return `<div class="notice">O histórico ainda está começando (${maxDays} dia${maxDays === 1 ? '' : 's'}).
    Crescimento e “pequenos em alta” aparecem depois de ${MIN_SPAN_FOR_TREND} dias de coleta; as janelas de 7 e 30 dias se completam com o tempo.</div>`;
}

function renderDashboard(params) {
  if (params.get('tag')) {
    state.filters.tags = new Set([params.get('tag')]);
  }
  const rows = state.rows;
  if (!rows.length) {
    app.innerHTML = `<div class="card empty">
      <h1>Nenhum canal catalogado ainda</h1>
      <p>Adicione canais com tags de nicho em <a href="#/gerenciar">Gerenciar</a>. A coleta diária começa a montar o histórico a partir daí.</p>
    </div>`;
    return;
  }
  const rising = rows.filter((r) => r.rising).sort((a, b) => b.metrics.momentum - a.metrics.momentum);
  const niches = nicheStats(rows)
    .filter((n) => n.medianMomentum != null && n.tag !== UNTAGGED)
    .sort((a, b) => b.medianMomentum - a.medianMomentum);
  const tagCount = allTags().length;
  const pending = rows.filter((r) => r.status !== 'ok').length;
  const R = state.rising;

  app.innerHTML = `
    <div class="page-head">
      <div><h1>Painel</h1><p>Onde há crescimento agora — por canal e por nicho.</p></div>
    </div>
    ${trendNotice()}
    <div class="kpis">
      <div class="kpi"><div class="label">Canais monitorados</div><div class="value">${rows.length}</div>
        <div class="sub">${pending ? `${pending} aguardando coleta ou com erro` : 'todos coletados'}</div></div>
      <div class="kpi"><div class="label">Nichos (tags)</div><div class="value">${tagCount}</div></div>
      <div class="kpi"><div class="label">Pequenos em alta</div><div class="value">${rising.length}</div>
        <div class="sub">até ${fmtN(R.maxSubs)} inscritos, ≥ ${fmtPct(R.minMonthlyPct).replace('+', '')}/mês</div></div>
      <div class="kpi"><div class="label">Nicho mais quente</div><div class="value" style="font-size:1.2rem">${esc(niches[0]?.tag ?? '—')}</div>
        <div class="sub">${niches[0] ? `mediana ${fmtPct(niches[0].medianMomentum)}/mês` : 'sem histórico suficiente'}</div></div>
    </div>

    <section class="card">
      <div class="card-head">
        <div><h2>Pequenos crescendo rápido</h2>
        <p class="muted small">Canais pequenos com crescimento de inscritos acima do limiar, normalizado para 30 dias.</p></div>
        <form class="toolbar" id="risingForm" style="margin:0">
          <label class="inline">até <input type="number" name="maxSubs" min="0" step="1000" value="${R.maxSubs}" style="width:110px"> inscritos</label>
          <label class="inline">crescimento ≥ <input type="number" name="minPct" min="0" step="1" value="${Math.round(R.minMonthlyPct * 100)}" style="width:70px"> %/mês</label>
          <button type="submit">Aplicar</button>
        </form>
      </div>
      ${
        rising.length
          ? `<div class="rise-grid">${rising.slice(0, 12).map(riseCard).join('')}</div>`
          : '<p class="muted">Nenhum canal atende aos critérios agora. Ajuste os limites acima ou aguarde mais dias de histórico.</p>'
      }
    </section>

    <section class="card">
      <div class="card-head">
        <div><h2>Nichos em alta</h2><p class="muted small">Mediana do crescimento mensal de inscritos dos canais de cada nicho.</p></div>
        <a href="#/nichos">Ver análise de nichos →</a>
      </div>
      ${niches.length ? nicheRank(niches.slice(0, 8)) : '<p class="muted">Sem histórico suficiente ainda.</p>'}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Todos os canais</h2>
        <button class="primary" id="compareBtn" disabled>Comparar selecionados</button>
      </div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="Buscar por nome, @handle ou nota…" value="${esc(state.filters.q)}" aria-label="Buscar">
        <select id="size" aria-label="Tamanho">${Object.entries(SIZE_BUCKETS)
          .map(([k, [label]]) => `<option value="${k}"${state.filters.size === k ? ' selected' : ''}>${label}</option>`)
          .join('')}</select>
        <label class="inline"><input type="checkbox" id="risingOnly"${state.filters.risingOnly ? ' checked' : ''}> só pequenos em alta</label>
      </div>
      <div class="chips" id="tagChips" style="margin-bottom:12px"></div>
      <div class="table-wrap"><table id="chanTable"></table></div>
    </section>`;

  renderTagChips();
  renderTable();

  document.getElementById('risingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.rising.maxSubs = Math.max(0, Number(fd.get('maxSubs')) || DEFAULT_RISING.maxSubs);
    state.rising.minMonthlyPct = Math.max(0, Number(fd.get('minPct')) || 0) / 100;
    savePrefs();
    buildRows();
    route();
  });
  document.getElementById('q').addEventListener('input', (e) => {
    state.filters.q = e.target.value;
    renderTable();
  });
  document.getElementById('size').addEventListener('change', (e) => {
    state.filters.size = e.target.value;
    renderTable();
  });
  document.getElementById('risingOnly').addEventListener('change', (e) => {
    state.filters.risingOnly = e.target.checked;
    renderTable();
  });
  document.getElementById('compareBtn').addEventListener('click', () => {
    location.hash = `#/comparar?c=${[...state.selected].map(encodeURIComponent).join(',')}`;
  });
}

function riseCard(r) {
  const m = r.metrics;
  return `<a class="rise-card" href="${channelHref(r)}">
    <div class="top">${r.meta.thumbnail ? `<img class="avatar" src="${esc(r.meta.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="avatar"></span>'}
      <div style="min-width:0"><div class="title">${esc(r.title)}</div>
      <div class="chips">${(r.channel.tags ?? []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></div>
    <div><span class="big up">${fmtPct(m.momentum)}</span> <span class="muted small">/ mês ${partialMark(m.g30)}</span></div>
    <div class="stats"><span>${fmtN(m.subs)} inscritos</span><span>${fmtSigned(m.dSubs30)} no período</span></div>
    <div class="stats"><span>${fmtN(m.viewsPerDay)} views/dia</span><span>upload ${fmtAgo(m.daysSinceUpload)}</span></div>
  </a>`;
}

function nicheRank(niches) {
  const max = Math.max(...niches.map((n) => Math.abs(n.medianMomentum)), 1e-9);
  return `<ol class="rank">${niches
    .map(
      (n) => `<li>
      <a href="#/?tag=${encodeURIComponent(n.tag)}" title="Filtrar canais deste nicho">${esc(n.tag)}</a>
      <div class="bar-track" title="${n.withTrend} de ${n.count} canais com histórico"><div class="bar-fill${n.medianMomentum < 0 ? ' neg' : ''}" style="width:${(Math.abs(n.medianMomentum) / max) * 100}%"></div></div>
      <span class="num">${fmtPct(n.medianMomentum)}</span>
    </li>`,
    )
    .join('')}</ol>`;
}

function renderTagChips() {
  const el = document.getElementById('tagChips');
  const tags = allTags();
  if (state.rows.some((r) => !r.channel.tags?.length)) tags.push(UNTAGGED);
  el.innerHTML = tags.length
    ? `<span class="muted small" style="align-self:center">Nichos:</span>${tags
        .map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${state.filters.tags.has(t)}">${esc(t)}</button>`)
        .join('')}${state.filters.tags.size ? '<button type="button" class="chip" data-clear="1">limpar</button>' : ''}`
    : '';
  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.clear) state.filters.tags.clear();
    else if (state.filters.tags.has(b.dataset.tag)) state.filters.tags.delete(b.dataset.tag);
    else state.filters.tags.add(b.dataset.tag);
    if (location.hash.includes('tag=')) history.replaceState(null, '', '#/');
    renderTagChips();
    renderTable();
  };
}

function renderTable() {
  const table = document.getElementById('chanTable');
  const rows = sortRows(filteredRows(), TABLE_COLS, state.filters.sort);
  const s = state.filters.sort;
  const head = `<thead><tr><th><span class="sr-only" hidden>Selecionar</span></th>${TABLE_COLS.map(
    (c) =>
      `<th class="sortable${c.num ? ' num' : ''}" data-key="${c.key}"${c.key === s.key ? ` aria-sort="${s.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${c.label}</th>`,
  ).join('')}</tr></thead>`;
  const body = rows.length
    ? rows
        .map((r) => {
          const m = r.metrics;
          return `<tr class="${r.rising ? 'is-rising' : ''}">
        <td><input type="checkbox" data-ref="${esc(r.ref)}" aria-label="Selecionar ${esc(r.title)} para comparar"${state.selected.has(r.ref) ? ' checked' : ''}></td>
        <td>${chanCell(r)}</td>
        <td class="num">${r.meta.hiddenSubscribers ? '<span class="muted" title="Inscritos ocultos pelo canal">oculto</span>' : fmtN(m.subs)}</td>
        <td class="num ${signClass(m.g7?.dSubs)}">${partialMark(m.g7)}${fmtSigned(m.g7?.dSubs)}</td>
        <td class="num ${signClass(m.momentum)}">${partialMark(m.g30)}${fmtPct(m.momentum)}</td>
        <td class="num ${signClass(m.dSubs30)}">${fmtSigned(m.dSubs30)}</td>
        <td class="num">${fmtN(m.viewsPerDay)}</td>
        <td class="num">${fmtN(m.viewsPerVideo)}</td>
        <td class="num">${fmtInt(m.videos)}</td>
        <td class="num" title="${fmtDate(m.lastUpload)}">${fmtAgo(m.daysSinceUpload)}</td>
        <td class="num" title="Criado em ${fmtDate(r.meta.publishedAt)}">${fmtAge(m.ageDays)}</td>
      </tr>`;
        })
        .join('')
    : `<tr><td colspan="${TABLE_COLS.length + 1}" class="empty">Nenhum canal com esses filtros.</td></tr>`;
  table.innerHTML = head + `<tbody>${body}</tbody>`;
  table.querySelector('thead').onclick = (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.key;
    state.filters.sort = { key, dir: s.key === key ? -s.dir : key === 'title' || key === 'upload' ? 1 : -1 };
    renderTable();
  };
  table.querySelector('tbody').onchange = (e) => {
    const ref = e.target.dataset.ref;
    if (!ref) return;
    if (e.target.checked) state.selected.add(ref);
    else state.selected.delete(ref);
    updateCompareBtn();
  };
  updateCompareBtn();
}

function updateCompareBtn() {
  const btn = document.getElementById('compareBtn');
  if (!btn) return;
  const n = state.selected.size;
  btn.disabled = n < 1;
  btn.textContent = n ? `Comparar selecionados (${n})` : 'Comparar selecionados';
}

/* ---------- Nichos ---------- */

const NICHE_COLS = [
  { key: 'tag', label: 'Nicho', get: (n) => n.tag },
  { key: 'count', label: 'Canais', num: true, get: (n) => n.count },
  { key: 'medianMomentum', label: 'Crescimento mediano / mês', num: true, get: (n) => n.medianMomentum },
  { key: 'dSubs30', label: 'Novos inscritos (30 d)', num: true, get: (n) => n.dSubs30 },
  { key: 'viewsPerDay', label: 'Views / dia (soma)', num: true, get: (n) => n.viewsPerDay },
  { key: 'medianViewsPerVideo', label: 'Views / vídeo (mediana)', num: true, get: (n) => n.medianViewsPerVideo },
  { key: 'medianSubs', label: 'Inscritos (mediana)', num: true, get: (n) => n.medianSubs },
  { key: 'activeShare', label: 'Ativos (upload ≤ 30 d)', num: true, get: (n) => n.activeShare },
  { key: 'risingCount', label: 'Pequenos em alta', num: true, get: (n) => n.risingCount },
];

function renderNiches() {
  const niches = nicheStats(state.rows);
  if (!niches.length) {
    app.innerHTML = '<div class="card empty"><h1>Sem nichos ainda</h1><p>Adicione canais com tags em <a href="#/gerenciar">Gerenciar</a>.</p></div>';
    return;
  }
  app.innerHTML = `
    <div class="page-head"><div><h1>Nichos</h1>
      <p>Compare nichos pelo ritmo dos canais que você catalogou. Mediana evita que um canal gigante distorça o nicho.</p></div></div>
    ${trendNotice()}
    <section class="card">
      <div class="table-wrap"><table id="nicheTable"></table></div>
      <p class="muted small" style="margin:10px 0 0">Dica: um nicho com crescimento mediano alto, muitos “pequenos em alta” e boa média de views por vídeo sugere demanda que ainda não está saturada.</p>
    </section>
    <section class="card">
      <div class="card-head">
        <div><h2>Índice de crescimento por nicho</h2>
        <p class="muted small">Base 100 no primeiro dia. Encadeado dia a dia só com canais presentes nos dois dias, então incluir um canal novo não cria saltos.</p></div>
        <div class="seg" role="group" aria-label="Métrica">
          <button type="button" data-metric="1" aria-pressed="${state.nicheChart.metric === 1}">Inscritos</button>
          <button type="button" data-metric="2" aria-pressed="${state.nicheChart.metric === 2}">Views</button>
        </div>
      </div>
      <div class="chips" id="nicheChips" style="margin-bottom:12px"></div>
      <div class="chart-box"><canvas id="nicheChart" aria-label="Índice de crescimento por nicho" role="img"></canvas></div>
    </section>`;

  const renderTable = () => {
    const s = state.nicheSort;
    const sorted = sortRows(niches, NICHE_COLS, s);
    const maxAbs = Math.max(...niches.map((n) => Math.abs(n.medianMomentum ?? 0)), 1e-9);
    const t = document.getElementById('nicheTable');
    t.innerHTML = `<thead><tr>${NICHE_COLS.map(
      (c) =>
        `<th class="sortable${c.num ? ' num' : ''}" data-key="${c.key}"${c.key === s.key ? ` aria-sort="${s.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${c.label}</th>`,
    ).join('')}</tr></thead><tbody>${sorted
      .map(
        (n) => `<tr>
        <td><a href="#/?tag=${encodeURIComponent(n.tag)}"><strong>${esc(n.tag)}</strong></a></td>
        <td class="num">${n.count}</td>
        <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill${(n.medianMomentum ?? 0) < 0 ? ' neg' : ''}" style="width:${(Math.abs(n.medianMomentum ?? 0) / maxAbs) * 100}%"></div></div>
          <span class="num ${signClass(n.medianMomentum)}" style="min-width:60px">${fmtPct(n.medianMomentum)}</span></div>
          ${n.withTrend < n.count ? `<span class="muted small">${n.withTrend}/${n.count} com histórico</span>` : ''}</td>
        <td class="num ${signClass(n.dSubs30)}">${fmtSigned(n.dSubs30)}</td>
        <td class="num">${fmtN(n.viewsPerDay)}</td>
        <td class="num">${fmtN(n.medianViewsPerVideo)}</td>
        <td class="num">${fmtN(n.medianSubs)}</td>
        <td class="num">${n.activeShare == null ? '—' : nfPctPlain.format(n.activeShare)}</td>
        <td class="num">${n.risingCount ? `<span class="badge-rise">▲ ${n.risingCount}</span>` : '0'}</td>
      </tr>`,
      )
      .join('')}</tbody>`;
    t.querySelector('thead').onclick = (e) => {
      const th = e.target.closest('th.sortable');
      if (!th) return;
      state.nicheSort = { key: th.dataset.key, dir: s.key === th.dataset.key ? -s.dir : th.dataset.key === 'tag' ? 1 : -1 };
      renderTable();
    };
  };
  renderTable();

  // Cores fixas por nicho (ordem alfabética), para a cor não mudar quando o filtro muda.
  const tagOrder = niches.map((n) => n.tag).sort((a, b) => a.localeCompare(b));
  if (!state.nicheChart.tags) {
    state.nicheChart.tags = new Set(
      [...niches].sort((a, b) => (b.medianMomentum ?? -Infinity) - (a.medianMomentum ?? -Infinity)).slice(0, 5).map((n) => n.tag),
    );
  }
  const drawChart = () => {
    destroyCharts();
    const chips = document.getElementById('nicheChips');
    const sel = state.nicheChart.tags;
    chips.innerHTML = `<span class="muted small" style="align-self:center">Mostrar (até ${MAX_COMPARE}):</span>${tagOrder
      .map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${sel.has(t)}">${esc(t)}</button>`)
      .join('')}`;
    const chosen = tagOrder.filter((t) => sel.has(t));
    const series = chosen.map((tag) => {
      const hists = state.rows.filter((r) => tagsOf(r.channel).includes(tag)).map((r) => r.hist);
      return { label: tag, color: seriesColor(tagOrder.indexOf(tag)), points: chainIndex(hists, state.nicheChart.metric) };
    });
    const { labels, datasets } = alignSeries(series);
    if (labels.length) {
      lineChart(document.getElementById('nicheChart'), {
        labels,
        datasets,
        yFormat: (v) => (v == null ? '—' : v.toFixed(1).replace('.', ',')),
      });
    }
  };
  drawChart();

  document.getElementById('nicheChips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tag]');
    if (!b) return;
    const sel = state.nicheChart.tags;
    if (sel.has(b.dataset.tag)) sel.delete(b.dataset.tag);
    else if (sel.size < MAX_COMPARE) sel.add(b.dataset.tag);
    else toast(`Máximo de ${MAX_COMPARE} nichos no gráfico.`);
    drawChart();
  });
  app.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-metric]');
    if (!b) return;
    state.nicheChart.metric = Number(b.dataset.metric);
    app.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawChart();
  });
}

/* ---------- Comparar ---------- */

const METRICS = { 1: 'Inscritos', 2: 'Views totais', 3: 'Vídeos' };
const MODES = { abs: 'Absoluto', index: 'Índice (base 100)', delta: 'Ganho desde o início' };

function renderCompare(params) {
  if (params.get('c')) {
    state.selected = new Set(params.get('c').split(',').map(decodeURIComponent).filter((ref) => state.rows.some((r) => r.ref === ref)));
  }
  if (!state.rows.length) {
    app.innerHTML = '<div class="card empty"><h1>Nada para comparar</h1><p>Adicione canais em <a href="#/gerenciar">Gerenciar</a>.</p></div>';
    return;
  }
  const C = state.compare;
  app.innerHTML = `
    <div class="page-head"><div><h1>Comparar canais</h1><p>Escolha até ${MAX_COMPARE} canais. O modo índice coloca canais de tamanhos diferentes na mesma régua.</p></div></div>
    <div class="grid-2" style="grid-template-columns: minmax(0, 320px) minmax(0, 1fr)" id="cmpGrid">
      <section class="card">
        <h2 style="margin-bottom:10px">Canais</h2>
        <input type="search" id="cmpQ" placeholder="Filtrar por nome ou nicho…" value="${esc(C.q)}" style="width:100%;margin-bottom:8px" aria-label="Filtrar canais">
        <div class="picker" id="picker"></div>
        <button type="button" id="cmpClear" style="margin-top:8px">Limpar seleção</button>
      </section>
      <section class="card">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Métrica" id="cmpMetric">${Object.entries(METRICS)
            .map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${String(C.metric) === k}">${v}</button>`)
            .join('')}</div>
          <div class="seg" role="group" aria-label="Modo" id="cmpMode">${Object.entries(MODES)
            .map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${C.mode === k}">${v}</button>`)
            .join('')}</div>
        </div>
        <div class="chart-box"><canvas id="cmpChart" role="img" aria-label="Comparação de canais"></canvas></div>
        <div id="cmpEmpty"></div>
      </section>
    </div>
    <section class="card"><h2 style="margin-bottom:10px">Lado a lado</h2><div class="table-wrap"><table id="cmpTable"></table></div></section>`;

  // Em telas estreitas, empilha.
  if (window.matchMedia('(max-width: 760px)').matches) document.getElementById('cmpGrid').style.gridTemplateColumns = '1fr';

  // Cor estável por canal: ordem do catálogo entre os selecionados.
  const colorOf = (ref) => {
    const order = state.rows.filter((r) => state.selected.has(r.ref)).map((r) => r.ref);
    return seriesColor(order.indexOf(ref));
  };

  const renderPicker = () => {
    const q = C.q.trim().toLowerCase();
    const list = state.rows
      .filter((r) => !q || `${r.title} ${(r.channel.tags ?? []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (state.selected.has(b.ref) - state.selected.has(a.ref)) || a.title.localeCompare(b.title));
    document.getElementById('picker').innerHTML =
      list
        .map((r) => {
          const on = state.selected.has(r.ref);
          return `<label><input type="checkbox" data-ref="${esc(r.ref)}"${on ? ' checked' : ''}>
          ${on ? `<span class="swatch" style="background:${colorOf(r.ref)}"></span>` : ''}
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</span>
          <span class="muted small">${fmtN(r.metrics.subs)}</span></label>`;
        })
        .join('') || '<p class="muted" style="padding:10px;margin:0">Nenhum canal.</p>';
  };

  const draw = () => {
    destroyCharts();
    const chosen = state.rows.filter((r) => state.selected.has(r.ref));
    const col = Number(C.metric);
    const series = chosen.map((r) => {
      const pts = r.hist.filter((row) => row[col] != null).map((row) => [row[0], row[col]]);
      const base = pts[0]?.[1];
      const points = pts.map(([d, v]) => [
        d,
        C.mode === 'index' ? (base ? (v / base) * 100 : null) : C.mode === 'delta' ? v - base : v,
      ]);
      return { label: r.title, color: colorOf(r.ref), points };
    });
    const { labels, datasets } = alignSeries(series);
    const empty = document.getElementById('cmpEmpty');
    if (!chosen.length) empty.innerHTML = '<p class="muted">Selecione canais à esquerda.</p>';
    else if (!labels.length) empty.innerHTML = '<p class="muted">Os canais selecionados ainda não têm histórico.</p>';
    else empty.innerHTML = '';
    if (labels.length) {
      lineChart(document.getElementById('cmpChart'), {
        labels,
        datasets,
        yFormat: C.mode === 'index' ? (v) => (v == null ? '—' : v.toFixed(1).replace('.', ',')) : C.mode === 'delta' ? fmtSigned : fmtN,
      });
    }
    renderCmpTable(chosen, colorOf);
    const ids = chosen.map((r) => encodeURIComponent(r.ref)).join(',');
    history.replaceState(null, '', ids ? `#/comparar?c=${ids}` : '#/comparar');
  };

  renderPicker();
  draw();

  document.getElementById('picker').addEventListener('change', (e) => {
    const ref = e.target.dataset.ref;
    if (!ref) return;
    if (e.target.checked) {
      if (state.selected.size >= MAX_COMPARE) {
        e.target.checked = false;
        toast(`Máximo de ${MAX_COMPARE} canais por comparação.`);
        return;
      }
      state.selected.add(ref);
    } else state.selected.delete(ref);
    renderPicker();
    draw();
  });
  document.getElementById('cmpQ').addEventListener('input', (e) => {
    C.q = e.target.value;
    renderPicker();
  });
  document.getElementById('cmpClear').addEventListener('click', () => {
    state.selected.clear();
    renderPicker();
    draw();
  });
  for (const [id, key] of [['cmpMetric', 'metric'], ['cmpMode', 'mode']]) {
    document.getElementById(id).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      C[key] = key === 'metric' ? Number(b.dataset.v) : b.dataset.v;
      document.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    });
  }
}

function renderCmpTable(chosen, colorOf) {
  const t = document.getElementById('cmpTable');
  if (!chosen.length) {
    t.innerHTML = '';
    return;
  }
  const lines = [
    ['Nichos', (r) => (r.channel.tags ?? []).map((x) => `<span class="tag">${esc(x)}</span>`).join(' ') || '—', false],
    ['Inscritos', (r) => fmtN(r.metrics.subs)],
    ['Crescimento / mês', (r) => `<span class="${signClass(r.metrics.momentum)}">${fmtPct(r.metrics.momentum)}</span>`],
    ['Δ inscritos 7 dias', (r) => fmtSigned(r.metrics.g7?.dSubs)],
    ['Δ inscritos 30 dias', (r) => fmtSigned(r.metrics.dSubs30)],
    ['Views / dia', (r) => fmtN(r.metrics.viewsPerDay)],
    ['Views totais', (r) => fmtN(r.metrics.views)],
    ['Views / vídeo', (r) => fmtN(r.metrics.viewsPerVideo)],
    ['Vídeos', (r) => fmtInt(r.metrics.videos)],
    ['Último upload', (r) => fmtAgo(r.metrics.daysSinceUpload)],
    ['Idade do canal', (r) => fmtAge(r.metrics.ageDays)],
    ['Inscritos / mês de vida', (r) => fmtN(r.metrics.lifetimeSubsPerMonth)],
    ['Dias de histórico', (r) => fmtInt(r.metrics.historyDays)],
  ];
  t.innerHTML = `<thead><tr><th></th>${chosen
    .map((r) => `<th><span class="swatch" style="background:${colorOf(r.ref)}"></span> <a href="${channelHref(r)}">${esc(r.title)}</a>${r.rising ? ' <span class="badge-rise">▲</span>' : ''}</th>`)
    .join('')}</tr></thead><tbody>${lines
    .map(([label, fn, num = true]) => `<tr><th scope="row">${label}</th>${chosen.map((r) => `<td class="${num ? 'num' : ''}">${fn(r)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
}

/* ---------- Canal ---------- */

function renderChannel(ref) {
  const r = state.rows.find((x) => x.ref === ref || x.id === ref);
  if (!r) {
    app.innerHTML = '<div class="card empty"><h1>Canal não encontrado</h1><p><a href="#/">Voltar ao painel</a></p></div>';
    return;
  }
  const m = r.metrics;
  const ytUrl = r.id ? `https://www.youtube.com/channel/${r.id}` : null;
  const editable = canWrite(state.cfg);
  app.innerHTML = `
    <div class="chan-head">
      ${r.meta.thumbnail ? `<img src="${esc(r.meta.thumbnail)}" alt="" referrerpolicy="no-referrer">` : ''}
      <div style="min-width:0">
        <h1>${esc(r.title)} ${r.rising ? '<span class="badge-rise">▲ pequeno em alta</span>' : ''}</h1>
        <div class="meta">
          ${r.meta.handle ? `<span>${esc(r.meta.handle)}</span>` : ''}
          ${ytUrl ? `<a href="${ytUrl}" target="_blank" rel="noopener">Abrir no YouTube ↗</a>` : ''}
          ${r.meta.country ? `<span>${esc(r.meta.country)}</span>` : ''}
          ${r.meta.publishedAt ? `<span>criado em ${fmtDate(r.meta.publishedAt)}</span>` : ''}
          <span class="chips">${(r.channel.tags ?? []).map((t) => `<a class="tag" href="#/?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</span>
        </div>
      </div>
    </div>
    ${r.error ? `<div class="notice">Erro na coleta: ${esc(r.error)}</div>` : ''}
    ${!r.hist.length && !r.error ? '<div class="notice">Este canal ainda não foi coletado. Os dados aparecem depois da próxima execução da coleta.</div>' : ''}
    <div class="kpis">
      ${kpi('Inscritos', r.meta.hiddenSubscribers ? 'oculto' : fmtN(m.subs), m.subs != null ? fmtInt(m.subs) : '')}
      ${kpi('Crescimento / mês', `<span class="${signClass(m.momentum)}">${fmtPct(m.momentum)}</span>`, m.g30 ? `${fmtSigned(m.dSubs30)} em ${m.g30.span} dias` : 'precisa de histórico')}
      ${kpi('Δ inscritos 7 dias', `<span class="${signClass(m.g7?.dSubs)}">${fmtSigned(m.g7?.dSubs)}</span>`, m.g7 ? `${fmtPct(m.g7.pctSubs)} no período` : '')}
      ${kpi('Views / dia', fmtN(m.viewsPerDay), `${fmtN(m.views)} no total`)}
      ${kpi('Vídeos', fmtInt(m.videos), m.g30?.dVideos ? `+${m.g30.dVideos} no período` : '')}
      ${kpi('Views / vídeo', fmtN(m.viewsPerVideo), m.viewsPerSub ? `${fmtN(m.viewsPerSub)} views por inscrito` : '')}
      ${kpi('Último upload', fmtAgo(m.daysSinceUpload), fmtDate(m.lastUpload))}
      ${kpi('Inscritos / mês de vida', fmtN(m.lifetimeSubsPerMonth), `idade ${fmtAge(m.ageDays)}`)}
    </div>
    <div class="grid-2">
      <section class="card"><h2>Inscritos</h2><div class="chart-box short"><canvas id="cSubs" role="img" aria-label="Inscritos ao longo do tempo"></canvas></div></section>
      <section class="card"><h2>Views totais</h2><div class="chart-box short"><canvas id="cViews" role="img" aria-label="Views totais ao longo do tempo"></canvas></div></section>
      <section class="card"><h2>Novos inscritos por dia</h2><div class="chart-box short"><canvas id="cDaily" role="img" aria-label="Novos inscritos por dia"></canvas></div></section>
      <section class="card"><h2>Novas views por dia</h2><div class="chart-box short"><canvas id="cDailyViews" role="img" aria-label="Novas views por dia"></canvas></div></section>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2 style="margin-bottom:10px">Nichos e notas</h2>
        ${
          editable
            ? `<form id="editForm">
            <label class="field">Tags de nicho (separadas por vírgula)
              <input name="tags" list="tagList" value="${esc((r.channel.tags ?? []).join(', '))}"></label>
            <datalist id="tagList">${allTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
            <label class="field" style="margin-top:10px">Notas pessoais
              <textarea name="notes" rows="6">${esc(r.channel.notes ?? '')}</textarea></label>
            <div style="margin-top:10px;display:flex;gap:8px"><button class="primary" type="submit">Salvar</button></div>
          </form>`
            : `<p class="notes-view">${esc(r.channel.notes || 'Sem notas.')}</p>
            <p class="muted small">Para editar pelo site, conecte o GitHub em <a href="#/gerenciar">Gerenciar</a>.</p>`
        }
      </section>
      <section class="card">
        <h2 style="margin-bottom:10px">Histórico</h2>
        ${historyTable(r.hist)}
      </section>
    </div>`;

  if (r.hist.length) {
    const labels = r.hist.map((h) => h[0]);
    lineChart(document.getElementById('cSubs'), { labels, datasets: [{ label: 'Inscritos', data: r.hist.map((h) => h[1]) }] });
    lineChart(document.getElementById('cViews'), { labels, datasets: [{ label: 'Views', data: r.hist.map((h) => h[2]) }] });
    const daily = (col) =>
      r.hist.slice(1).map((h, i) => {
        const prev = r.hist[i];
        const span = daysBetween(prev[0], h[0]) || 1;
        return h[col] != null && prev[col] != null ? (h[col] - prev[col]) / span : null;
      });
    if (r.hist.length > 1) {
      const dl = labels.slice(1);
      lineChart(document.getElementById('cDaily'), { type: 'bar', labels: dl, datasets: [{ label: 'Novos inscritos', data: daily(1) }], yFormat: fmtSigned });
      lineChart(document.getElementById('cDailyViews'), { type: 'bar', labels: dl, datasets: [{ label: 'Novas views', data: daily(2) }], yFormat: fmtSigned });
    }
  }

  document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tags = normTags(fd.get('tags'));
    const notes = String(fd.get('notes')).trim();
    await saveCatalog(`Atualiza tags/notas de ${r.title}`, (doc) => {
      const c = doc.channels.find((x) => x.ref === r.ref);
      if (c) Object.assign(c, { tags, notes });
    });
  });
}

const kpi = (label, value, sub = '') =>
  `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;

function historyTable(hist) {
  if (!hist.length) return '<p class="muted">Sem coletas ainda.</p>';
  const rows = [...hist].reverse().slice(0, 60);
  return `<div class="table-wrap" style="max-height:340px;overflow-y:auto"><table>
    <thead><tr><th>Data</th><th class="num">Inscritos</th><th class="num">Views</th><th class="num">Vídeos</th><th class="num">Último upload</th></tr></thead>
    <tbody>${rows
      .map((h) => `<tr><td>${fmtDate(h[0])}</td><td class="num">${fmtInt(h[1])}</td><td class="num">${fmtInt(h[2])}</td><td class="num">${fmtInt(h[3])}</td><td class="num">${fmtDate(h[4])}</td></tr>`)
      .join('')}</tbody></table></div>
    ${hist.length > 60 ? `<p class="muted small">Mostrando as 60 coletas mais recentes de ${hist.length}.</p>` : ''}`;
}

/* ---------- Gerenciar ---------- */

async function saveCatalog(message, mutate) {
  if (!canWrite(state.cfg)) {
    toast('Conecte o GitHub em Gerenciar para salvar.', true);
    return false;
  }
  try {
    state.doc = await updateChannelsDoc(state.cfg, message, mutate);
    buildRows();
    toast('Salvo no repositório.');
    route();
    return true;
  } catch (err) {
    toast(`Erro ao salvar: ${err.message}`, true);
    return false;
  }
}

function renderManage() {
  const cfg = state.cfg;
  const editable = canWrite(cfg);
  const errors = state.rows.filter((r) => r.status === 'erro');
  const pending = state.rows.filter((r) => r.status === 'pendente');
  app.innerHTML = `
    <div class="page-head"><div><h1>Gerenciar</h1><p>Catálogo de canais, nichos e notas. Tudo fica salvo no repositório do GitHub.</p></div>
      ${editable ? '<button type="button" id="runNow">Coletar agora</button>' : ''}</div>

    ${!editable ? `<div class="notice">Modo somente leitura. Conecte o GitHub abaixo para adicionar canais e editar tags/notas pelo site.</div>` : ''}
    ${pending.length ? `<div class="notice">${pending.length} canal(is) aguardando a primeira coleta. Ela roda sozinha ao salvar o catálogo e todo dia; leva 1–3 minutos para aparecer aqui.</div>` : ''}
    ${errors.length ? `<div class="notice"><strong>Canais com erro na coleta:</strong><ul style="margin:6px 0 0">${errors.map((r) => `<li><code>${esc(r.ref)}</code> — ${esc(r.error)}</li>`).join('')}</ul></div>` : ''}

    <section class="card">
      <h2 style="margin-bottom:10px">Adicionar canais</h2>
      <form id="addForm">
        <label class="field">Um por linha: @handle, URL do canal, URL de um vídeo do canal ou ID (UC…)
          <textarea name="refs" rows="4" placeholder="@canalexemplo&#10;https://www.youtube.com/@outrocanal&#10;https://youtu.be/ID_DO_VIDEO" required></textarea></label>
        <div class="form-grid" style="margin-top:10px">
          <label class="field">Tags de nicho (vírgula)<input name="tags" list="tagList2" placeholder="finanças, investimentos"></label>
          <label class="field">Nota inicial (opcional)<input name="notes"></label>
        </div>
        <datalist id="tagList2">${allTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
        <button class="primary" type="submit"${editable ? '' : ' disabled'}>Adicionar</button>
      </form>
    </section>

    <section class="card">
      <div class="card-head"><h2>Catálogo (${state.rows.length})</h2>
        <input type="search" id="mq" placeholder="Filtrar…" aria-label="Filtrar catálogo"></div>
      <div id="manageList"></div>
    </section>

    <section class="card">
      <h2 style="margin-bottom:10px">Conexão com o GitHub</h2>
      <form id="cfgForm">
        <div class="form-grid">
          <label class="field">Dono (usuário)<input name="owner" value="${esc(cfg.owner)}" required></label>
          <label class="field">Repositório<input name="repo" value="${esc(cfg.repo)}" required></label>
          <label class="field">Branch<input name="branch" value="${esc(cfg.branch)}" required></label>
          <label class="field">Token pessoal<input name="token" type="password" value="${esc(cfg.token)}" autocomplete="off" placeholder="github_pat_…"></label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="primary" type="submit">Salvar e testar</button>
          ${cfg.token ? '<button type="button" id="forget" class="danger">Esquecer token</button>' : ''}
        </div>
      </form>
      <details style="margin-top:12px"><summary>Como criar o token</summary>
        <ol class="steps">
          <li>GitHub → Settings → Developer settings → <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained tokens → Generate new token</a>.</li>
          <li>Repository access: <em>Only select repositories</em> → este repositório.</li>
          <li>Permissions: <strong>Contents: Read and write</strong> e <strong>Actions: Read and write</strong> (para o botão “Coletar agora”).</li>
          <li>Cole aqui. O token fica salvo só neste navegador (localStorage) e é enviado apenas para api.github.com.</li>
        </ol>
      </details>
    </section>

    <section class="card">
      <h2 style="margin-bottom:10px">Critério de “pequeno em alta”</h2>
      <form id="prefForm" class="toolbar" style="margin:0">
        <label class="inline">Máx. inscritos <input type="number" name="maxSubs" min="0" step="1000" value="${state.rising.maxSubs}" style="width:120px"></label>
        <label class="inline">Mín. inscritos <input type="number" name="minSubs" min="0" step="100" value="${state.rising.minSubs}" style="width:100px"></label>
        <label class="inline">Crescimento mín. <input type="number" name="minPct" min="0" step="1" value="${Math.round(state.rising.minMonthlyPct * 100)}" style="width:80px"> %/mês</label>
        <button type="submit">Salvar</button>
      </form>
    </section>`;

  const renderList = (q = '') => {
    const ql = q.trim().toLowerCase();
    const rows = state.rows
      .filter((r) => !ql || `${r.title} ${r.ref} ${(r.channel.tags ?? []).join(' ')}`.toLowerCase().includes(ql))
      .sort((a, b) => a.title.localeCompare(b.title));
    document.getElementById('manageList').innerHTML =
      rows
        .map(
          (r) => `<form class="manage-row" data-ref="${esc(r.ref)}">
        <div>${chanCell(r, { tags: false })}
          <div class="muted small" style="margin-top:4px"><code>${esc(r.ref)}</code>
          ${r.status === 'ok' ? '' : `<span class="status${r.status === 'erro' ? ' err' : ''}">${r.status === 'erro' ? 'erro' : 'aguardando coleta'}</span>`}</div></div>
        <label class="field">Tags<input name="tags" list="tagList2" value="${esc((r.channel.tags ?? []).join(', '))}"${editable ? '' : ' readonly'}></label>
        <label class="field">Notas<textarea name="notes" rows="2"${editable ? '' : ' readonly'}>${esc(r.channel.notes ?? '')}</textarea></label>
        <div class="actions" style="align-self:end">${
          editable ? '<button type="submit">Salvar</button><button type="button" class="danger" data-remove="1" aria-label="Remover">Remover</button>' : ''
        }</div>
      </form>`,
        )
        .join('') || '<p class="muted">Nenhum canal.</p>';
  };
  renderList();
  document.getElementById('mq').addEventListener('input', (e) => renderList(e.target.value));

  document.getElementById('manageList').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const ref = form.dataset.ref;
    const fd = new FormData(form);
    await saveCatalog(`Atualiza tags/notas de ${ref}`, (doc) => {
      const c = doc.channels.find((x) => x.ref === ref);
      if (c) Object.assign(c, { tags: normTags(fd.get('tags')), notes: String(fd.get('notes')).trim() });
    });
  });
  document.getElementById('manageList').addEventListener('click', async (e) => {
    if (!e.target.dataset.remove) return;
    const ref = e.target.closest('form').dataset.ref;
    const row = state.rows.find((r) => r.ref === ref);
    if (!confirm(`Remover “${row?.title ?? ref}” do catálogo? O histórico já coletado continua guardado.`)) return;
    await saveCatalog(`Remove canal ${ref}`, (doc) => {
      doc.channels = doc.channels.filter((x) => x.ref !== ref);
    });
  });

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const refs = [...new Set(String(fd.get('refs')).split('\n').map((s) => s.trim()).filter(Boolean))];
    const tags = normTags(fd.get('tags'));
    const notes = String(fd.get('notes') ?? '').trim();
    const today = new Date().toISOString().slice(0, 10);
    const known = new Set(state.rows.flatMap((r) => [r.ref, r.id]).filter(Boolean));
    const fresh = refs.filter((ref) => !known.has(ref) && !known.has(state.stats.resolve?.[ref]));
    if (!fresh.length) {
      toast('Esses canais já estão no catálogo.');
      return;
    }
    const ok = await saveCatalog(`Adiciona ${fresh.length} canal(is)`, (doc) => {
      const existing = new Set(doc.channels.map((c) => c.ref));
      for (const ref of fresh) if (!existing.has(ref)) doc.channels.push({ ref, tags, notes, addedAt: today });
    });
    if (ok && fresh.length < refs.length) toast(`${refs.length - fresh.length} já estavam no catálogo e foram ignorados.`);
  });

  document.getElementById('cfgForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.cfg = {
      owner: String(fd.get('owner')).trim(),
      repo: String(fd.get('repo')).trim(),
      branch: String(fd.get('branch')).trim() || 'main',
      token: String(fd.get('token')).trim(),
    };
    saveConfig(state.cfg);
    if (!canWrite(state.cfg)) {
      toast('Configuração salva (sem token: somente leitura).');
      route();
      return;
    }
    try {
      state.doc = (await fetchChannelsDoc(state.cfg)).doc;
      buildRows();
      toast('Conectado! Agora você pode editar pelo site.');
    } catch (err) {
      toast(`Falha ao conectar: ${err.message}`, true);
    }
    route();
  });
  document.getElementById('forget')?.addEventListener('click', () => {
    state.cfg = { ...state.cfg, token: '' };
    saveConfig(state.cfg);
    toast('Token removido deste navegador.');
    route();
  });
  document.getElementById('runNow')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await triggerCollect(state.cfg);
      toast('Coleta iniciada. Os dados aparecem em alguns minutos.');
    } catch (err) {
      toast(`Não foi possível iniciar: ${err.message}`, true);
      e.target.disabled = false;
    }
  });
  document.getElementById('prefForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.rising = {
      maxSubs: Math.max(0, Number(fd.get('maxSubs')) || DEFAULT_RISING.maxSubs),
      minSubs: Math.max(0, Number(fd.get('minSubs')) || 0),
      minMonthlyPct: Math.max(0, Number(fd.get('minPct')) || 0) / 100,
    };
    savePrefs();
    buildRows();
    toast('Critério salvo neste navegador.');
  });
}

/* ---------- início ---------- */

window.addEventListener('hashchange', route);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', route);

loadData()
  .then(() => {
    // O Chart.js carrega com defer; garante que existe antes do primeiro desenho.
    if (window.Chart || document.readyState === 'complete') return;
    return new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  })
  .then(() => {
    if (window.Chart) window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    route();
  })
  .catch((err) => {
    app.innerHTML = `<div class="card empty"><h1>Erro ao carregar os dados</h1><p>${esc(err.message)}</p></div>`;
  });
