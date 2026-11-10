'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { STATS, GROUPS } = require('../../src/domain/stats');

const keysOf = (group) => STATS.filter((s) => s.group === group).map((s) => s.key);

test('chaque stat a une forme complète, sans libellé', () => {
  for (const s of STATS) {
    assert.equal(typeof s.key, 'string');
    assert.equal('label' in s, false, `libellé inattendu pour ${s.key}`);
    assert.ok(GROUPS.includes(s.group), `groupe inconnu pour ${s.key}`);
    assert.ok(['workers', 'contracts'].includes(s.table), `table inconnue pour ${s.key}`);
    assert.equal(typeof s.inverted, 'boolean');
  }
});

test('les clés sont uniques', () => {
  const keys = STATS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('seule la fatigue a un sens inversé', () => {
  assert.deepEqual(STATS.filter((s) => s.inverted).map((s) => s.key), ['fatigue']);
});

test('popularité : les six régions de la table workers', () => {
  assert.deepEqual(keysOf('popularity'), [
    'northAmericaPop', 'southAmericaPop', 'europePop', 'asiaPop', 'oceaniaPop', 'africaPop',
  ]);
  assert.ok(STATS.filter((s) => s.group === 'popularity').every((s) => s.table === 'workers'));
});

test('momentum et moral viennent du contrat', () => {
  assert.deepEqual(keysOf('momentumMorale'), ['momentum', 'morale']);
  assert.ok(STATS.filter((s) => s.group === 'momentumMorale').every((s) => s.table === 'contracts'));
});

test('forme : fatigue et endurance', () => {
  assert.deepEqual(keysOf('condition'), ['fatigue', 'stamina']);
});

test('talent : stats simples puis détaillées', () => {
  assert.deepEqual(keysOf('skills'), [
    'wrestlingSkill', 'entertainment', 'starPower', 'psychology', 'charisma',
    'brawling', 'technical', 'aerial', 'puroresu', 'acting',
    'basics', 'consistency', 'athleticism', 'toughness', 'resilience',
  ]);
});

test('le catalogue est gelé', () => {
  assert.ok(Object.isFrozen(STATS));
  assert.ok(STATS.every((s) => Object.isFrozen(s)));
});
