import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQueryLines,
  formatQueryLines,
  pickThemes,
  analyzeVideo,
  themeMetrics,
  languageGap,
  gapScore,
  gapVerdict,
  discoveryConfig,
  DEFAULT_DISCOVERY,
  DEFAULT_QUERIES,
  themeKey,
} from '../docs/js/gaps.js';

const cfg = { ...DEFAULT_DISCOVERY };
const NOW = Date.parse('2026-10-06T12:00:00Z');

test('parseQueryLines: idioma padrão, termo local e duplicados', () => {
  const q = parseQueryLines('dark history | en | história sombria\nmistérios\n\nMistérios | pt\nfoo | pt | ignorado', 'pt');
  assert.deepEqual(q, [
    { q: 'dark history', lang: 'en', local: 'história sombria' },
    { q: 'mistérios', lang: 'pt' },
    { q: 'foo', lang: 'pt' },
  ]);
  assert.equal(formatQueryLines(q.slice(0, 2)), 'dark history | en | história sombria\nmistérios | pt');
});

test('discoveryConfig usa os padrões quando não há configuração', () => {
  const c = discoveryConfig({});
  assert.equal(c.queries, DEFAULT_QUERIES);
  assert.equal(c.maxSubs, 100000);
  const d = discoveryConfig({ discovery: { days: 7, queries: [{ q: 'x', lang: 'pt' }] } });
  assert.equal(d.days, 7);
  assert.equal(d.queries.length, 1);
});

test('pickThemes: respeita o limite, prioriza os nunca buscados e pula os de hoje', () => {
  const qs = [
    { q: 'a', lang: 'pt' },
    { q: 'b', lang: 'en', local: 'bb' },
    { q: 'c', lang: 'pt' },
    { q: 'd', lang: 'pt' },
  ];
  const prev = {
    [themeKey('a', 'pt')]: { lastRun: '2026-10-05' },
    [themeKey('c', 'pt')]: { lastRun: '2026-10-06' },
    [themeKey('d', 'pt')]: { lastRun: '2026-10-01' },
  };
  assert.deepEqual(pickThemes(qs, prev, 3, '2026-10-06').map((t) => t.q), ['b', 'd']);
  assert.deepEqual(pickThemes(qs, prev, 10, '2026-10-06').map((t) => t.q), ['b', 'd', 'a']);
});

const vid = (over) =>
  analyzeVideo({ id: 'x', t: 'T', p: '2026-10-01T12:00:00Z', v: 50000, s: 600, ch: 'C1', subs: 5000, chAt: '2026-08-01T00:00:00Z', ...over }, cfg, NOW);

test('analyzeVideo: razão views/inscritos, canal novo, outlier e Shorts', () => {
  const v = vid();
  assert.equal(v.ratio, 10);
  assert.equal(v.small, true);
  assert.equal(v.newChannel, true);
  assert.equal(v.outlier, true);
  assert.equal(v.short, false);
  assert.equal(vid({ subs: 2e6, v: 9e6 }).outlier, false);
  assert.equal(vid({ subs: null }).outlier, false);
  assert.equal(vid({ v: 5000, subs: 100 }).outlier, false, 'abaixo do mínimo de views');
  assert.equal(vid({ s: 50 }).short, true);
});

test('themeMetrics, gapScore e veredito', () => {
  const vids = [
    vid({ ch: 'A', v: 400000, subs: 8000 }),
    vid({ ch: 'B', v: 300000, subs: 20000, chAt: '2020-01-01T00:00:00Z' }),
    vid({ ch: 'C', v: 200000, subs: 3000 }),
    vid({ ch: 'D', v: 900000, subs: 3e6 }),
    vid({ ch: 'E', v: 100000, subs: 50000, chAt: '2019-01-01T00:00:00Z' }),
  ];
  const m = themeMetrics(vids);
  assert.equal(m.n, 5);
  assert.equal(m.medianViews, 300000);
  assert.equal(m.smallShare, 0.8);
  assert.equal(m.outliers, 3); // A, B, C (E tem 2×)
  assert.equal(m.newChannels, 2); // A e C
  const g = gapScore(m, 'alto');
  assert.ok(g.score >= 65, `score ${g.score}`);
  assert.equal(gapVerdict(g.score).key, 'testar');

  const crowded = themeMetrics([vid({ ch: 'X', v: 3000, subs: 2e6 }), vid({ ch: 'Y', v: 2000, subs: 1e6 })]);
  const c = gapScore(crowded, 'baixo');
  assert.ok(c.score < 45, `score ${c.score}`);
  assert.equal(gapVerdict(c.score).key, 'observar');
});

test('languageGap: demanda alta lá fora e pouca oferta no seu idioma', () => {
  const main = { medianViews: 200000, n: 50 };
  assert.equal(languageGap(main, { medianViews: 20000, n: 50 }, cfg).level, 'forte');
  assert.equal(languageGap(main, { medianViews: 80000, n: 50 }, cfg).level, 'média');
  assert.equal(languageGap(main, { medianViews: 150000, n: 50 }, cfg).level, null);
  assert.equal(languageGap(main, { medianViews: 150000, n: 4 }, cfg).level, 'forte');
  const base = gapScore({ medianViews: 1000, smallShare: 0, outliers: 0, newChannels: 0 }, 'medio');
  const bonus = gapScore({ medianViews: 1000, smallShare: 0, outliers: 0, newChannels: 0 }, 'medio', { level: 'forte' });
  assert.equal(bonus.score - base.score, 10);
});
