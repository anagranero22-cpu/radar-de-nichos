import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNiche, normalize, taxonomyTier, TAXONOMY } from '../docs/js/niche.js';
import { cpmTier } from '../docs/js/insights.js';
import { tagsOf } from '../docs/js/metrics.js';

test('normalize remove acentos, ß e pontuação', () => {
  assert.equal(normalize('Häuser & Straße — Ação!'), ' hauser strasse acao ');
});

test('classifica canal alemão de construção pelos títulos e nome', () => {
  const r = classifyNiche({
    title: 'Grundriss Deutschland',
    description: 'Warum unsere Häuser so sind. Kein Bau-Ratgeber.',
    recent: [
      { t: 'Warum Deutschland keine Klimaanlagen einbaut' },
      { t: 'Warum Deutschland seine Häuser in Styropor packt' },
      { t: 'Was wurde aus dem deutschen Vorgärten?' },
    ],
  });
  assert.deepEqual(r.niches, ['construção & arquitetura']);
  assert.equal(r.confidence, 'alta');
});

test('usa tópicos do YouTube e categoria predominante dos vídeos', () => {
  const r = classifyNiche({
    title: 'Canal X',
    recent: [{ t: 'Episódio 1', c: '20' }, { t: 'Episódio 2', c: '20' }, { t: 'Episódio 3', c: '20' }],
    topics: ['Video_game_culture'],
  });
  assert.deepEqual(r.niches, ['games']);
});

test('dois nichos quando o segundo é forte; nenhum quando não há sinal', () => {
  const r = classifyNiche({
    title: 'Ratgeber Gesundheit',
    recent: [{ t: '7 Honig-Marken im Ranking' }, { t: 'Diese Vitamine schützen dein Herz' }, { t: 'Zucker: die Wahrheit' }],
  });
  assert.deepEqual(r.niches, ['saúde', 'nutrição']);
  assert.deepEqual(classifyNiche({ title: 'Vlog do Zé', recent: [{ t: 'Meu dia' }] }).niches, []);
});

test('palavras exatas não casam dentro de outras palavras', () => {
  // "ia$" não deve casar com "ideia"/"dia"; "ai$" não casa com "pai".
  const r = classifyNiche({ title: 'Ideias do dia', recent: [{ t: 'Meu pai e a ideia' }, { t: 'Um dia comum' }] });
  assert.ok(!r.niches.includes('inteligência artificial'));
});

test('CPM vem da taxonomia para nichos detectados', () => {
  assert.equal(taxonomyTier('finanças'), 'alto');
  assert.equal(taxonomyTier('Games'), 'baixo');
  assert.deepEqual(cpmTier(['construção & arquitetura']), { tier: 'medio', source: 'automático' });
  assert.ok(TAXONOMY.every((n) => ['alto', 'medio', 'baixo'].includes(n.cpm)));
});

test('tagsOf prefere as tags da linha (manuais ou automáticas)', () => {
  assert.deepEqual(tagsOf({ tags: ['games'], channel: { tags: [] } }), ['games']);
  assert.deepEqual(tagsOf({ channel: { tags: ['x'] } }), ['x']);
  assert.deepEqual(tagsOf({ tags: [], channel: {} }), ['sem nicho']);
});
