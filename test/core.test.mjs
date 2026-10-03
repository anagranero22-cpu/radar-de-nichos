import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRef } from '../docs/js/refs.js';
import {
  growth,
  channelMetrics,
  isRisingSmall,
  nicheStats,
  chainIndex,
  median,
  snapshotAt,
} from '../docs/js/metrics.js';

const ID = 'UCabcdefghijklmnopqrstuv';

test('parseRef reconhece os formatos de entrada', () => {
  assert.deepEqual(parseRef(ID), { type: 'id', value: ID });
  assert.deepEqual(parseRef(' @Canal_Legal '), { type: 'handle', value: '@Canal_Legal' });
  assert.deepEqual(parseRef('https://www.youtube.com/@canal'), { type: 'handle', value: '@canal' });
  assert.deepEqual(parseRef('youtube.com/@canal/videos'), { type: 'handle', value: '@canal' });
  assert.deepEqual(parseRef(`https://youtube.com/channel/${ID}`), { type: 'id', value: ID });
  assert.deepEqual(parseRef('https://www.youtube.com/user/fulano'), { type: 'username', value: 'fulano' });
  assert.deepEqual(parseRef('https://www.youtube.com/c/Fulano'), { type: 'search', value: 'Fulano' });
  assert.deepEqual(parseRef('https://www.youtube.com/watch?v=abc123'), { type: 'video', value: 'abc123' });
  assert.deepEqual(parseRef('https://youtu.be/abc123'), { type: 'video', value: 'abc123' });
  assert.deepEqual(parseRef('https://m.youtube.com/shorts/xyz'), { type: 'video', value: 'xyz' });
  assert.deepEqual(parseRef('canal'), { type: 'handle', value: '@canal' });
  assert.deepEqual(parseRef('finanças para leigos'), { type: 'search', value: 'finanças para leigos' });
  assert.equal(parseRef('https://vimeo.com/x').type, 'invalid');
  assert.equal(parseRef('').type, 'invalid');
});

const hist = [
  ['2026-09-01', 1000, 50000, 10, '2026-08-30'],
  ['2026-09-02', 1010, 50500, 10, '2026-08-30'],
  ['2026-09-24', 1200, 70000, 12, '2026-09-20'],
  ['2026-10-01', 1500, 90000, 13, '2026-09-30'],
];

test('snapshotAt pega a última linha até a data', () => {
  assert.equal(snapshotAt(hist, '2026-09-10')[0], '2026-09-02');
  assert.equal(snapshotAt(hist, '2026-08-01')[0], '2026-09-01');
});

test('growth calcula janela e normaliza por 30 dias', () => {
  const g7 = growth(hist, 7);
  assert.equal(g7.span, 7);
  assert.equal(g7.dSubs, 300);
  assert.equal(g7.partial, false);
  assert.ok(Math.abs(g7.monthlyPct - (300 / 1200) * (30 / 7)) < 1e-9);

  const g90 = growth(hist, 90);
  assert.equal(g90.span, 30);
  assert.equal(g90.partial, true);
  assert.equal(g90.dSubs, 500);

  assert.equal(growth([hist[0]], 30), null);
  assert.equal(growth([], 30), null);
});

test('growth lida com inscritos ocultos', () => {
  const h = [['2026-09-01', null, 10, 1, null], ['2026-09-10', null, 30, 2, null]];
  const g = growth(h, 30);
  assert.equal(g.dSubs, null);
  assert.equal(g.monthlyPct, null);
  assert.equal(g.dViews, 20);
});

test('channelMetrics e isRisingSmall', () => {
  const m = channelMetrics(hist, { publishedAt: '2026-01-01' }, new Date('2026-10-03T12:00:00Z'));
  assert.equal(m.subs, 1500);
  assert.equal(m.daysSinceUpload, 3);
  assert.equal(m.historyDays, 30);
  assert.ok(Math.abs(m.momentum - 0.5) < 1e-9);
  assert.ok(isRisingSmall(m));
  assert.ok(!isRisingSmall(m, { maxSubs: 1000, minMonthlyPct: 0.1, minSubs: 0 }));
  assert.ok(!isRisingSmall({ ...m, momentum: null }));
});

test('nicheStats agrega por tag e conta canais sem nicho', () => {
  const rows = [
    { channel: { tags: ['a', 'b'] }, metrics: { subs: 100, momentum: 0.2, daysSinceUpload: 5 }, rising: true },
    { channel: { tags: ['a'] }, metrics: { subs: 300, momentum: 0.4, daysSinceUpload: 60 }, rising: false },
    { channel: { tags: [] }, metrics: { subs: 50, momentum: null, daysSinceUpload: null }, rising: false },
  ];
  const byTag = Object.fromEntries(nicheStats(rows).map((n) => [n.tag, n]));
  assert.equal(byTag.a.count, 2);
  assert.equal(byTag.a.totalSubs, 400);
  assert.ok(Math.abs(byTag.a.medianMomentum - 0.3) < 1e-9);
  assert.equal(byTag.a.activeShare, 0.5);
  assert.equal(byTag.a.risingCount, 1);
  assert.equal(byTag.b.count, 1);
  assert.equal(byTag['sem nicho'].count, 1);
});

test('chainIndex não salta quando um canal entra no meio', () => {
  const a = [['2026-09-01', 100], ['2026-09-02', 110], ['2026-09-03', 121]];
  const b = [['2026-09-02', 1000000], ['2026-09-03', 1000000]];
  const idx = chainIndex([a, b]);
  assert.equal(idx[0][1], 100);
  assert.ok(Math.abs(idx[1][1] - 110) < 1e-9);
  // dia 3: (121 + 1e6) / (110 + 1e6) — próximo de 110, sem salto de 1e6
  assert.ok(idx[2][1] > 110 && idx[2][1] < 110.01);
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([null, undefined]), null);
});
