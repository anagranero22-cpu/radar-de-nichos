// Página Início / Favoritos: feed de descoberta com filtros laterais, abas,
// destaque do radar e cards de canal com mini-gráficos.

import { esc, fmtN, fmtInt, fmtPct, fmtUSD, fmtAgo, fmtAge, countryName, languageName, signClass } from './format.js';
import { CPM_TIERS } from './insights.js';
import { tagsOf } from './metrics.js';
import { sparkArea, viewsBars, scoreMeter, formatSplit, videoThumb, bindTooltips } from './minicharts.js';

const PAGE = 20;

const ex = {
  tab: 'todos',
  niches: new Set(),
  countries: new Set(),
  languages: new Set(),
  size: 'all',
  cpm: new Set(),
  format: 'all',
  sort: 'score',
  random: false,
  seed: 1,
  view: loadView(),
  nicheQ: '',
  limit: PAGE,
  spot: 0,
};

function loadView() {
  try {
    return localStorage.getItem('radar.view') ?? 'list';
  } catch {
    return 'list';
  }
}
function saveView() {
  try {
    localStorage.setItem('radar.view', ex.view);
  } catch {
    /* sem armazenamento */
  }
}

const SIZES = {
  all: 'Todos',
  xs: ['Até 1 mil', 0, 1e3],
  s: ['1–10 mil', 1e3, 1e4],
  m: ['10–100 mil', 1e4, 1e5],
  l: ['100 mil–1 mi', 1e5, 1e6],
  xl: ['+1 mi', 1e6, Infinity],
};

const FORMATS = { all: 'Todos', long: 'Longos', shorts: 'Shorts', mix: 'Misto' };

const TABS = [
  { key: 'todos', label: 'Todos os canais', test: () => true },
  { key: 'pick', label: '★ Canais que eu faria', test: (r) => r.pick, cls: 'tab-pick' },
  { key: 'testar', label: 'Eu testaria agora', test: (r) => r.verdict.key === 'testar' },
  { key: 'alta', label: 'Em alta', test: (r, ctx) => r.metrics.momentum != null && r.metrics.momentum >= ctx.rising.minMonthlyPct },
  { key: 'virais', label: 'Virais', test: (r) => (r.rs.viewsPerSub ?? 0) >= 1 || (r.rs.outlierRatio ?? 0) >= 3 },
  { key: 'novos', label: 'Canais novos', test: (r) => r.metrics.ageDays != null && r.metrics.ageDays <= 365 },
  { key: 'cpm', label: 'CPM: Alto', test: (r) => r.cpm.tier === 'alto' },
];

const SORTS = {
  score: ['Score de oportunidade', (r) => r.score.score, -1],
  momentum: ['Crescimento / mês', (r) => r.metrics.momentum, -1],
  traction: ['Views por inscrito', (r) => r.rs.viewsPerSub, -1],
  earnings: ['Ganhos estimados', (r) => r.earnings.max, -1],
  small: ['Menos inscritos', (r) => r.metrics.subs, 1],
  recent: ['Adicionados recentemente', (r) => r.channel.addedAt ?? '', -1],
};

function formatOf(r) {
  const s = r.rs.shortsShare;
  if (s == null) return null;
  return s >= 0.6 ? 'shorts' : s <= 0.2 ? 'long' : 'mix';
}

// Filtros da lateral (tudo menos a aba).
function sideFilter(rows) {
  const [, min, max] = Array.isArray(SIZES[ex.size]) ? SIZES[ex.size] : [0, 0, Infinity];
  return rows.filter((r) => {
    if (ex.niches.size && !tagsOf(r).some((t) => ex.niches.has(t))) return false;
    if (ex.countries.size && !ex.countries.has(r.meta.country ?? '—')) return false;
    if (ex.languages.size && !ex.languages.has(r.language ?? '—')) return false;
    if (ex.size !== 'all' && (r.metrics.subs == null || r.metrics.subs < min || r.metrics.subs >= max)) return false;
    if (ex.cpm.size && !ex.cpm.has(r.cpm.tier)) return false;
    if (ex.format !== 'all' && formatOf(r) !== ex.format) return false;
    return true;
  });
}

