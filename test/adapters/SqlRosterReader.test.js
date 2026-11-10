'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqlRosterReader } = require('../../src/adapters/SqlRosterReader');
const { STATS } = require('../../src/domain/stats');
const { assertPort, assertSnapshot, assertSegments } = require('../../src/application/ports');

function fakeQuery(responses) {
  const calls = [];
  const fn = (sql, params) => {
    calls.push({ sql, params });
    const next = responses.shift();
    return next === undefined ? [] : next;
  };
  fn.calls = calls;
  return fn;
}

function row(id, extra = {}) {
  const r = { workerID: id, name: `W${id}`, injuryType: '', injuryHealDate: null };
  for (const s of STATS) r[s.key] = 10;
  return { ...r, ...extra };
}

function assertNoLiteral(calls) {
  for (const { sql, params } of calls) {
    for (const p of params) assert.ok(!sql.includes(String(p)), `valeur ${p} concaténée dans : ${sql}`);
  }
}

test('respecte le contrat RosterReader', () => {
  assertPort('RosterReader', createSqlRosterReader(fakeQuery([])));
});

test('readRoster lit les contrats actifs de la promotion puis leurs relations', () => {
  const query = fakeQuery([[row(3), row(4)], [{ worker1: 4, worker2: 3, relationship: 12 }]]);
  const snapshot = createSqlRosterReader(query).readRoster(190);
  const [roster, relations] = query.calls;
  assert.match(roster.sql, /WHERE c\.promotionID = \? AND c\.expired = 0/);
  assert.deepEqual(roster.params, [190]);
  for (const s of STATS) assert.match(roster.sql, new RegExp(`\\b${s.key}\\b`));
  assert.match(relations.sql, /worker1 IN \(\?, \?\) AND worker2 IN \(\?, \?\)/);
  assert.deepEqual(relations.params, [3, 4, 3, 4]);
  assertSnapshot(snapshot);
  assert.deepEqual(snapshot.relations, [{ worker1: 4, worker2: 3, value: 12 }]);
  assertNoLiteral(query.calls);
});

test('convertit une ligne en WorkerRow', () => {
  const query = fakeQuery([[row(3, { momentum: null, entertainment: 62.5, injuryType: 'Sprain', injuryHealDate: '2026-03-01' })], []]);
  const w = createSqlRosterReader(query).readRoster(190).workers[0];
  assert.equal(w.workerID, 3);
  assert.equal(w.name, 'W3');
  assert.equal(w.stats.momentum, null);
  assert.equal(w.stats.entertainment, 62.5);
  assert.equal(w.injuryType, 'Sprain');
  assert.equal(w.injuryHealDate, '2026-03-01');
  assert.deepEqual(Object.keys(w.stats).sort(), STATS.map((s) => s.key).sort());
});

test('lit les photos du lutteur et du contrat', () => {
  const query = fakeQuery([[row(3, { picture: 'Amale.png', contractPicture: '' }), row(4)], []]);
  const [w3, w4] = createSqlRosterReader(query).readRoster(190).workers;
  assert.match(query.calls[0].sql, /w\.picture, c\.contractPicture/);
  assert.equal(w3.picture, 'Amale.png');
  assert.equal(w3.contractPicture, null);
  assert.equal(w4.picture, null);
  assert.equal(w4.contractPicture, null);
});

test('garde un seul WorkerRow par lutteur', () => {
  const query = fakeQuery([[row(3), row(3, { name: 'doublon' })], []]);
  const snapshot = createSqlRosterReader(query).readRoster(190);
  assert.equal(snapshot.workers.length, 1);
  assert.equal(snapshot.workers[0].name, 'W3');
});

test('readWorkers filtre par promotion et par lutteurs, en une requête', () => {
  const query = fakeQuery([[row(1), row(2)]]);
  const workers = createSqlRosterReader(query).readWorkers([1, 2], 190);
  assert.equal(query.calls.length, 1);
  assert.match(query.calls[0].sql, /c\.promotionID = \? AND c\.expired = 0 AND w\.workerID IN \(\?, \?\)/);
  assert.deepEqual(query.calls[0].params, [190, 1, 2]);
  assert.equal(workers.length, 2);
  assertNoLiteral(query.calls);
});

