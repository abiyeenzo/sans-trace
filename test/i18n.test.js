const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../js/i18n.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('les dictionnaires FR et EN ont les memes cles', () => {
  const fr = Object.keys(L.dicts.fr).sort();
  const en = Object.keys(L.dicts.en).sort();
  assert.deepStrictEqual(en, fr);
  for (const k of en) assert.ok(L.dicts.en[k].length > 0, 'vide : ' + k);
});

test('chaque cle data-i18n de la page existe', () => {
  const keys = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 40);
  for (const k of keys) assert.ok(L.dicts.fr[k], 'cle inconnue : ' + k);
});

test('le texte francais de la page correspond au dictionnaire FR', () => {
  const m = /data-i18n="text\.h1">([^<]+)</.exec(html);
  assert.strictEqual(m[1], L.dicts.fr['text.h1']);
});

test('detection de la langue du navigateur', () => {
  assert.strictEqual(L.detect({ language: 'fr-FR' }), 'fr');
  assert.strictEqual(L.detect({ language: 'en-US' }), 'en');
  assert.strictEqual(L.detect({ language: 'de' }), 'en');
});

test('t interpole les variables et tr traduit les libelles des modules', () => {
  L.setLang('en');
  assert.strictEqual(L.t('count.dashes', { n: 3 }), '3 long dashes replaced');
  assert.strictEqual(L.tr('EXIF avec position GPS'), 'EXIF with GPS location');
  assert.strictEqual(L.tr('Segment APP14'), 'APP14 segment');
  assert.strictEqual(L.tr('texte inconnu'), 'texte inconnu');
  L.setLang('fr');
  assert.strictEqual(L.tr('Auteur'), 'Auteur');
});
