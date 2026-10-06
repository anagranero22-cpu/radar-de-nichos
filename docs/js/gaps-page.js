// Página Lacunas: ranking dos temas buscados todo dia, vídeos virais de canais
// pequenos, lacuna de idioma e editor dos temas monitorados.

import { esc, fmtN, fmtInt, fmtAgo, fmtAge, fmtDate, fmtDuration, languageName } from './format.js';
import { CPM_TIERS } from './insights.js';
import { sparkArea, bindTooltips } from './minicharts.js';
import {
  discoveryConfig,
  parseQueryLines,
  formatQueryLines,
  searchCost,
  themeKey,
  gapVerdict,
  themeThesis,
  GAP_MAX,
  DEFAULT_QUERIES,
  DEFAULT_DISCOVERY,
  OUTLIER_RATIO,
  SHORTS_MAX,
  groupOf,
  groupsOf,
  pickThemes,
} from './gaps.js';

const ui = { group: undefined, lang: '', sort: 'score', langGapOnly: false, viralFormat: 'all', viralLimit: 18 };

const SORTS = {
  score: ['Score de lacuna', (t) => t.score],
  demanda: ['Demanda (views)', (t) => t.m.medianViews],
  virais: ['Virais de pequenos', (t) => t.m.outliers],
  novos: ['Canais novos', (t) => t.m.newChannels],
  tendencia: ['Subiu desde a última busca', (t) => trend(t) ?? -Infinity],
};

const PART_LABEL = { demanda: 'Demanda', pequenos: 'Espaço para pequenos', virais: 'Virais de canais pequenos', novos: 'Canais novos explodindo', cpm: 'CPM do nicho' };

const today = () => new Date().toISOString().slice(0, 10);
const pct = (x) => `${Math.round((x ?? 0) * 100)}%`;
const langTag = (l) => `<span class="lang-badge" title="${esc(languageName(l) ?? l)}">${esc(String(l).toUpperCase())}</span>`;

function trend(t) {
  const h = t.history ?? [];
  return h.length >= 2 ? h[h.length - 1][1] - h[h.length - 2][1] : null;
}

function verdictChip(score) {
  const v = gapVerdict(score);
  return `<span class="verdict v-${v.key}"><i></i>${v.label}</span>`;
}

function meter(score) {
  const v = gapVerdict(score);
  return `<div class="meter" data-tip="Score de lacuna: ${score}/100">
    <div class="meter-track"><div class="meter-fill v-${v.key}" style="width:${score}%"></div></div>
    <span class="meter-num">${score}</span></div>`;
}

function breakdown(t) {
  const rows = Object.entries(GAP_MAX).map(([k, max]) => {
    const v = Math.round(t.parts?.[k] ?? 0);
    return `<div class="sbreak-row"><span>${PART_LABEL[k]}</span><div class="sbreak-track"><div style="width:${(v / max) * 100}%"></div></div><b>${v}/${max}</b></div>`;
  });
  if (t.bonus) rows.push(`<div class="sbreak-row"><span>Bônus: lacuna de idioma</span><div class="sbreak-track"><div style="width:${t.bonus * 10}%"></div></div><b>+${t.bonus}</b></div>`);
  return `<div class="sbreak">${rows.join('')}</div>`;
}

