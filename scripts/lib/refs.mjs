// Interpreta o que o usuário digitou para identificar um canal do YouTube.
// Aceita: ID (UC...), @handle, URLs de canal (/channel/, /@, /user/, /c/),
// URLs de vídeo (o canal é descoberto a partir do vídeo) ou um nome qualquer (busca).

const CHANNEL_ID = /^UC[\w-]{22}$/;

export function parseRef(raw) {
  const ref = String(raw ?? '').trim();
  if (!ref) return { type: 'invalid', value: '' };
  if (CHANNEL_ID.test(ref)) return { type: 'id', value: ref };
  if (ref.startsWith('@')) return { type: 'handle', value: ref };

  const looksLikeUrl = /(^https?:\/\/)|(^(www\.|m\.)?youtube\.com\/)|(^youtu\.be\/)/i.test(ref);
  if (looksLikeUrl) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(ref) ? ref : `https://${ref}`);
    } catch {
      return { type: 'invalid', value: ref };
    }
    const host = url.hostname.replace(/^(www\.|m\.)/, '');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (host === 'youtu.be' && parts[0]) return { type: 'video', value: parts[0] };
    if (host !== 'youtube.com') return { type: 'invalid', value: ref };
    const [first, second] = parts;
    if (!first) return { type: 'invalid', value: ref };
    if (first.startsWith('@')) return { type: 'handle', value: first };
    if (first === 'channel' && second && CHANNEL_ID.test(second)) return { type: 'id', value: second };
    if (first === 'user' && second) return { type: 'username', value: second };
    if (first === 'c' && second) return { type: 'search', value: second };
    if (first === 'watch' && url.searchParams.get('v')) return { type: 'video', value: url.searchParams.get('v') };
    if ((first === 'shorts' || first === 'live') && second) return { type: 'video', value: second };
    return { type: 'search', value: first };
  }

  // Texto solto sem espaços é tratado como handle; com espaços, como busca por nome.
  if (/^[\w.-]+$/.test(ref)) return { type: 'handle', value: `@${ref}` };
  return { type: 'search', value: ref };
}
