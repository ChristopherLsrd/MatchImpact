'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameState } = require('../../src/adapters/GameState');
const { assertPort } = require('../../src/application/ports');

test('respecte le contrat GameState', () => {
  assertPort('GameState', createGameState({ getState: () => null }));
});

test('renvoie la promotion du joueur', () => {
  assert.equal(createGameState({ getState: () => ({ promotionId: '190' }) }).playerPromotionId(), 190);
});

test('renvoie null sans sauvegarde chargée ou sans promotion', () => {
  assert.equal(createGameState({ getState: () => null }).playerPromotionId(), null);
  assert.equal(createGameState({ getState: () => ({}) }).playerPromotionId(), null);
});
