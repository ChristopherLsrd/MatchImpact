'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLocale, t, statLabel, MESSAGES, STAT_LABELS } = require('../../src/presentation/i18n');
const { STATS } = require('../../src/domain/stats');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

test('resolveLocale : français si le code commence par fr, sinon anglais', () => {
  assert.equal(resolveLocale('fr'), 'fr');
  assert.equal(resolveLocale('fr-FR'), 'fr');
  assert.equal(resolveLocale('FR'), 'fr');
  assert.equal(resolveLocale('en'), 'en');
  assert.equal(resolveLocale('de'), 'en');
  assert.equal(resolveLocale(''), 'en');
  assert.equal(resolveLocale(null), 'en');
  assert.equal(resolveLocale(undefined), 'en');
});

test('les deux langues ont les mêmes clés', () => {
  assert.deepEqual(Object.keys(MESSAGES.fr).sort(), Object.keys(MESSAGES.en).sort());
  assert.deepEqual(Object.keys(STAT_LABELS.fr).sort(), Object.keys(STAT_LABELS.en).sort());
});

test('chaque stat a un libellé dans les deux langues', () => {
  for (const s of STATS) {
    assert.ok(STAT_LABELS.en[s.key], `en : ${s.key}`);
    assert.ok(STAT_LABELS.fr[s.key], `fr : ${s.key}`);
  }
});

test('chaque réglage a un libellé et une aide dans les deux langues', () => {
  for (const s of SETTINGS_SCHEMA) {
    for (const lang of ['en', 'fr']) {
      assert.ok(MESSAGES[lang][`setting.${s.key}.label`], `${lang} : setting.${s.key}.label`);
      assert.equal(typeof MESSAGES[lang][`setting.${s.key}.help`], 'string', `${lang} : setting.${s.key}.help`);
    }
  }
});

test('t traduit et remplace les paramètres', () => {
  assert.equal(t('fr', 'wrestlers.many', { n: 3 }), '3 catcheurs');
  assert.equal(t('en', 'wrestlers.one', { n: 1 }), '1 wrestler');
  assert.equal(t('de', 'injury'), 'Injury');
  assert.equal(t('fr', 'injuryReturn', { type: 'Broken Arm', date: '2026-03-01' }), 'Broken Arm (retour 2026-03-01)');
});

test('t renvoie la clé si elle est inconnue et garde un paramètre manquant', () => {
  assert.equal(t('fr', 'nope.key'), 'nope.key');
  assert.equal(t('en', 'photoOf'), 'Photo of {name}');
});

test('statLabel traduit et renvoie la clé si la stat est inconnue', () => {
  assert.equal(statLabel('fr', 'stamina'), 'Endurance');
  assert.equal(statLabel('en', 'stamina'), 'Stamina');
  assert.equal(statLabel(undefined, 'europePop'), 'Pop Europe');
  assert.equal(statLabel('fr', 'mystery'), 'mystery');
});
