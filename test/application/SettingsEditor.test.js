'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSettingsEditor } = require('../../src/application/SettingsEditor');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');
const fakes = require('../fakes');

function setup(overrides = {}) {
  const settings = fakes.createFakeSettings(overrides);
  const logger = fakes.createFakeLogger();
  return { settings, logger, editor: createSettingsEditor({ settings, logger }) };
}

test('refuse un port manquant', () => {
  assert.throws(() => createSettingsEditor({}), TypeError);
});

test('getAll renvoie toutes les clés du schéma', () => {
  const { editor } = setup({ trackSkills: false });
  const all = editor.getAll();
  assert.deepEqual(Object.keys(all), SETTINGS_SCHEMA.map((s) => s.key));
  assert.equal(all.trackSkills, false);
  assert.equal(all.historySize, 20);
});

test('enregistre un booléen', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('trackSkills', false), { ok: true, value: false });
  assert.equal(settings.get('trackSkills'), false);
});

test('refuse un booléen invalide', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('trackSkills', 'false'), { ok: false });
  assert.equal(settings.get('trackSkills'), true);
});

test('ramène un nombre dans ses bornes', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('minDelta', 25), { ok: true, value: 10 });
  assert.deepEqual(editor.set('minDelta', -1), { ok: true, value: 0 });
  assert.deepEqual(editor.set('minDelta', 2.5), { ok: true, value: 2.5 });
  assert.equal(settings.get('minDelta'), 2.5);
});

test('arrondit la taille de l\'historique à l\'entier', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('historySize', 12.6), { ok: true, value: 13 });
  assert.deepEqual(editor.set('historySize', 0.2), { ok: true, value: 1 });
});

test('refuse un nombre non fini ou d\'un autre type', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('minDelta', Number.NaN), { ok: false });
  assert.deepEqual(editor.set('minDelta', Infinity), { ok: false });
  assert.deepEqual(editor.set('minDelta', '3'), { ok: false });
});

test('refuse une clé inconnue', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('hack', true), { ok: false });
  assert.deepEqual(editor.set('__proto__', true), { ok: false });
});

test('journalise une erreur d\'écriture', () => {
  const logger = fakes.createFakeLogger();
  const settings = { get: () => true, set: () => { throw new Error('disque plein'); } };
  const editor = createSettingsEditor({ settings, logger });
  assert.deepEqual(editor.set('trackSkills', false), { ok: false });
  assert.equal(logger.errors.length, 1);
});
