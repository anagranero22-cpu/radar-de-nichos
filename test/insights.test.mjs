import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration } from '../docs/js/refs.js';
import {
  suggestTier,
  cpmTier,
  recentStats,
  estimateEarnings,
  opportunityScore,
  verdict,
  thesis,
  isOutlier,
} from '../docs/js/insights.js';

test('parseDuration', () => {
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('PT45S'), 45);
  assert.equal(parseDuration('P1DT1S'), 86401);
  assert.equal(parseDuration(undefined), null);
});

test('faixa de CPM: sugestão, a mais alta entre as tags e ajuste manual', () => {
  assert.equal(suggestTier('Finanças Pessoais'), 'alto');
  assert.equal(suggestTier('culinária'), 'medio');
  assert.equal(suggestTier('true crime'), 'baixo');
  assert.equal(suggestTier('IA'), 'alto');
  assert.equal(suggestTier('xyz'), null);
  assert.deepEqual(cpmTier(['dark', 'finanças']), { tier: 'alto', source: 'automático' });
  assert.deepEqual(cpmTier(['dark'], { dark: 'medio' }), { tier: 'medio', source: 'manual' });
  assert.deepEqual(cpmTier(['xyz']), { tier: 'medio', source: 'padrão' });
});

const recent = [
  { id: 'a', t: 'Viral', d: '2026-09-30', v: 100000, s: 600 },
  { id: 'b', t: 'B', d: '2026-09-23', v: 10000, s: 620 },
  { id: 'c', t: 'C', d: '2026-09-16', v: 12000, s: 45 },
  { id: 'd', t: 'D', d: '2026-08-01', v: 8000, s: 700 },
];

test('recentStats', () => {
  const rs = recentStats(recent, 5000, '2026-10-03');
  assert.equal(rs.median, 11000);
  assert.equal(rs.top.id, 'a');
  assert.ok(Math.abs(rs.outlierRatio - 100000 / 11000) < 1e-9);
  assert.ok(Math.abs(rs.viewsPerSub - 2.2) < 1e-9);
  assert.equal(rs.shortsShare, 0.25);
  assert.equal(rs.last30Views, 122000);
  assert.ok(rs.perWeek > 0.4 && rs.perWeek < 0.5); // 4 vídeos em 63 dias
  assert.ok(isOutlier(recent[0], rs.median));
  assert.ok(!isOutlier(recent[1], rs.median));
  assert.equal(recentStats([], 100).median, null);
});

test('ganhos estimados usam ritmo do histórico e descontam Shorts', () => {
  const e = estimateEarnings({ viewsPerDay: 1000 }, { shortsShare: 0 }, 'alto');
  assert.equal(e.monthlyViews, 30000);
  assert.equal(e.min, 120);
  assert.equal(e.max, 360);
  const shorts = estimateEarnings({ viewsPerDay: 1000 }, { shortsShare: 1 }, 'alto');
  assert.ok(Math.abs(shorts.max - 36) < 1e-9);
  const fallback = estimateEarnings({ viewsPerDay: null, views: 3650, ageDays: 365 }, null, 'baixo');
  assert.equal(fallback.basis, 'média de vida');
  assert.equal(estimateEarnings({ viewsPerDay: null, views: null }, null, 'baixo').min, null);
});

test('score e veredito', () => {
  const rs = recentStats(recent, 5000, '2026-10-03');
  const strong = opportunityScore({ subs: 5000, momentum: 0.3, daysSinceUpload: 3 }, rs, 'alto');
  assert.equal(strong.score, 100);
  assert.equal(verdict(strong.score).key, 'testar');
  const weak = opportunityScore({ subs: 2e6, momentum: 0, daysSinceUpload: 90 }, { viewsPerSub: 0.01 }, 'baixo');
  assert.ok(weak.score < 45);
  assert.equal(verdict(weak.score).key, 'observar');
});

test('tese descreve os sinais do canal', () => {
  const rs = recentStats(recent, 5000, '2026-10-03');
  const row = { title: 'Canal X', channel: { tags: ['finanças'] }, metrics: { subs: 5000, momentum: 0.2, ageDays: 200 } };
  const text = thesis(row, rs, 'alto', { min: 10, max: 30 });
  assert.match(text, /Canal X se destaca em finanças/);
  assert.match(text, /“Viral”/);
  assert.match(text, /canal jovem \(7 meses\)/);
  assert.match(text, /CPM alto/);
});
