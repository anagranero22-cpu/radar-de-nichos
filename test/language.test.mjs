import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normLang, detectLanguage } from '../docs/js/language.js';
import { refKey } from '../docs/js/refs.js';
import { languageName } from '../docs/js/format.js';

test('normLang', () => {
  assert.equal(normLang('pt-BR'), 'pt');
  assert.equal(normLang('EN_us'), 'en');
  assert.equal(normLang('zxx'), null);
  assert.equal(normLang(undefined), null);
});

test('detectLanguage: áudio dos vídeos > idioma declarado > país', () => {
  assert.deepEqual(detectLanguage({ videoLanguages: ['de', 'de-DE', 'en', null], declared: 'en', country: 'US' }), {
    language: 'de',
    source: 'vídeos',
  });
  assert.deepEqual(detectLanguage({ videoLanguages: [null, 'zxx'], declared: 'es-419', country: 'BR' }), {
    language: 'es',
    source: 'canal',
  });
  assert.deepEqual(detectLanguage({ country: 'DE' }), { language: 'de', source: 'país' });
  assert.deepEqual(detectLanguage({}), { language: null, source: null });
});

test('refKey reconhece o mesmo canal escrito de formas diferentes', () => {
  const k = refKey('@GrundrissDeutschland');
  assert.equal(k, '@grundrissdeutschland');
  assert.equal(refKey('https://www.youtube.com/@GrundrissDeutschland/videos'), k);
  assert.equal(refKey('youtube.com/@grundrissdeutschland'), k);
  assert.equal(refKey('https://www.youtube.com/watch?v=v--_RvubQe4&t=37s'), null);
});

test('languageName em português', () => {
  assert.equal(languageName('de'), 'Alemão');
  assert.equal(languageName('en'), 'Inglês');
  assert.equal(languageName(null), null);
});
