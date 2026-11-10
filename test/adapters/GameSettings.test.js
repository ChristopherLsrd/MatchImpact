'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameSettings } = require('../../src/adapters/GameSettings');
const { SETTINGS_SCHEMA, assertPort } = require('../../src/application/ports');

function fakeSettingsApi(values = {}) {
  return {
    registered: null,
    writes: [],
    register(schema) { this.registered = schema; },
    get(key) { return values[key]; },
    set(key, value) { this.writes.push([key, value]); values[key] = value; },
  };
}

test('enregistre le schéma des réglages', () => {
  const api = fakeSettingsApi();
  createGameSettings(api);
  assert.deepEqual(api.registered.map((s) => s.key), SETTINGS_SCHEMA.map((s) => s.key));
});

test('respecte le contrat Settings', () => {
  assertPort('Settings', createGameSettings(fakeSettingsApi()));
});

test('renvoie la valeur enregistrée, y compris false et 0', () => {
  const settings = createGameSettings(fakeSettingsApi({ trackSkills: false, minDelta: 0 }));
  assert.equal(settings.get('trackSkills'), false);
  assert.equal(settings.get('minDelta'), 0);
});

test('renvoie le défaut si la valeur est absente', () => {
  const settings = createGameSettings(fakeSettingsApi({ historySize: null }));
  assert.equal(settings.get('historySize'), 20);
  assert.equal(settings.get('trackRelationships'), true);
});

test('set enregistre la valeur auprès du jeu', () => {
  const api = fakeSettingsApi();
  const settings = createGameSettings(api);
  settings.set('trackSkills', false);
  assert.deepEqual(api.writes, [['trackSkills', false]]);
  assert.equal(settings.get('trackSkills'), false);
});