test('readWorkers sans lutteur ne fait aucune requête', () => {
  const query = fakeQuery([]);
  assert.deepEqual(createSqlRosterReader(query).readWorkers([], 190), []);
  assert.equal(query.calls.length, 0);
});

test('readRelations avec moins de deux lutteurs ne fait aucune requête', () => {
  const query = fakeQuery([]);
  assert.deepEqual(createSqlRosterReader(query).readRelations([1]), []);
  assert.equal(query.calls.length, 0);
});

test('readRelations convertit une valeur nulle en 0', () => {
  const query = fakeQuery([[{ worker1: 1, worker2: 2, relationship: null }]]);
  assert.deepEqual(createSqlRosterReader(query).readRelations([1, 2]), [{ worker1: 1, worker2: 2, value: 0 }]);
});

test('readCard regroupe les participants par segment, dans l\'ordre du card', () => {
  const query = fakeQuery([[
    { segmentID: 20, segmentType: 'Angle', segmentName: 'Promo', rating: 56, workerID: 5, workerName: 'E' },
    { segmentID: 20, segmentType: 'Angle', segmentName: 'Promo', rating: 56, workerID: 6, workerName: 'F' },
    { segmentID: 21, segmentType: 'Match', segmentName: 'E vs G', rating: null, workerID: 5, workerName: 'E' },
  ]]);
  const segments = createSqlRosterReader(query).readCard(307);
  assert.match(query.calls[0].sql, /WHERE s\.showID = \?/);
  assert.doesNotMatch(query.calls[0].sql, /opponentSet >= 0/);
  assert.deepEqual(query.calls[0].params, [307]);
  assertSegments(segments);
  assert.deepEqual(segments, [
    { segmentID: 20, name: 'Promo', type: 'Angle', rating: 56, workers: [{ workerID: 5, name: 'E' }, { workerID: 6, name: 'F' }] },
    { segmentID: 21, name: 'E vs G', type: 'Match', rating: null, workers: [{ workerID: 5, name: 'E' }] },
  ]);
});

test('findLatestCompletedShow filtre par date quand elle est connue', () => {
  const query = fakeQuery([[{ instanceID: 307 }]]);
  assert.equal(createSqlRosterReader(query).findLatestCompletedShow(190, '2026-02-13'), 307);
  assert.match(query.calls[0].sql, /i\.airDate <= \?/);
  assert.deepEqual(query.calls[0].params, [190, '2026-02-13']);
});

test('findLatestCompletedShow sans date, et sans résultat', () => {
  const query = fakeQuery([[]]);
  assert.equal(createSqlRosterReader(query).findLatestCompletedShow(190, null), null);
  assert.deepEqual(query.calls[0].params, [190]);
  assert.doesNotMatch(query.calls[0].sql, /airDate <= \?/);
});

test('la requête de carte liste les compétiteurs d\'abord, avec départage stable', () => {
  const query = fakeQuery([[]]);
  createSqlRosterReader(query).readCard(5);
  assert.match(query.calls[0].sql, /ORDER BY s\.segmentorder, s\.segmentID, \(o\.opponentSet < 0\), o\.opponentSet, o\.opponentID$/);
});

test('les lectures de workers sont triées de façon stable', () => {
  const query = fakeQuery([[], []]);
  const reader = createSqlRosterReader(query);
  reader.readRoster(190);
  reader.readWorkers([3], 190);
  assert.match(query.calls[0].sql, /WHERE c\.promotionID = \? AND c\.expired = 0 ORDER BY w\.workerID, c\.contractID$/);
  assert.match(query.calls[1].sql, /w\.workerID IN \(\?\) ORDER BY w\.workerID, c\.contractID$/);
});
