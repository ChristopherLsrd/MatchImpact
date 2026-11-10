'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameState } = require('../../src/adapters/GameState');
const { assertPort } = require('../../src/application/ports');

function fakeQuery(rows, { throws = false } = {}) {
  const calls = [];
  const fn = (sql, params) => {
    calls.push({ sql, params });
    if (throws) throw new Error('No database is currently loaded');
    return rows;
  };
  fn.calls = calls;
  return fn;
}

test('respecte le contrat GameState', () => {
  assertPort('GameState', createGameState({ getState: () => null }, fakeQuery([])));
});

test('renvoie la promotion donnée par le jeu', () => {
  const query = fakeQuery([]);
  assert.equal(createGameState({ getState: () => ({ promotionId: '190' }) }, query).playerPromotionId(), 190);
  assert.equal(query.calls.length, 0);
});

// Le jeu lit saveInfo.promotionID, colonne absente des sauvegardes : promotionId vaut null.
test('lit saveInfo.saveUserPromotion quand le jeu ne donne pas la promotion', () => {
  const query = fakeQuery([{ saveUserPromotion: 134 }]);
  assert.equal(createGameState({ getState: () => ({ promotionId: null }) }, query).playerPromotionId(), 134);
  assert.match(query.calls[0].sql, /SELECT saveUserPromotion FROM saveInfo/);
  assert.deepEqual(query.calls[0].params, []);
});

test('lit aussi la base quand getState renvoie null', () => {
  assert.equal(createGameState({ getState: () => null }, fakeQuery([{ saveUserPromotion: '134' }])).playerPromotionId(), 134);
});

test('renvoie null sans sauvegarde chargée ou sans promotion', () => {
  assert.equal(createGameState({ getState: () => null }, fakeQuery([])).playerPromotionId(), null);
  assert.equal(createGameState({ getState: () => ({}) }, fakeQuery([{ saveUserPromotion: null }])).playerPromotionId(), null);
  assert.equal(createGameState({ getState: () => null }, fakeQuery([], { throws: true })).playerPromotionId(), null);
});