function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortRows(rows) {
  if (ex.random) return seededShuffle(rows, ex.seed);
  const [, get, dir] = SORTS[ex.sort];
  return rows.slice().sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
}

const channelHref = (r) => `#/canal/${encodeURIComponent(r.ref)}`;

const ICONS = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6v6H4zM14 6h6M14 10h6M4 14h6v6H4zM14 15h6M14 19h6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v16H4zM13 4h7v16h-7z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4h4v4M20 4l-6 6M4 20l6-6M16 20h4v-4M20 20L4 4"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

/* ---------- partes do card ---------- */

function strip(r, ctx, compact = false) {
  const niche = tagsOf(r).join(', ');
  const e = r.earnings;
  const money =
    e.max == null
      ? '—'
      : compact
        ? `${fmtUSD(e.min)}–${fmtUSD(e.max).replace(/^US\$\s?/, '')}`
        : `${fmtUSD(e.min)} – ${fmtUSD(e.max)}`;
  const cpmTitle = `Faixa de CPM ${r.cpm.source === 'manual' ? 'definida por você' : r.cpm.source === 'automático' ? 'sugerida pelo nome do nicho' : 'padrão (defina em Gerenciar)'}`;
  return `<header class="cc-strip">
    <div class="cc-strip-text">
      ${compact ? '' : `<span${r.tagsAuto ? ` title="Nicho detectado automaticamente (confiança ${esc(r.autoNiche.confidence)})"` : ''}>Nicho: <b>${esc(niche)}</b>${r.tagsAuto ? ' <em class="auto-mark">✦ auto</em>' : ''}</span><i>|</i>`}
      ${r.language ? `<span>${compact ? '' : 'Idioma: '}<b>${esc(languageName(r.language))}</b></span><i>|</i>` : ''}
      <span title="${esc(cpmTitle)}">CPM: <b>${CPM_TIERS[r.cpm.tier].label}</b></span><i>|</i>
      <span title="${esc(e.basis ? `Views/mês por ${e.basis} × RPM da faixa de CPM (estimativa)` : 'Sem dados de views ainda')}">${compact ? `<b>${money}</b>/mês` : `Ganhos mensais est.: <b>${money}</b> (estimativa)`}</span>
    </div>
    <div class="cc-actions">
      <button type="button" class="icon-btn pick" data-act="pick" aria-pressed="${r.pick}" aria-label="Canal que eu faria" data-tip="Marcar como “eu faria”">${ICONS.star}</button>
      ${ctx.canEdit ? `<a class="btn icon-btn" href="${channelHref(r)}" aria-label="Editar tags e notas" data-tip="Editar tags e notas">${ICONS.edit}</a>` : ''}
      ${ctx.canEdit ? `<button type="button" class="icon-btn" data-act="remove" aria-label="Remover do catálogo" data-tip="Remover do catálogo">${ICONS.trash}</button>` : ''}
      <button type="button" class="icon-btn fav" data-act="favorite" aria-pressed="${r.favorite}" aria-label="Favorito" data-tip="Favoritar">${ICONS.heart}</button>
    </div>
  </header>`;
}

export function tagChips(r, max = 99, cls = 'tag') {
  return (r.tags ?? [])
    .slice(0, max)
    .map((t) =>
      r.tagsAuto
        ? `<span class="${cls} tag-auto" title="Nicho detectado automaticamente (confiança ${esc(r.autoNiche.confidence)})">✦ ${esc(t)}</span>`
        : `<span class="${cls}">${esc(t)}</span>`,
    )
    .join('');
}

function avatar(r, size) {
  return r.meta.thumbnail
    ? `<img class="cc-avatar" style="width:${size}px;height:${size}px" src="${esc(r.meta.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="cc-avatar cc-avatar-empty" style="width:${size}px;height:${size}px">${esc(r.title.replace(/^@/, '').slice(0, 1).toUpperCase())}</span>`;
}