function videoCard(v, ctx, theme) {
  const short = v.s != null && v.s <= SHORTS_MAX;
  const inRadar = ctx.knownIds.has(v.ch);
  const big = v.r != null && v.r >= OUTLIER_RATIO && v.subs <= ctx.cfg.maxSubs;
  const chMeta = [
    v.subs != null ? `${fmtN(v.subs)} inscritos` : 'inscritos ocultos',
    v.chAge != null ? `canal de ${fmtAge(v.chAge)}` : null,
    v.vids != null ? `${fmtInt(v.vids)} vídeos` : null,
  ].filter(Boolean);
  return `<div class="gvid">
    <a class="vthumb" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">
      <span class="vthumb-img">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer">
        ${v.s != null ? `<span class="vthumb-dur">${short ? 'Short · ' : ''}${fmtDuration(v.s)}</span>` : ''}
        ${big ? `<span class="vthumb-out">▲ ${fmtN(v.r)}× inscritos</span>` : ''}
      </span>
      <span class="vthumb-title">${esc(v.t)}</span>
      <span class="vthumb-meta">${fmtN(v.v)} views${v.d ? ` · ${fmtAgo(Math.round((Date.parse(today()) - Date.parse(v.d)) / 864e5))}` : ''}</span>
    </a>
    <div class="gvid-ch">
      <a href="https://www.youtube.com/channel/${esc(v.ch)}" target="_blank" rel="noopener" class="gvid-name">${esc(v.chT)}</a>
      <span class="muted">${esc(chMeta.join(' · '))}</span>
      ${v.chAge != null && v.chAge <= 180 ? '<span class="badge-rise">canal novo</span>' : ''}
    </div>
    ${
      inRadar
        ? '<span class="gvid-in">✓ No radar</span>'
        : `<button type="button" class="gvid-add" data-add="${esc(v.ch)}" data-theme="${esc(theme.key)}" data-vid="${esc(v.id)}"${ctx.editable ? '' : ' disabled title="Conecte o GitHub em Gerenciar"'}>+ Acompanhar canal</button>`
    }
  </div>`;
}

