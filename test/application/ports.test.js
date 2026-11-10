'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SETTINGS_SCHEMA, assertPort, assertSnapshot, assertSegments,
} = require('../../src/application/ports');
const fakes = require('../fakes');

test('les réglages ont les clés et défauts de la spec', () => {
  const defaults = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  assert.deepEqual(defaults, {
    showEndOfShowPanel: true,
    onlyMyPromotion: true,
    trackPopularity: true,
    trackMomentumMorale: true,
    trackCondition: true,
    trackSkills: true,
    trackRelationships: true,
    minDelta: 0.5,
    historySize: 20,
  });
});

test('les réglages numériques ont des bornes', () => {
  const byKey = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s]));
  assert.deepEqual([byKey.minDelta.min, byKey.minDelta.max], [0, 10]);
  assert.deepEqual([byKey.historySize.min, byKey.historySize.max], [1, 100]);
  assert.ok(SETTINGS_SCHEMA.every((s) => typeof s.label === 'string' && typeof s.description === 'string'));
});

test('les faux ports respectent les contrats', () => {
  assertPort('RosterReader', fakes.createFakeRoster());
  assertPort('HistoryStore', fakes.createFakeHistoryStore());
  assertPort('RecapView', fakes.createFakeView());
  assertPort('Settings', fakes.createFakeSettings());
  assertPort('GameState', fakes.createFakeGameState());
  assertPort('Logger', fakes.createFakeLogger());
});

test('assertPort refuse une méthode manquante', () => {
  assert.throws(() => assertPort('HistoryStore', { load() {} }), TypeError);
});

test('assertPort refuse un port inconnu ou une valeur vide', () => {
  assert.throws(() => assertPort('Nope', {}), TypeError);
  assert.throws(() => assertPort('Logger', null), TypeError);
});

test('assertSnapshot accepte une photo valide et refuse une photo invalide', () => {
  const ok = { workers: [{ workerID: 1, name: 'A', stats: {}, injuryType: null, injuryHealDate: null }], relations: [{ worker1: 1, worker2: 2, value: 3 }] };
  assert.equal(assertSnapshot(ok), ok);
  assert.throws(() => assertSnapshot({ workers: [{ workerID: '1', name: 'A', stats: {} }], relations: [] }), TypeError);
  assert.throws(() => assertSnapshot({ workers: [] }), TypeError);
});

test('assertSegments accepte un card valide et refuse un card invalide', () => {
  const ok = [{ segmentID: 1, name: 'A', type: 'Match', rating: 50, workers: [{ workerID: 1, name: 'A' }] }];
  assert.equal(assertSegments(ok), ok);
  assert.throws(() => assertSegments([{ name: 'A', type: 'Match', workers: [{ workerID: 1 }] }]), TypeError);
  assert.throws(() => assertSegments(null), TypeError);
});