function verdictBadge(r) {
  return `<span class="verdict v-${r.verdict.key}"><i></i>${r.verdict.label}</span>`;
}

function identityLine(r) {
  const m = r.metrics;
  return [
    r.meta.handle ? esc(r.meta.handle) : null,
    r.meta.hiddenSubscribers ? 'inscritos ocultos' : m.subs != null ? `${fmtN(m.subs)} inscritos` : null,
    m.videos != null ? `${fmtInt(m.videos)} vídeos` : null,
    m.views != null ? `${fmtN(m.views)} views` : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function signals(r) {
  const m = r.metrics;
  const rs = r.rs;
  const item = (label, value, tip, cls = '') => `<div class="sig" data-tip="${esc(tip)}"><span>${label}</span><b class="${cls}">${value}</b></div>`;
  return `<div class="sigs">
    ${item('Views / inscrito', rs.viewsPerSub != null ? `${rs.viewsPerSub.toFixed(2).replace('.', ',')}×` : '—', 'Mediana de views dos vídeos recentes dividida pelos inscritos. Acima de 1× = alcance além da base.')}
    ${item('Crescimento / mês', fmtPct(m.momentum), 'Variação de inscritos normalizada para 30 dias', signClass(m.momentum))}
    ${item('Vídeos / semana', rs.perWeek != null ? rs.perWeek.toFixed(1).replace('.', ',') : '—', 'Cadência entre os vídeos recentes')}
    ${item('Último upload', fmtAgo(m.daysSinceUpload), 'Data do vídeo mais recente')}
  </div>`;
}

function cardList(r, ctx) {
  const m = r.metrics;
  const rs = r.rs;
  const hist90 = r.hist.slice(-90).map((h) => [h[0], h[1]]);
  const pending = r.status !== 'ok';
  const banner = r.meta.banner
    ? `<div class="cc-banner"><img src="${esc(r.meta.banner)}=w1280-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>`
    : '';
  return `<article class="ccard" data-ref="${esc(r.ref)}">
    ${strip(r, ctx)}
    <div class="cc-main">
      ${banner}
      <div class="cc-id">
        ${avatar(r, 88)}
        <div class="cc-id-text">
          <h3><a href="${channelHref(r)}">${esc(r.title)}</a></h3>
          <div class="cc-sub">${identityLine(r)}</div>
          ${r.meta.description ? `<p class="cc-desc">${esc(r.meta.description)}</p>` : ''}
          <div class="cc-badges">
            ${pending ? `<span class="status${r.status === 'erro' ? ' err' : ''}">${r.status === 'erro' ? `erro: ${esc(r.error)}` : 'aguardando coleta'}</span>` : verdictBadge(r)}
            ${r.rising ? '<span class="badge-rise">▲ pequeno em alta</span>' : ''}
            ${r.meta.country ? `<span class="tag">${esc(countryName(r.meta.country))}</span>` : ''}
            ${m.ageDays != null ? `<span class="tag">canal com ${fmtAge(m.ageDays)}</span>` : ''}
            ${r.id ? `<a class="tag tag-link" href="https://www.youtube.com/channel/${esc(r.id)}" target="_blank" rel="noopener">Abrir no YouTube ↗</a>` : ''}
          </div>
        </div>
      </div>
      ${
        r.meta.recent?.length
          ? `<div class="cc-videos">${r.meta.recent.slice(0, 4).map((v) => videoThumb(v, rs.median)).join('')}</div>`
          : ''
      }
    </div>
    ${
      pending
        ? ''
        : `<div class="cc-panels">
      <section class="cc-panel">
        <div class="cc-panel-head"><h4>Inscritos</h4><span class="${signClass(m.dSubs30)}">${m.g30 ? `${fmtPct(m.g30.pctSubs)} em ${m.g30.span} d` : ''}</span></div>
        <div class="cc-big">${r.meta.hiddenSubscribers ? 'oculto' : fmtN(m.subs)}</div>
        ${sparkArea(hist90)}
      </section>
      <section class="cc-panel">
        <div class="cc-panel-head"><h4>Views dos últimos vídeos</h4><span>mediana ${fmtN(rs.median)}</span></div>
        <div class="cc-big">${rs.top ? fmtN(rs.top.v) : '—'} <small>pico</small></div>
        ${viewsBars(r.meta.recent ?? [], rs.median)}
        ${formatSplit(rs.shortsShare)}
      </section>
      <section class="cc-panel">
        <div class="cc-panel-head"><h4>Sinais de oportunidade</h4>${verdictBadge(r)}</div>
        ${scoreMeter(r.score.score, r.verdict.key)}
        ${signals(r)}
      </section>
    </div>`
    }
    <footer class="cc-foot">
      ${!pending ? `<p class="cc-thesis">${esc(r.thesis)}</p>` : ''}
      ${r.channel.notes ? `<p class="cc-note"><b>Sua nota:</b> ${esc(r.channel.notes)}</p>` : ''}
      <a class="cc-more" href="${channelHref(r)}">Ver análise completa ${ICONS.arrow}</a>
    </footer>
  </article>`;
}

function cardGrid(r, ctx) {
  const m = r.metrics;
  const hist90 = r.hist.slice(-90).map((h) => [h[0], h[1]]);
  const pending = r.status !== 'ok';
  return `<article class="ccard ccard-grid" data-ref="${esc(r.ref)}">
    ${strip(r, ctx, true)}
    <div class="cc-main">
      <div class="cc-id">
        ${avatar(r, 52)}
        <div class="cc-id-text">
          <h3><a href="${channelHref(r)}">${esc(r.title)}</a></h3>
          <div class="cc-sub">${identityLine(r)}</div>
        </div>
      </div>
      <div class="cc-badges">${pending ? `<span class="status">${r.status === 'erro' ? 'erro' : 'aguardando coleta'}</span>` : verdictBadge(r)}
        ${tagChips(r, 3)}
        ${r.language ? `<span class="tag tag-lang">${esc(languageName(r.language))}</span>` : ''}</div>
      ${
        pending
          ? ''
          : `<div class="cc-mini">
        <div><div class="cc-panel-head"><h4>Inscritos · ${r.meta.hiddenSubscribers ? 'oculto' : fmtN(m.subs)}</h4><span class="${signClass(m.momentum)}">${fmtPct(m.momentum)}/mês</span></div>${sparkArea(hist90, { h: 44 })}</div>
        <div><div class="cc-panel-head"><h4>Views recentes</h4><span>mediana ${fmtN(r.rs.median)}</span></div>${viewsBars(r.meta.recent ?? [], r.rs.median, { h: 44 })}</div>
      </div>
      ${scoreMeter(r.score.score, r.verdict.key)}`
      }
    </div>
  </article>`;
}

/* ---------- destaque ---------- */

function spotlight(cands) {
  if (!cands.length) return '';
  const i = ex.spot % cands.length;
  const r = cands[i];
  return `<section class="spot" aria-label="Destaque do radar">
    <div class="spot-body">
      <div class="spot-pills"><span class="spot-pill">✦ Radar de oportunidade • ${esc(r.verdict.label)}</span>
        ${(r.tags ?? []).slice(0, 2).map((t) => `<span class="spot-tag">${r.tagsAuto ? '✦ ' : ''}${esc(t)}</span>`).join('')}
        ${r.language ? `<span class="spot-tag">${esc(languageName(r.language))}</span>` : ''}</div>
      <h2><a href="#/canal/${encodeURIComponent(r.ref)}">${esc(r.title)}</a> <span class="verdict v-${r.verdict.key}"><i></i>${r.verdict.label}</span></h2>
      <p class="spot-thesis">${esc(r.thesis)}</p>
    </div>
    <div class="spot-side">
      <div class="spot-score"><b>${r.score.score}</b><span>/100</span></div>
      <a class="btn spot-btn" href="#/canal/${encodeURIComponent(r.ref)}">Ver tese completa ${ICONS.arrow}</a>
      ${cands.length > 1 ? `<button type="button" class="spot-next" id="spotNext" aria-label="Próximo destaque">${i + 1}/${cands.length} ${ICONS.next}</button>` : ''}
    </div>
  </section>`;
}

/* ---------- lateral ---------- */

function sidebar(rows) {
  const nicheCounts = new Map();
  for (const r of rows) for (const t of tagsOf(r)) nicheCounts.set(t, (nicheCounts.get(t) ?? 0) + 1);
  const niches = [...nicheCounts].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  const countries = new Map();
  for (const r of rows) {
    const c = r.meta.country ?? '—';
    countries.set(c, (countries.get(c) ?? 0) + 1);
  }
  const countryList = [...countries].sort((a, b) => b[1] - a[1]);
  const languages = new Map();
  for (const r of rows) {
    const l = r.language ?? '—';
    languages.set(l, (languages.get(l) ?? 0) + 1);
  }
  const languageList = [...languages].sort((a, b) => b[1] - a[1]);
  const active =
    ex.niches.size + ex.countries.size + ex.languages.size + ex.cpm.size + (ex.size !== 'all') + (ex.format !== 'all');
  const chip = (group, value, label, on) =>
    `<button type="button" class="fchip" data-group="${group}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
  return `<aside class="ex-side"><details class="fall" open>
    <summary class="fall-sum">Filtros${active ? ` <span class="fcount">${active}</span>` : ''}</summary>
    <div class="fall-body">
    <div class="fbox">
      <div class="fbox-head"><h3>Nichos</h3>${active ? `<span class="fcount">${active} filtro${active > 1 ? 's' : ''}</span>` : ''}</div>
      <p class="muted small">Marque um ou mais nichos para ver só os canais ligados a eles.</p>
      <label class="fsearch">${ICONS.search}<input type="search" id="nicheQ" placeholder="Buscar nicho…" value="${esc(ex.nicheQ)}" aria-label="Buscar nicho"></label>
      <div class="fniches" id="nicheList">
        ${niches
          .map(
            ([t, n]) => `<label class="fniche" data-name="${esc(t.toLowerCase())}"><input type="checkbox" value="${esc(t)}"${ex.niches.has(t) ? ' checked' : ''}><span>${esc(t)}</span><em>${n}</em></label>`,
          )
          .join('') || '<p class="muted small">Nenhum nicho ainda.</p>'}
      </div>
    </div>
    <div class="fbox">
      <h4>Idioma</h4>
      <div class="fchips">${languageList.map(([l, n]) => chip('languages', l, `${l === '—' ? 'Não detectado' : languageName(l)} · ${n}`, ex.languages.has(l))).join('')}</div>
    </div>
    <div class="fbox">
      <h4>País do canal</h4>
      <div class="fchips">${countryList.map(([c]) => chip('countries', c, c === '—' ? 'Não informado' : countryName(c), ex.countries.has(c))).join('')}</div>
    </div>
    <div class="fbox">
      <h4>Tamanho</h4>
      <div class="fchips">${Object.entries(SIZES).map(([k, v]) => chip('size', k, Array.isArray(v) ? v[0] : v, ex.size === k)).join('')}</div>
    </div>
    <div class="fbox">
      <h4>Faixa de CPM</h4>
      <div class="fchips">${Object.entries(CPM_TIERS).map(([k, v]) => chip('cpm', k, v.label, ex.cpm.has(k))).join('')}</div>
    </div>
    <div class="fbox">
      <h4>Formato</h4>
      <div class="fchips">${Object.entries(FORMATS).map(([k, v]) => chip('format', k, v, ex.format === k)).join('')}</div>
    </div>
    ${active ? '<button type="button" class="fclear" id="clearFilters">Limpar filtros</button>' : ''}
    </div></details></aside>`;
}

/* ---------- página ---------- */

export function renderExplore(ctx, { favoritesOnly = false, params } = {}) {
  const { app } = ctx;
  if (params?.get('tag')) {
    ex.niches = new Set([params.get('tag')]);
    ex.tab = 'todos';
  }
  ex.limit = PAGE;
  const base = favoritesOnly ? ctx.rows.filter((r) => r.favorite) : ctx.rows;
  const tagCount = new Set(ctx.rows.flatMap((r) => r.tags ?? [])).size;

  if (!ctx.rows.length) {
    app.innerHTML = `<div class="ex-hero"><h1>Radar de Nichos do YouTube</h1></div>
      <div class="card empty"><h2>Nenhum canal catalogado ainda</h2>
      <p>Adicione canais com tags de nicho em <a href="#/gerenciar">Gerenciar</a>. A coleta diária monta o histórico a partir daí.</p></div>`;
    return;
  }

  app.innerHTML = `
    <div class="ex-hero">
      <div>
        <h1>${favoritesOnly ? 'Seus favoritos' : 'Radar de Nichos do YouTube'}</h1>
        <p>${favoritesOnly ? `${base.length} canal(is) favoritado(s)` : `${ctx.rows.length} canais monitorados em ${tagCount} nichos`}</p>
      </div>
      <label class="toggle"><span class="toggle-icon">${ICONS.shuffle}</span> Ordem aleatória
        <input type="checkbox" id="randomToggle"${ex.random ? ' checked' : ''}><span class="toggle-track"><span></span></span></label>
    </div>
    <div class="ex-layout">
      <div id="side"></div>
      <div class="ex-feed">
        <div id="spot"></div>
        <div class="ex-bar">
          <div class="ex-tabs" id="tabs" role="tablist"></div>
          <div class="ex-tools">
            <select id="sortSel" aria-label="Ordenar por"${ex.random ? ' disabled' : ''}>${Object.entries(SORTS)
              .map(([k, [label]]) => `<option value="${k}"${ex.sort === k ? ' selected' : ''}>${label}</option>`)
              .join('')}</select>
            <div class="viewtoggle" role="group" aria-label="Visualização">
              <button type="button" data-view="list" aria-pressed="${ex.view === 'list'}" aria-label="Lista detalhada">${ICONS.list}</button>
              <button type="button" data-view="grid" aria-pressed="${ex.view === 'grid'}" aria-label="Grade compacta">${ICONS.grid}</button>
            </div>
          </div>
        </div>
        <div id="feed"></div>
        <div id="sentinel"></div>
      </div>
    </div>`;

  const draw = () => {
    const filtered = sideFilter(base);
    const tab = TABS.find((t) => t.key === ex.tab) ?? TABS[0];
    const list = sortRows(filtered.filter((r) => tab.test(r, ctx)));

    document.getElementById('side').innerHTML = sidebar(base);
    if (window.matchMedia('(max-width: 900px)').matches && !ex.sideOpened) {
      document.querySelector('.ex-side .fall')?.removeAttribute('open');
    }
    const nicheList = document.getElementById('nicheList');
    const q = ex.nicheQ.trim().toLowerCase();
    if (q) nicheList.querySelectorAll('.fniche').forEach((l) => (l.hidden = !l.dataset.name.includes(q)));

    const cands = filtered
      .filter((r) => r.status === 'ok')
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, 5);
    document.getElementById('spot').innerHTML = spotlight(cands);

    document.getElementById('tabs').innerHTML = TABS.map((t) => {
      const n = filtered.filter((r) => t.test(r, ctx)).length;
      return `<button type="button" role="tab" class="ex-tab ${t.cls ?? ''}" data-tab="${t.key}" aria-selected="${ex.tab === t.key}">${t.label} <em>${n}</em></button>`;
    }).join('');

    const feed = document.getElementById('feed');
    feed.className = ex.view === 'grid' ? 'feed-grid' : 'feed-list';
    const card = ex.view === 'grid' ? cardGrid : cardList;
    feed.innerHTML = list.length
      ? list.slice(0, ex.limit).map((r) => card(r, ctx)).join('')
      : `<div class="card empty">${favoritesOnly && !base.length ? 'Toque no ♡ de um canal para guardá-lo aqui.' : 'Nenhum canal com esses filtros.'}</div>`;
    feed.dataset.total = list.length;
    draw.list = list;
  };
  draw();
  bindTooltips(app);

  // Carrega mais cards ao chegar no fim da página.
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || !draw.list || ex.limit >= draw.list.length) return;
    const feed = document.getElementById('feed');
    const card = ex.view === 'grid' ? cardGrid : cardList;
    feed.insertAdjacentHTML('beforeend', draw.list.slice(ex.limit, ex.limit + PAGE).map((r) => card(r, ctx)).join(''));
    ex.limit += PAGE;
  }, { rootMargin: '600px' });
  io.observe(document.getElementById('sentinel'));
  ctx.onLeave(() => io.disconnect());

  const redraw = () => {
    ex.limit = PAGE;
    draw();
  };

  app.querySelector('.ex-layout').addEventListener('change', (e) => {
    if (e.target.closest('#nicheList')) {
      if (e.target.checked) ex.niches.add(e.target.value);
      else ex.niches.delete(e.target.value);
      ex.sideOpened = true;
      redraw();
    } else if (e.target.id === 'sortSel') {
      ex.sort = e.target.value;
      redraw();
    }
  });
  app.querySelector('.ex-layout').addEventListener('input', (e) => {
    if (e.target.id !== 'nicheQ') return;
    ex.nicheQ = e.target.value;
    const q = ex.nicheQ.trim().toLowerCase();
    document.querySelectorAll('#nicheList .fniche').forEach((l) => (l.hidden = !!q && !l.dataset.name.includes(q)));
  });
  app.querySelector('.ex-layout').addEventListener('toggle', (e) => {
    if (e.target.matches?.('.ex-side .fall')) ex.sideOpened = e.target.open;
  }, true);
  app.querySelector('.ex-layout').addEventListener('click', async (e) => {
    const chip = e.target.closest('.fchip');
    if (chip) {
      const { group, value } = chip.dataset;
      if (group === 'size' || group === 'format') ex[group] = value;
      else if (ex[group].has(value)) ex[group].delete(value);
      else ex[group].add(value);
      return redraw();
    }
    if (e.target.closest('#clearFilters')) {
      ex.niches.clear();
      ex.countries.clear();
      ex.languages.clear();
      ex.cpm.clear();
      ex.size = 'all';
      ex.format = 'all';
      return redraw();
    }
    const tab = e.target.closest('.ex-tab');
    if (tab) {
      ex.tab = tab.dataset.tab;
      return redraw();
    }
    const view = e.target.closest('[data-view]');
    if (view) {
      ex.view = view.dataset.view;
      saveView();
      app.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === view)));
      return redraw();
    }
    if (e.target.closest('#spotNext')) {
      ex.spot++;
      const cands = sideFilter(base).filter((r) => r.status === 'ok').sort((a, b) => b.score.score - a.score.score).slice(0, 5);
      document.getElementById('spot').innerHTML = spotlight(cands);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const ref = act.closest('.ccard').dataset.ref;
      const row = ctx.rows.find((r) => r.ref === ref);
      if (!row) return;
      if (act.dataset.act === 'remove') {
        if (confirm(`Remover “${row.title}” do catálogo? O histórico já coletado continua guardado.`)) await ctx.removeChannel(row);
        return;
      }
      const flag = act.dataset.act;
      await ctx.toggleFlag(row, flag);
      if (favoritesOnly && flag === 'favorite') return redraw();
      document.querySelectorAll(`.ccard[data-ref="${CSS.escape(ref)}"] [data-act="${flag}"]`).forEach((b) => b.setAttribute('aria-pressed', String(row[flag])));
      // Atualiza só a contagem das abas.
      const filtered = sideFilter(base);
      document.querySelectorAll('.ex-tab').forEach((b) => {
        const t = TABS.find((x) => x.key === b.dataset.tab);
        b.querySelector('em').textContent = filtered.filter((r) => t.test(r, ctx)).length;
      });
    }
  });
  document.getElementById('randomToggle').addEventListener('change', (e) => {
    ex.random = e.target.checked;
    ex.seed = Math.floor(Math.random() * 2147483646) + 1;
    document.getElementById('sortSel').disabled = ex.random;
    redraw();
  });
}