function themeRow(t, ctx) {
  const tr = trend(t);
  const tier = CPM_TIERS[t.tier]?.label ?? '—';
  const stats = [
    ['Mediana de views', fmtN(t.m.medianViews), 'Mediana dos 20 vídeos mais vistos da busca no período'],
    ['Pequenos no topo', pct(t.m.smallShare), `Parte dos 20 mais vistos que vem de canais com até ${fmtN(ctx.cfg.maxSubs)} inscritos`],
    ['Virais de pequenos', fmtInt(t.m.outliers), `Canais pequenos com vídeo acima de ${OUTLIER_RATIO}× os inscritos`],
    ['Canais novos', fmtInt(t.m.newChannels), 'Desses, quantos têm menos de 6 meses'],
    ['Shorts no topo', t.m.shortsShare == null ? '—' : pct(t.m.shortsShare), 'Parte dos 20 mais vistos que são Shorts'],
  ];
  const lg = t.langGap?.level
    ? `<span class="gap-lang" data-tip="Em ${esc(t.lang)}: mediana ${fmtN(t.m.medianViews)} · em ${esc(t.localLang ?? ctx.cfg.homeLang)} (“${esc(t.local)}”): mediana ${fmtN(t.localM?.medianViews)}">Lacuna de idioma ${t.langGap.level}</span>`
    : '';
  return `<article class="gap-row">
    <div class="gap-head">
      <div class="gap-name">
        ${langTag(t.lang)}
        <h3>${esc(t.q)}</h3>
        ${t.local ? `<span class="muted small">→ ${langTag(t.localLang ?? ctx.cfg.homeLang)} ${esc(t.local)}</span>` : ''}
      </div>
      <div class="gap-pills">${verdictChip(t.score)} ${lg}
        ${t.niche ? `<span class="tag">${esc(t.niche)}</span>` : ''}
        <span class="tag" title="Faixa de CPM do nicho">CPM ${esc(tier)}</span>
        ${t.rank ? `<span class="tag gap-rank" title="Posição pelo score dentro do grupo">#${t.rank.n} de ${t.rank.of} em ${esc(t.group)}</span>` : ''}
      </div>
    </div>
    <div class="gap-body">
      <div>
        <p class="gap-thesis">${esc(themeThesis(t))}</p>
        <div class="gap-stats">${stats.map(([l, v, tip]) => `<div data-tip="${esc(tip)}"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
      </div>
      <div class="gap-side">
        ${meter(t.score)}
        <div class="gap-trend">${sparkArea(t.history.map((h) => [h[0], h[1]]), { h: 40, label: 'Score' })}
          ${tr == null ? '' : `<span class="small ${tr > 0 ? 'up' : tr < 0 ? 'down' : 'muted'}">${tr > 0 ? '+' : ''}${tr} desde a última busca</span>`}</div>
      </div>
    </div>
    <details class="gap-more"${ui.open === t.key ? ' open' : ''} data-key="${esc(t.key)}">
      <summary>Ver vídeos e cálculo (${t.videos.length})</summary>
      <div class="gap-detail">
        ${breakdown(t)}
        <p class="muted small">Buscado em ${fmtDate(t.lastRun)} · vídeos publicados nos últimos ${ctx.cfg.days} dias, ${fmtInt(t.m.n)} resultados analisados, ${fmtInt(t.m.channels)} canais diferentes no topo.</p>
      </div>
      <div class="gvid-grid">${t.videos.map((v) => videoCard(v, ctx, t)).join('') || '<p class="muted">Nenhum vídeo acima do mínimo de views.</p>'}</div>
      ${
        t.localVideos?.length
          ? `<h4 class="gap-sub">O que já existe em ${esc(languageName(t.localLang ?? ctx.cfg.homeLang) ?? t.localLang)} (“${esc(t.local)}”)</h4>
             <div class="gvid-grid">${t.localVideos.map((v) => videoCard(v, ctx, t)).join('')}</div>`
          : t.local
            ? `<p class="muted small">Nenhum vídeo relevante encontrado em “${esc(t.local)}”: espaço livre nesse idioma.</p>`
            : ''
      }
    </details>
  </article>`;
}

function spotlight(t, ctx) {
  return `<section class="spot">
    <div class="spot-body">
      <div class="spot-pills"><span class="spot-pill">Melhor lacuna de hoje</span>${t.niche ? `<span class="spot-tag">${esc(t.niche)}</span>` : ''}</div>
      <h2>${langTag(t.lang)} ${esc(t.q)}</h2>
      <p class="spot-thesis full">${esc(themeThesis(t))}</p>
    </div>
    <div class="spot-side">
      <div class="spot-score"><b>${t.score}</b><span>/100</span></div>
      <button type="button" class="spot-btn" data-open="${esc(t.key)}">Ver vídeos</button>
    </div>
  </section>`;
}

function viralFeed(themes, ctx) {
  const seen = new Set();
  let vids = [];
  for (const t of themes) {
    for (const v of t.videos) {
      if (seen.has(v.id) || v.subs == null || v.subs > ctx.cfg.maxSubs || (v.r ?? 0) < OUTLIER_RATIO) continue;
      seen.add(v.id);
      vids.push({ v, t });
    }
  }
  if (ui.viralFormat === 'long') vids = vids.filter(({ v }) => v.s == null || v.s > SHORTS_MAX);
  if (ui.viralFormat === 'shorts') vids = vids.filter(({ v }) => v.s != null && v.s <= SHORTS_MAX);
  vids.sort((a, b) => b.v.r - a.v.r);
  const shown = vids.slice(0, ui.viralLimit);
  return `<div class="card-head"><div><h2>Virais de canais pequenos</h2>
      <p class="muted small">Vídeos dos últimos ${ctx.cfg.days} dias que passaram de ${OUTLIER_RATIO}× os inscritos do canal, em todos os temas. Ordenados pela razão views ÷ inscritos.</p></div>
      <div class="seg" role="group" aria-label="Formato">${Object.entries({ all: 'Todos', long: 'Longos', shorts: 'Shorts' })
        .map(([k, l]) => `<button type="button" data-vf="${k}" aria-pressed="${ui.viralFormat === k}">${l}</button>`)
        .join('')}</div></div>
    ${
      shown.length
        ? `<div class="gvid-grid">${shown
            .map(({ v, t }) => `<div class="gvid-wrap"><span class="gvid-theme">${langTag(t.lang)} ${esc(t.q)}</span>${videoCard(v, ctx, t)}</div>`)
            .join('')}</div>
          ${vids.length > shown.length ? `<div style="text-align:center;margin-top:14px"><button type="button" id="moreViral">Mostrar mais (${vids.length - shown.length})</button></div>` : ''}`
        : '<p class="muted">Nenhum vídeo viral de canal pequeno nos temas atuais.</p>'
    }`;
}

function editor(ctx) {
  const cfg = ctx.cfg;
  const custom = Boolean(ctx.doc.discovery?.queries?.length);
  return `<div class="card-head"><div><h2>Temas monitorados</h2>
      <p class="muted small">Um tema por linha: <code>termo | idioma | mesmo termo em outro idioma | outro idioma</code> (ex.: <code>dark history | en | dunkle Geschichte | de</code>). Os dois últimos campos são opcionais e medem a lacuna de idioma: o tema rende num mercado e quase não existe no outro. Uma linha <code># Nome do nicho</code> abre um grupo; os temas abaixo dela pertencem a ele.${custom ? '' : ' Estes são os temas sugeridos; edite à vontade.'}</p></div></div>
    <form id="gapForm">
      <label class="field">Temas<textarea name="queries" rows="12" spellcheck="false">${esc(formatQueryLines(cfg.queries))}</textarea></label>
      <p class="small" id="gapCost"></p>
      <div class="form-grid">
        <label class="field">Janela (dias)<input name="days" type="number" min="1" max="60" value="${cfg.days}"></label>
        <label class="field">Canal pequeno: até (inscritos)<input name="maxSubs" type="number" min="100" step="1000" value="${cfg.maxSubs}"></label>
        <label class="field">Mínimo de views do vídeo<input name="minViews" type="number" min="0" step="1000" value="${cfg.minViews}"></label>
        <label class="field">Buscas por dia (100 unidades cada)<input name="maxSearches" type="number" min="1" max="90" value="${cfg.maxSearches}"></label>
        <label class="field">Outro idioma padrão (comparação)<input name="homeLang" value="${esc(cfg.homeLang)}" maxlength="5"></label>
        <label class="field">Nicho em foco<select name="focus">${focusOptions(cfg.queries, cfg.focus)}</select></label>
        <label class="field">Parte das buscas para o foco (%)<input name="focusShare" type="number" min="50" max="100" step="5" value="${Math.round((cfg.focusShare ?? 0.8) * 100)}"></label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" type="submit"${ctx.editable ? '' : ' disabled'}>Salvar temas</button>
        <button type="button" id="gapDefaults">Restaurar sugestões</button>
      </div>
      ${ctx.editable ? '' : '<p class="muted small">Conecte o GitHub em Gerenciar para salvar.</p>'}
    </form>`;
}

function focusOptions(queries, selected) {
  const groups = groupsOf(queries);
  if (selected && !groups.includes(selected)) groups.push(selected);
  return `<option value="">Nenhum (todos iguais)</option>${groups
    .map((g) => `<option value="${esc(g)}"${g === selected ? ' selected' : ''}>${esc(g)}</option>`)
    .join('')}`;
}

function updateCost(form, maxSearches) {
  const qs = parseQueryLines(form.queries.value, form.homeLang.value.trim() || 'en');
  const max = Number(form.maxSearches.value) || maxSearches;
  const cost = qs.reduce((a, t) => a + searchCost(t), 0);
  // Mantém a lista de nichos do seletor em dia com os cabeçalhos "# Nome" digitados.
  const sel = form.focus;
  const current = sel.value;
  sel.innerHTML = focusOptions(qs, current);
  const focus = sel.value;
  const share = Math.min(100, Math.max(50, Number(form.focusShare.value) || 80)) / 100;
  const el = document.getElementById('gapCost');
  let focusLine = '';
  if (focus) {
    const fq = qs.filter((t) => groupOf(t) === focus);
    const fCost = fq.reduce((a, t) => a + searchCost(t), 0);
    const fBudget = Math.round(max * share);
    const picked = pickThemes(qs, {}, max, 'preview', { group: focus, share });
    const used = picked.filter((t) => groupOf(t) === focus).reduce((a, t) => a + searchCost(t), 0);
    focusLine = `<br><strong>Foco em ${esc(focus)}:</strong> ${fq.length} tema(s), ${fCost} busca(s) de ${fBudget} reservadas por dia.${
      fCost < fBudget * 0.6
        ? ` Sobram ${fBudget - fCost} buscas do foco, que vão para os outros nichos: adicione subtemas em <code># ${esc(focus)}</code> para aprofundar.`
        : ''
    }${used < fCost ? ' Os temas do foco entram em rodízio.' : ''}`;
  }
  el.innerHTML = `${qs.length} tema(s), ${cost} busca(s) ≈ ${fmtInt(cost * 100)} unidades de cota por dia (limite gratuito: 10.000, a coleta dos canais usa pouco).${
    cost > max ? ` <strong>Passa do limite de ${max} buscas/dia:</strong> os temas entram em rodízio, cada um é atualizado a cada ${Math.ceil(cost / max)} dias.` : ''
  }${focusLine}`;
}

export function renderGaps(ctx) {
  const { app } = ctx;
  const cfg = discoveryConfig(ctx.doc);
  const gaps = ctx.gaps ?? {};
  const configured = new Map(cfg.queries.map((t) => [themeKey(t.q, t.lang), t]));
  const everything = Object.entries(gaps.themes ?? {})
    .filter(([key]) => configured.has(key))
    .map(([key, t]) => ({ ...t, key, group: groupOf(configured.get(key)) }));
  const groups = groupsOf(cfg.queries);
  if (ui.group === undefined) ui.group = cfg.focus && groups.includes(cfg.focus) ? cfg.focus : '';
  if (ui.group && !groups.includes(ui.group)) ui.group = '';
  // Posição de cada tema pelo score dentro do próprio grupo (a régua só compara dentro do nicho).
  for (const g of groups) {
    const list = everything.filter((t) => t.group === g).sort((a, b) => b.score - a.score);
    list.forEach((t, i) => (t.rank = groups.length > 1 && list.length > 1 ? { n: i + 1, of: list.length } : null));
  }
  const all = ui.group ? everything.filter((t) => t.group === ui.group) : everything;
  const pending = cfg.queries.filter((t) => !gaps.themes?.[themeKey(t.q, t.lang)] && (!ui.group || groupOf(t) === ui.group));
  const groupBar = groups.length > 1
    ? `<div class="gap-groups" role="group" aria-label="Nicho">
        ${[['', 'Todos os nichos', everything.length], ...groups.map((g) => [g, g, everything.filter((t) => t.group === g).length])]
          .map(([g, label, n]) => `<button type="button" class="fchip" data-group="${esc(g)}" aria-pressed="${ui.group === g}">${g && g === cfg.focus ? '★ ' : ''}${esc(label)} <em>${n}</em></button>`)
          .join('')}
      </div>`
    : '';
  const focusBar = cfg.focus
    ? `<div class="notice gap-focus"><span><strong>Modo foco: ${esc(cfg.focus)}</strong> recebe ${Math.round((cfg.focusShare ?? 0.8) * 100)}% das ${cfg.maxSearches} buscas diárias; os outros nichos dividem o resto só para continuar vigiando.</span>
        ${ctx.editable ? '<button type="button" id="gapUnfocus">Sair do foco</button>' : ''}</div>`
    : ui.group && ctx.editable
      ? `<div class="notice gap-focus"><span>Vendo só <strong>${esc(ui.group)}</strong>. Quer analisar este nicho a fundo?</span><button type="button" id="gapFocus">Focar neste nicho</button></div>`
      : '';
  const c = { ...ctx, cfg };

  const langs = [...new Set(all.map((t) => t.lang))].sort();
  let themes = all.filter((t) => (!ui.lang || t.lang === ui.lang) && (!ui.langGapOnly || t.langGap?.level));
  const [, get] = SORTS[ui.sort];
  themes = themes.sort((a, b) => get(b) - get(a) || b.score - a.score);
  const best = all.slice().sort((a, b) => b.score - a.score)[0];
  const strong = all.filter((t) => t.score >= 65).length;
  const viralCh = new Set(all.flatMap((t) => t.videos.filter((v) => v.subs != null && v.subs <= cfg.maxSubs && (v.r ?? 0) >= OUTLIER_RATIO).map((v) => v.ch)));
  const newCh = new Set(all.flatMap((t) => t.videos.filter((v) => v.chAge != null && v.chAge <= 180 && (v.r ?? 0) >= OUTLIER_RATIO).map((v) => v.ch)));
  const at = gaps.updatedAt ? new Date(gaps.updatedAt) : null;
  const kpi = (label, value, sub = '') => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

  app.innerHTML = `
    <div class="page-head"><div><h1>Lacunas</h1>
      <p>Todo dia a coleta busca seus temas no YouTube e mede onde há demanda, canais pequenos viralizando e pouca concorrência.</p></div>
      <div class="gap-run">
        <span class="muted small">${at ? `Última busca: ${at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ainda sem buscas'}</span>
        ${ctx.editable ? '<button type="button" id="gapRun">Buscar agora</button>' : ''}
      </div></div>

    ${
      !all.length
        ? `<div class="notice"><strong>Nenhum resultado ainda.</strong> A busca roda junto com a coleta diária (06:17) e sempre que você salva os temas. ${
            ctx.editable ? 'Clique em “Buscar agora” para rodar já: leva 1–3 minutos.' : 'Conecte o GitHub em Gerenciar para disparar agora.'
          }</div>`
        : ''
    }
    ${groupBar}
    ${focusBar}
    ${pending.length && all.length ? `<div class="notice">${pending.length} tema(s) ainda não buscado(s): ${pending.slice(0, 6).map((t) => `<code>${esc(t.q)}</code>`).join(', ')}${pending.length > 6 ? '…' : ''}. Entram na próxima busca.</div>` : ''}

    ${
      all.length
        ? `<div class="kpis">
            ${kpi('Temas analisados', fmtInt(all.length), ui.group ? `no nicho ${esc(ui.group)}` : `${fmtInt(cfg.queries.length)} configurados`)}
            ${kpi('Lacunas fortes', fmtInt(strong), 'score a partir de 65')}
            ${kpi('Canais pequenos viralizando', fmtInt(viralCh.size), `vídeo ≥ ${OUTLIER_RATIO}× os inscritos`)}
            ${kpi('Canais novos explodindo', fmtInt(newCh.size), 'menos de 6 meses de canal')}
          </div>
          ${best ? spotlight(best, c) : ''}

          <section class="card">
            <div class="card-head"><h2>Ranking de temas${ui.group ? ` · ${esc(ui.group)}` : ''}</h2>
              <div class="toolbar" style="margin:0">
                <select id="gSort" aria-label="Ordenar">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}"${ui.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
                <select id="gLang" aria-label="Idioma"><option value="">Todos os idiomas</option>${langs.map((l) => `<option value="${esc(l)}"${ui.lang === l ? ' selected' : ''}>${esc(languageName(l) ?? l)}</option>`).join('')}</select>
                <label class="small"><input type="checkbox" id="gLangGap"${ui.langGapOnly ? ' checked' : ''}> Só lacuna de idioma</label>
              </div></div>
            <div class="gap-list">${themes.map((t) => themeRow(t, c)).join('') || '<p class="muted">Nenhum tema com esses filtros.</p>'}</div>
          </section>

          <section class="card" id="viral">${viralFeed(all, c)}</section>`
        : ''
    }

    <section class="card">${editor(c)}</section>

    <section class="card">
      <h2 style="margin-bottom:8px">Como ler o score de lacuna</h2>
      <ul class="small" style="margin:0;padding-left:18px;color:var(--ink-2)">
        <li><b>Demanda (30):</b> mediana de views dos 20 vídeos mais vistos do tema no período (1 mil = 0, 1 milhão = máximo).</li>
        <li><b>Espaço para pequenos (25):</b> parte desses 20 que vem de canais com até ${fmtN(cfg.maxSubs)} inscritos. Se só canal grande aparece, o tema é concorrido.</li>
        <li><b>Virais de pequenos (20):</b> canais pequenos com um vídeo acima de ${OUTLIER_RATIO}× os inscritos e pelo menos ${fmtN(cfg.minViews)} views: é o tema puxando audiência, não a marca do canal.</li>
        <li><b>Canais novos (15):</b> desses, quantos têm menos de 6 meses. Sinal de nicho recém-aberto.</li>
        <li><b>CPM (10)</b> pela faixa do nicho detectado, e <b>bônus de até 10</b> quando há lacuna de idioma.</li>
      </ul>
      <p class="muted small" style="margin:8px 0 0">A partir de 65: “Lacuna forte”; de 45 a 64: “Vale testar”. É um filtro para decidir o que olhar primeiro; a validação final é assistir aos vídeos de referência.</p>
    </section>`;

  bindTooltips(app);
  const rerender = () => renderGaps(ctx);

  app.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => ((ui.group = b.dataset.group), (ui.viralLimit = 18), rerender())));
  const setFocus = async (group) => {
    const ok = await ctx.saveCatalog(group ? `Lacunas: foco em ${group}` : 'Lacunas: sai do modo foco', (doc) => {
      doc.discovery = { ...(doc.discovery ?? {}), queries: doc.discovery?.queries?.length ? doc.discovery.queries : cfg.queries, focus: group };
    });
    if (ok) ctx.toast(group ? `Foco em ${group}. Vale a partir da próxima busca.` : 'Modo foco desligado.');
  };
  app.querySelector('#gapFocus')?.addEventListener('click', () => setFocus(ui.group));
  app.querySelector('#gapUnfocus')?.addEventListener('click', () => setFocus(''));
  app.querySelector('#gSort')?.addEventListener('change', (e) => ((ui.sort = e.target.value), rerender()));
  app.querySelector('#gLang')?.addEventListener('change', (e) => ((ui.lang = e.target.value), rerender()));
  app.querySelector('#gLangGap')?.addEventListener('change', (e) => ((ui.langGapOnly = e.target.checked), rerender()));
  app.querySelectorAll('[data-vf]').forEach((b) => b.addEventListener('click', () => ((ui.viralFormat = b.dataset.vf), (ui.viralLimit = 18), rerender())));
  app.querySelector('#moreViral')?.addEventListener('click', () => ((ui.viralLimit += 18), rerender()));
  app.querySelectorAll('.gap-more').forEach((d) =>
    d.addEventListener('toggle', () => {
      if (d.open) ui.open = d.dataset.key;
      else if (ui.open === d.dataset.key) ui.open = null;
    }),
  );
  app.querySelector('[data-open]')?.addEventListener('click', (e) => {
    const d = app.querySelector(`.gap-more[data-key="${CSS.escape(e.currentTarget.dataset.open)}"]`);
    if (!d) return;
    d.open = true;
    d.closest('.gap-row').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  app.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => onAdd(b)));
  async function onAdd(b) {
    const t = all.find((x) => x.key === b.dataset.theme);
    const v = [...(t?.videos ?? []), ...(t?.localVideos ?? [])].find((x) => x.id === b.dataset.vid);
    b.disabled = true;
    const note = v
      ? `[Lacunas, ${fmtDate(today())}] Achado no tema “${t.q}”: “${v.t}” fez ${fmtN(v.v)} views${v.r != null ? ` (${fmtN(v.r)}× os inscritos)` : ''}.`
      : '';
    await ctx.saveCatalog(`Adiciona canal achado em Lacunas`, (doc) => {
      if (!doc.channels.some((c2) => c2.ref === b.dataset.add)) {
        doc.channels.push({ ref: b.dataset.add, tags: [], notes: note, addedAt: today() });
      }
    });
  }

  const form = app.querySelector('#gapForm');
  updateCost(form, cfg.maxSearches);
  form.addEventListener('input', () => updateCost(form, cfg.maxSearches));
  app.querySelector('#gapDefaults').addEventListener('click', () => {
    form.queries.value = formatQueryLines(DEFAULT_QUERIES);
    for (const k of ['days', 'maxSubs', 'minViews', 'maxSearches', 'homeLang']) form[k].value = DEFAULT_DISCOVERY[k];
    form.focusShare.value = 80;
    updateCost(form, DEFAULT_DISCOVERY.maxSearches);
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const homeLang = form.homeLang.value.trim().toLowerCase() || 'en';
    const queries = parseQueryLines(form.queries.value, homeLang);
    if (!queries.length) {
      ctx.toast('Adicione pelo menos um tema.', true);
      return;
    }
    const num = (k, min, max) => Math.min(max, Math.max(min, Math.round(Number(form[k].value) || DEFAULT_DISCOVERY[k])));
    const ok = await ctx.saveCatalog('Atualiza temas de Lacunas', (doc) => {
      doc.discovery = {
        queries,
        days: num('days', 1, 60),
        maxSubs: num('maxSubs', 100, 1e8),
        minViews: num('minViews', 0, 1e9),
        maxSearches: num('maxSearches', 1, 90),
        homeLang,
        focus: queries.some((t) => groupOf(t) === form.focus.value) ? form.focus.value : '',
        focusShare: Math.min(100, Math.max(50, Number(form.focusShare.value) || 80)) / 100,
      };
    });
    if (ok) ctx.toast('Temas salvos. Os novos são buscados em 1–3 minutos.');
  });
  app.querySelector('#gapRun')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await ctx.triggerCollect();
      ctx.toast('Busca iniciada. Temas ainda não buscados hoje aparecem em alguns minutos.');
    } catch (err) {
      ctx.toast(`Não foi possível iniciar: ${err.message}`, true);
      e.target.disabled = false;
    }
  });
}
