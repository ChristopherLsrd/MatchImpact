'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { addToHistory } = require('../../src/domain/history');

test('ajoute le récap en tête', () => {
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 5), [{ id: 2 }, { id: 1 }]);
});

test('tronque à la taille maximale', () => {
  const list = [{ id: 3 }, { id: 2 }, { id: 1 }];
  assert.deepEqual(addToHistory(list, { id: 4 }, 3), [{ id: 4 }, { id: 3 }, { id: 2 }]);
});

test('ne modifie pas la liste reçue', () => {
  const list = [{ id: 1 }];
  addToHistory(list, { id: 2 }, 5);
  assert.deepEqual(list, [{ id: 1 }]);
});

test('traite une liste invalide comme vide', () => {
  assert.deepEqual(addToHistory(null, { id: 1 }, 5), [{ id: 1 }]);
});

test('une taille invalide garde au moins un récap', () => {
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 0), [{ id: 2 }]);
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 'abc'), [{ id: 2 }]);
});
