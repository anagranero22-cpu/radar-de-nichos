// Cliente mínimo da YouTube Data API v3, compartilhado pela coleta e pela busca de lacunas.

import { readFile } from 'node:fs/promises';

const API = 'https://www.googleapis.com/youtube/v3';
export const KEY = process.env.YOUTUBE_API_KEY;

export class QuotaError extends Error {}

export async function api(endpoint, params) {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new QuotaError('Cota diária da YouTube API esgotada.');
    }
    if (res.status === 404) return { items: [], notFound: true };
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`YouTube API ${endpoint} respondeu ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}
