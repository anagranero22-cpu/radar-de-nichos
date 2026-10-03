// Formatação pt-BR compartilhada (sem DOM).

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const nfCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const nfInt = new Intl.NumberFormat('pt-BR');
export const nfPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' });
export const nfPctPlain = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

export const fmtN = (n) => (n == null || !Number.isFinite(n) ? '—' : nfCompact.format(n));
export const fmtInt = (n) => (n == null ? '—' : nfInt.format(Math.round(n)));
export const fmtSigned = (n) => (n == null || !Number.isFinite(n) ? '—' : (n > 0 ? '+' : '') + nfCompact.format(n));
export const fmtPct = (p) => (p == null || !Number.isFinite(p) ? '—' : nfPct.format(p));
export const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—');
export const signClass = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

export function fmtAgo(days) {
  if (days == null) return '—';
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 60) return `há ${days} dias`;
  if (days < 730) return `há ${Math.round(days / 30)} meses`;
  return `há ${Math.round(days / 365)} anos`;
}
export function fmtAge(days) {
  if (days == null) return '—';
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30)} m`;
  return `${(days / 365).toFixed(1).replace('.', ',')} a`;
}


const nfUsd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const nfUsdCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
export const fmtUSD = (n) => (n == null || !Number.isFinite(n) ? '—' : n >= 10000 ? nfUsdCompact.format(n) : nfUsd.format(n));

export function fmtDuration(sec) {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['pt-BR'], { type: 'region' }) : null;
export function countryName(code) {
  if (!code) return null;
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}
