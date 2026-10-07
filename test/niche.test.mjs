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
  assert.equal(r.niches[0], 'construção civil');
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
  assert.deepEqual(cpmTier(['construção civil']), { tier: 'medio', source: 'automático' });
  assert.ok(TAXONOMY.every((n) => ['alto', 'medio', 'baixo'].includes(n.cpm)));
});

test('tagsOf prefere as tags da linha (manuais ou automáticas)', () => {
  assert.deepEqual(tagsOf({ tags: ['games'], channel: { tags: [] } }), ['games']);
  assert.deepEqual(tagsOf({ channel: { tags: ['x'] } }), ['x']);
  assert.deepEqual(tagsOf({ tags: [], channel: {} }), ['sem nicho']);
});

test('prepping e energia off-grid (canais em inglês)', () => {
  const prep = classifyNiche({
    title: 'Ray Sutter',
    recent: [
      { t: '13 Survival Foods Experienced Preppers Quietly Stockpile' },
      { t: 'These 15 Must-Have Prepping Items to Survive a Winter Power Outage' },
      { t: '5 Emergency Indoor Cooking Methods That Actually Work Without Power' },
    ],
  });
  assert.deepEqual(prep.niches, ['prepping & sobrevivência']);
  const offgrid = classifyNiche({
    title: 'Builds With Eli Yoder',
    recent: [
      { t: 'This $299 Lidl Balcony Battery Powers Any Home All Winter — No Solar' },
      { t: 'This $40 DIY 3-in-1 Heater Warms Any Home All Winter — Zero Electricity' },
    ],
  });
  assert.equal(offgrid.niches[0], 'energia & off-grid');
});

// Casos reais dos critérios (CRITERIOS_DE_NICHO.md): o que é decoração é decoração.
test('nichos da casa seguem os critérios: decoração, organização, arquitetura, construção, transformação', () => {
  const planarq = classifyNiche({
    title: 'PLANARQ CAMPOS / Ralph Dias',
    description: 'Sou arquiteto e ajudo pessoas a construírem suas casas com responsabilidade, fugindo da auto construção (arquitetura e engenharia).',
    recent: [
      { t: '7 SOLUÇÕES QUE NÃO FUNCIONAM NA SUA CASA! NÃO GASTE DINHEIRO COM ISSO', s: 1200 },
      { t: '5 COISAS QUE NÃO GOSTO EM BALCÃO DE COZINHA #design #home', s: 90 },
      { t: '10 DECORAÇÕES CORINGAS QUE SEMPRE FUNCIONAM NA SUA CASA!', s: 1100 },
      { t: '7 DECORAÇÕES QUE FAZEM PARECER QUE FALTOU DINHEIRO NA SUA CASA', s: 1080 },
      { t: '10 ITENS DE LUXO QUE NÃO VALEM A PENA NA SUA CASA ?', s: 1080 },
    ],
  });
  assert.equal(planarq.niches[0], 'decoração');

  const homeCentral = classifyNiche({
    title: 'Home Central',
    recent: [
      { t: '18 Italian Home Secrets That Simplify Your Entire Life', s: 1980 },
      { t: '10 Horrible Home Features You\'ll Regret in 2027', s: 1740 },
      { t: '20 Small House Features That Should Be Standard in Every House', s: 1980 },
      { t: '12 Things That Make a Home Feel More Expensive Instantly', s: 1860 },
    ],
  });
  assert.equal(homeCentral.niches[0], 'decoração');

  const matheus = classifyNiche({
    title: 'Engenheiro Matheus',
    recent: [
      { t: 'Laje Sem Telhado Dá Problema? Respondendo às Críticas', s: 1140 },
      { t: 'Os Erros que Fazem Sua Casa Virar um Forno', s: 1740 },
      { t: '5 Detalhes de Obra que Muita Gente Só Percebe Tarde Demais', s: 1500 },
      { t: 'A verdade chocante sobre quanto custa construir em 2026', s: 960 },
    ],
  });
  assert.equal(matheus.niches[0], 'construção civil');

  const will = classifyNiche({
    title: 'Will Arquitetura',
    recent: [
      { t: 'PROJETO DE REFORMA CASA ESTILO CLÁSSICO', s: 120 },
      { t: 'Como Fazer Sua Casa Pequena Parecer Maior!', s: 780 },
      { t: 'NÃO COMECE SUA REFORMA antes de ver isso!', s: 720 },
      { t: 'Como Eu Construiria uma Casa em 2026!', s: 720 },
    ],
  });
  assert.equal(will.niches[0], 'arquitetura & reforma');

  const rustline = classifyNiche({
    title: 'Rustline',
    recent: [
      { t: 'I Turned This Abandoned Jungle Site into a Dream Luxury Home | Timelapse & ASMR', s: 780 },
      { t: "The Most Satisfying Renovation I've Ever Built (No Talking)", s: 840 },
      { t: 'Satisfying Abandoned House Makeover | Vines to Luxury Modern Home', s: 840 },
    ],
  });
  assert.equal(rustline.niches[0], 'transformação de casas');

  const twoHouses = classifyNiche({
    title: 'Two Houses by Ken Tsukamoto',
    recent: [
      { t: 'Perfectly Good Stuff Is Still JUNK — The Japanese Way to Let It Go', s: 1200 },
      { t: 'Your House Will Make You HELPLESS at 70 — 11 Things Japanese Homes Throw Out', s: 1200 },
      { t: "Your House Isn't Messy. You Own Too Much — What a Japanese Mother Would Throw Out", s: 1200 },
    ],
  });
  assert.equal(twoHouses.niches[0], 'organização da casa');
});

test('Shorts não contam na classificação quando há vídeos longos', () => {
  const r = classifyNiche({
    title: 'Canal Y',
    recent: [
      { t: 'Laje e telhado: obra completa', s: 40 },
      { t: 'Concreto na fundação', s: 50 },
      { t: '10 decorações para sua sala de estar', s: 900 },
      { t: 'Cortinas e tapetes que deixam a casa aconchegante', s: 840 },
    ],
  });
  assert.deepEqual(r.niches, ['decoração']);
});
