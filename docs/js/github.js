// Grava o catálogo (docs/data/channels.json) direto no repositório pela API do
// GitHub, usando um token pessoal guardado só no navegador de quem edita.

export const CHANNELS_PATH = 'docs/data/channels.json';
const STORAGE_KEY = 'radar.github';

function guessRepo() {
  // https://<dono>.github.io/<repo>/
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m ? { owner: m[1], repo: repo ?? `${m[1]}.github.io` } : { owner: '', repo: '' };
}

export function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    /* armazenamento indisponível */
  }
  return { branch: 'main', ...guessRepo(), token: '', ...saved };
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* armazenamento indisponível */
  }
}

export const canWrite = (cfg) => Boolean(cfg.token && cfg.owner && cfg.repo);

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gh(cfg, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message ?? `GitHub respondeu ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function fetchChannelsDoc(cfg) {
  const file = await gh(cfg, `contents/${CHANNELS_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
  return { doc: JSON.parse(b64ToUtf8(file.content)), sha: file.sha };
}

// Lê a versão mais recente, aplica `mutate` e grava. Se outra edição entrou no
// meio (409/422 por sha desatualizado), tenta de novo sobre a versão nova.
export async function updateChannelsDoc(cfg, message, mutate) {
  for (let attempt = 0; ; attempt++) {
    const { doc, sha } = await fetchChannelsDoc(cfg);
    mutate(doc);
    try {
      await gh(cfg, `contents/${CHANNELS_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: utf8ToB64(`${JSON.stringify(doc, null, 2)}\n`),
          sha,
          branch: cfg.branch,
        }),
      });
      return doc;
    } catch (err) {
      if ((err.status === 409 || err.status === 422) && attempt < 2) continue;
      throw err;
    }
  }
}

export async function triggerCollect(cfg) {
  await gh(cfg, 'actions/workflows/coleta.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: cfg.branch }),
  });
}
