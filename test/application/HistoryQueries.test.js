'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistoryQueries } = require('../../src/application/HistoryQueries');
const fakes = require('../fakes');

const RECAPS = [
  { showID: 8, showName: 'Weekly #2', date: '2026-02-20', promotionID: 1, segments: [], workers: [], relations: [] },
  { showID: 7, showName: 'Weekly #1', date: '2026-02-13', promotionID: 1, segments: [], workers: [], relations: [] },
];

function setup(store = fakes.createFakeHistoryStore(RECAPS)) {
  const logger = fakes.createFakeLogger();
  return { logger, queries: createHistoryQueries({ history: store, logger }) };
}

test('liste les shows archivés, du plus récent au plus ancien', () => {
  const { queries } = setup();
  assert.deepEqual(queries.listHistory(), [
    { index: 0, showName: 'Weekly #2', date: '2026-02-20', showID: 8 },
    { index: 1, showName: 'Weekly #1', date: '2026-02-13', showID: 7 },
  ]);
});

test('renvoie un récap par index', () => {
  const { queries } = setup();
  assert.equal(queries.getRecap(1).showName, 'Weekly #1');
});

test('renvoie null pour un index hors limites ou invalide', () => {
  const { queries } = setup();
  assert.equal(queries.getRecap(5), null);
  assert.equal(queries.getRecap(-1), null);
  assert.equal(queries.getRecap('x'), null);
});

test('renvoie une liste vide et journalise si le stockage échoue', () => {
  const store = fakes.createFakeHistoryStore();
  store.load = () => { throw new Error('io'); };
  const { queries, logger } = setup(store);
  assert.deepEqual(queries.listHistory(), []);
  assert.equal(queries.getRecap(0), null);
  assert.equal(logger.errors.length, 2);
});
