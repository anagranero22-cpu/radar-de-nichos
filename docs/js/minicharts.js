// Mini-gráficos leves (SVG/HTML, sem Chart.js) para os cards do feed.
// Toda marca interativa tem `data-tip`; o tooltip flutuante é ligado por bindTooltips().

import { esc, fmtN, fmtInt, fmtDate, fmtAgo, fmtDuration } from './format.js';
import { daysBetween } from './metrics.js';
import { isOutlier, SHORTS_MAX_SECONDS } from './insights.js';

// Linha + área de uma série [[data, valor]]. Colunas invisíveis dão hover por dia.
export function sparkArea(points, { h = 64, label = 'Inscritos' } = {}) {
  const pts = points.filter((p) => p[1] != null);
  if (pts.length < 2) {
    return `<div class="spark-empty">Histórico começa a aparecer após 2 coletas</div>`;
  }
  const W = 300;
  const vals = pts.map((p) => p[1]);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => h - ((v - min) / (max - min)) * h;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const area = `${line}L${W},${h}L0,${h}Z`;
  const colW = W / pts.length;
  const cols = pts
    .map(
      (p, i) =>
        `<rect class="hit" x="${(x(i) - colW / 2).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${h}" data-tip="${esc(`${fmtDate(p[0])} · ${label}: ${fmtInt(p[1])}`)}"></rect>`,
    )
    .join('');
  const last = pts[pts.length - 1];
  return `<div class="spark" style="height:${h}px">
    <svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${area}"></path>
      <path class="spark-line" d="${line}" vector-effect="non-scaling-stroke"></path>
      ${cols}
    </svg>
    <span class="spark-dot" style="left:100%;top:${((y(last[1]) / h) * 100).toFixed(1)}%"></span>
  </div>`;
}

// Barras de views dos vídeos recentes (antigo → novo), outliers (≥ 2× mediana) em destaque.
export function viewsBars(recent, med, { h = 64, axis = false } = {}) {
  const vids = recent.filter((v) => v.v != null).slice().reverse();
  if (!vids.length) return '<div class="spark-empty">Sem vídeos recentes coletados</div>';
  const max = Math.max(...vids.map((v) => v.v), 1);
  const today = new Date().toISOString().slice(0, 10);
  const bars = vids
    .map((v) => {
      const out = isOutlier(v, med);
      const short = v.s != null && v.s <= SHORTS_MAX_SECONDS;
      const tip = `${v.t} · ${fmtN(v.v)} views · ${fmtAgo(daysBetween(v.d, today))}${short ? ' · Short' : ''}${out ? ` · ${(v.v / med).toFixed(1).replace('.', ',')}× a mediana` : ''}`;
      return `<a class="vbar${out ? ' out' : ''}${short ? ' short' : ''}" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
        <span style="height:${Math.max(3, (v.v / max) * 100).toFixed(1)}%"></span></a>`;
    })
    .join('');
  const medLine = med ? `<span class="vbar-median" style="bottom:${((med / max) * 100).toFixed(1)}%" data-tip="Mediana: ${fmtN(med)} views"></span>` : '';
  const axisHtml = axis ? '<div class="vbars-axis"><span>← mais antigos</span><span>mais recentes →</span></div>' : '';
  return `<div class="vbars" style="height:${h}px">${bars}${medLine}</div>${axisHtml}`;
}

// Detalhe do score: uma barra por critério, com o máximo de cada um.
export const SCORE_MAX = { tamanho: 20, crescimento: 25, tração: 25, constância: 15, cpm: 15 };
const SCORE_LABEL = { tamanho: 'Canal pequeno', crescimento: 'Crescimento', tração: 'Tração dos vídeos', constância: 'Constância', cpm: 'CPM do nicho' };
export function scoreBreakdown(parts) {
  return `<div class="sbreak">${Object.entries(SCORE_MAX)
    .map(([k, max]) => {
      const v = Math.round(parts[k] ?? 0);
      return `<div class="sbreak-row"><span>${SCORE_LABEL[k]}</span><div class="sbreak-track"><div style="width:${(v / max) * 100}%"></div></div><b>${v}/${max}</b></div>`;
    })
    .join('')}</div>`;
}

export function scoreMeter(score, verdictKey) {
  return `<div class="meter" data-tip="Score de oportunidade: ${score}/100">
    <div class="meter-track"><div class="meter-fill v-${verdictKey}" style="width:${score}%"></div></div>
    <span class="meter-num">${score}</span>
  </div>`;
}

// Proporção Shorts × longos nos vídeos recentes.
export function formatSplit(shortsShare) {
  if (shortsShare == null) return '';
  const s = Math.round(shortsShare * 100);
  return `<div class="split" data-tip="Últimos vídeos: ${s}% Shorts, ${100 - s}% longos">
    <div class="split-bar">${s ? `<span class="split-shorts" style="width:${s}%"></span>` : ''}${s < 100 ? `<span class="split-long" style="width:${100 - s}%"></span>` : ''}</div>
    <div class="split-legend"><span><i class="split-shorts"></i>Shorts ${s}%</span><span><i class="split-long"></i>Longos ${100 - s}%</span></div>
  </div>`;
}

export function videoThumb(v, med) {
  const today = new Date().toISOString().slice(0, 10);
  const out = v.v != null && isOutlier(v, med);
  return `<a class="vthumb" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">
    <span class="vthumb-img">
      <img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer">
      ${v.s != null ? `<span class="vthumb-dur">${v.s <= SHORTS_MAX_SECONDS ? 'Short · ' : ''}${fmtDuration(v.s)}</span>` : ''}
      ${out ? `<span class="vthumb-out">▲ ${(v.v / med).toFixed(1).replace('.', ',')}× mediana</span>` : ''}
    </span>
    <span class="vthumb-title">${esc(v.t)}</span>
    <span class="vthumb-meta">${v.v != null ? `${fmtN(v.v)} views · ` : ''}${fmtAgo(daysBetween(v.d, today))}</span>
  </a>`;
}

let tipEl = null;
export function bindTooltips(root = document) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  if (root.dataset?.tipsBound) return;
  if (root.dataset) root.dataset.tipsBound = '1';
  root.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    tipEl.textContent = t.dataset.tip;
    tipEl.classList.add('show');
  });
  root.addEventListener('mousemove', (e) => {
    if (!tipEl.classList.contains('show')) return;
    const pad = 14;
    const r = tipEl.getBoundingClientRect();
    let left = e.clientX + pad;
    let top = e.clientY + pad;
    if (left + r.width > innerWidth - 8) left = e.clientX - r.width - pad;
    if (top + r.height > innerHeight - 8) top = e.clientY - r.height - pad;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  });
  root.addEventListener('mouseout', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t && !t.contains(e.relatedTarget)) tipEl.classList.remove('show');
  });
}
