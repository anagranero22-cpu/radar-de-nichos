// Idioma do canal a partir do que a API informa.
// Prioridade: idioma do áudio dos vídeos recentes (mais comum) > idioma padrão
// declarado pelo canal > idioma principal do país do canal.

const IGNORE = new Set(['zxx', 'und', 'mul', 'mis']);

const COUNTRY_LANGUAGE = {
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en',
  DE: 'de', AT: 'de',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', UY: 'es', EC: 'es',
  FR: 'fr', IT: 'it', NL: 'nl', PL: 'pl', TR: 'tr', RU: 'ru', UA: 'uk',
  JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh', ID: 'id', VN: 'vi', TH: 'th',
  SA: 'ar', EG: 'ar', AE: 'ar', SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', GR: 'el', RO: 'ro', CZ: 'cs', HU: 'hu',
};

// 'pt-BR' → 'pt'; códigos sem conteúdo linguístico viram null.
export function normLang(code) {
  if (!code) return null;
  const base = String(code).toLowerCase().split(/[-_]/)[0];
  return base && !IGNORE.has(base) ? base : null;
}

export function detectLanguage({ videoLanguages = [], declared = null, country = null } = {}) {
  const counts = new Map();
  for (const l of videoLanguages.map(normLang).filter(Boolean)) counts.set(l, (counts.get(l) ?? 0) + 1);
  if (counts.size) {
    const [best] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { language: best, source: 'vídeos' };
  }
  const d = normLang(declared);
  if (d) return { language: d, source: 'canal' };
  const c = COUNTRY_LANGUAGE[String(country ?? '').toUpperCase()];
  if (c) return { language: c, source: 'país' };
  return { language: null, source: null };
}
