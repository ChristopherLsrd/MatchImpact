'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStorageHistoryStore } = require('../../src/adapters/StorageHistoryStore');
const { assertPort } = require('../../src/application/ports');

function fakeStorage(value, { throws = false } = {}) {
  return {
    writes: [],
    readJSON(name) {
      this.lastRead = name;
      if (throws) throw new SyntaxError('Unexpected token');
      return value;
    },
    writeJSON(name, data) { this.writes.push([name, data]); },
  };
}

test('respecte le contrat HistoryStore', () => {
  assertPort('HistoryStore', createStorageHistoryStore(fakeStorage(null)));
});

test('lit history.json', () => {
  const storage = fakeStorage([{ showName: 'A' }]);
  assert.deepEqual(createStorageHistoryStore(storage).load(), [{ showName: 'A' }]);
  assert.equal(storage.lastRead, 'history.json');
});

test('renvoie une liste vide si le fichier est absent', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage(null)).load(), []);
});

test('renvoie une liste vide si le JSON est invalide', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage(null, { throws: true })).load(), []);
});

test('renvoie une liste vide si le contenu n\'est pas un tableau', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage({ a: 1 })).load(), []);
});

test('écrit la liste dans history.json', () => {
  const storage = fakeStorage(null);
  createStorageHistoryStore(storage).save([{ showName: 'A' }]);
  assert.deepEqual(storage.writes, [['history.json', [{ showName: 'A' }]]]);
});
