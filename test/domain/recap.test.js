'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRecap } = require('../../src/domain/recap');

const ALL = { popularity: true, momentumMorale: true, condition: true, skills: true, relationships: true };
const OPTS = { groups: ALL, minDelta: 0.5 };

function worker(id, stats = {}, extra = {}) {
  return { workerID: id, name: `W${id}`, stats, injuryType: '', injuryHealDate: null, ...extra };
}
function seg(name, ids, type = 'Match', rating = 60) {
  return { segmentID: null, name, type, rating, workers: ids.map((id) => ({ workerID: id, name: `Ring${id}` })) };
}
function snap(workers, relations = []) {
  return { workers, relations };
}
function recapFor(beforeStats, afterStats, options = OPTS, extraBefore = {}, extraAfter = {}) {
  return computeRecap(
    snap([worker(1, beforeStats, extraBefore)]),
    snap([worker(1, afterStats, extraAfter)]),
    [seg('A', [1])],
    options,
  );
}

test('rapporte une stat modifiée avec avant, après, écart et libellé', () => {
  const r = recapFor({ entertainment: 62 }, { entertainment: 63.5 });
  assert.deepEqual(r.workers[0].changes, [
    { key: 'entertainment', before: 62, after: 63.5, delta: 1.5, inverted: false },
  ]);
});

test('ignore un écart sous le seuil', () => {
  const r = recapFor({ entertainment: 62 }, { entertainment: 62.3 });
  assert.deepEqual(r.workers[0].changes, []);
});

test('garde un écart égal au seuil', () => {
  const r = recapFor({ entertainment: 62 }, { entertainment: 62.5 });
  assert.equal(r.workers[0].changes.length, 1);
});

test('ignore un groupe désactivé', () => {
  const r = recapFor({ entertainment: 62 }, { entertainment: 65 }, { groups: { ...ALL, skills: false }, minDelta: 0.5 });
  assert.deepEqual(r.workers[0].changes, []);
});

test('traite null comme 0', () => {
  const r = recapFor({ momentum: null }, { momentum: 5 });
  assert.deepEqual(r.workers[0].changes[0], {
    key: 'momentum', before: 0, after: 5, delta: 5, inverted: false,
  });
});

test('arrondit à une décimale', () => {
  const r = recapFor({ northAmericaPop: 25.66 }, { northAmericaPop: 27.04 });
  const c = r.workers[0].changes[0];
  assert.equal(c.before, 25.7);
  assert.equal(c.after, 27);
  assert.equal(c.delta, 1.4);
});

test('marque la fatigue comme inversée', () => {
  const r = recapFor({ fatigue: 10 }, { fatigue: 18 });
  assert.equal(r.workers[0].changes[0].inverted, true);
});

test('avec un seuil à 0, ignore les stats inchangées', () => {
  const r = recapFor({ entertainment: 62, stamina: 70 }, { entertainment: 62, stamina: 71 }, { groups: ALL, minDelta: 0 });
  assert.deepEqual(r.workers[0].changes.map((c) => c.key), ['stamina']);
});

test('suit l\'ordre du card et liste les segments de chaque lutteur', () => {
  const before = snap([worker(1), worker(2), worker(3)]);
  const after = snap([worker(1), worker(2), worker(3)]);
  const segments = [seg('A', [2, 1]), seg('B', [3]), seg('C', [2])];
  const r = computeRecap(before, after, segments, OPTS);
  assert.deepEqual(r.workers.map((w) => w.workerID), [2, 1, 3]);
  assert.deepEqual(r.workers[0].segments, [0, 2]);
});

test('ignore un lutteur absent de la photo de départ', () => {
  const r = computeRecap(snap([worker(1)]), snap([worker(1), worker(9)]), [seg('A', [1, 9])], OPTS);
  assert.deepEqual(r.workers.map((w) => w.workerID), [1]);
});

test('garde un lutteur sans changement', () => {
  const r = recapFor({ entertainment: 62 }, { entertainment: 62 });
  assert.equal(r.workers.length, 1);
  assert.deepEqual(r.workers[0].changes, []);
  assert.equal(r.workers[0].injury, null);
});

test('détecte une blessure survenue pendant le show', () => {
  const r = recapFor({}, {}, OPTS, { injuryType: '' }, { injuryType: 'Broken Arm', injuryHealDate: '2026-03-01' });
  assert.deepEqual(r.workers[0].injury, { type: 'Broken Arm', healDate: '2026-03-01' });
});

test('ne signale pas une blessure déjà présente avant le show', () => {
  const r = recapFor({}, {}, OPTS, { injuryType: 'Sprain' }, { injuryType: 'Sprain' });
  assert.equal(r.workers[0].injury, null);
});

test('recopie les photos de la photo après le show', () => {
  const r = recapFor({}, {}, OPTS, {}, { picture: 'A.png', contractPicture: 'C.png' });
  assert.equal(r.workers[0].picture, 'A.png');
  assert.equal(r.workers[0].contractPicture, 'C.png');
});

test('photos absentes : null', () => {
  const r = recapFor({}, {});
  assert.equal(r.workers[0].picture, null);
  assert.equal(r.workers[0].contractPicture, null);
});

test('prend le nom affiché dans le card', () => {
  const r = recapFor({}, {});
  assert.equal(r.workers[0].name, 'Ring1');
});

test('résume les segments', () => {
  const r = computeRecap(snap([worker(1)]), snap([worker(1)]), [seg('A', [1], 'Angle', 72)], OPTS);
  assert.deepEqual(r.segments, [{ name: 'A', type: 'Angle', rating: 72 }]);
});

function rel(a, b, value) {
  return { worker1: a, worker2: b, value };
}

test('rapporte une relation modifiée entre lutteurs du même segment', () => {
  const r = computeRecap(
    snap([worker(1), worker(2)], [rel(2, 1, 40)]),
    snap([worker(1), worker(2)], [rel(1, 2, 45)]),
    [seg('A', [1, 2])],
    OPTS,
  );
  assert.deepEqual(r.relations, [
    { worker1: 1, name1: 'Ring1', worker2: 2, name2: 'Ring2', before: 40, after: 45, delta: 5 },
  ]);
});

test('une relation absente avant vaut 0', () => {
  const r = computeRecap(snap([worker(1), worker(2)]), snap([worker(1), worker(2)], [rel(1, 2, -3)]), [seg('A', [1, 2])], OPTS);
  assert.equal(r.relations[0].before, 0);
  assert.equal(r.relations[0].delta, -3);
});

test('ignore une paire qui ne partage aucun segment', () => {
  const r = computeRecap(
    snap([worker(1), worker(3)], [rel(1, 3, 10)]),
    snap([worker(1), worker(3)], [rel(1, 3, 30)]),
    [seg('A', [1]), seg('B', [3])],
    OPTS,
  );
  assert.deepEqual(r.relations, []);
});

test('une paire présente dans deux segments est rapportée une fois', () => {
  const r = computeRecap(
    snap([worker(1), worker(2)], [rel(1, 2, 0)]),
    snap([worker(1), worker(2)], [rel(1, 2, 8)]),
    [seg('A', [1, 2]), seg('B', [2, 1])],
    OPTS,
  );
  assert.equal(r.relations.length, 1);
});

test('n\'inclut pas les relations si le groupe est désactivé', () => {
  const r = computeRecap(
    snap([worker(1), worker(2)], [rel(1, 2, 0)]),
    snap([worker(1), worker(2)], [rel(1, 2, 8)]),
    [seg('A', [1, 2])],
    { groups: { ...ALL, relationships: false }, minDelta: 0.5 },
  );
  assert.deepEqual(r.relations, []);
});

test('ignore une relation sous le seuil', () => {
  const r = computeRecap(
    snap([worker(1), worker(2)], [rel(1, 2, 10)]),
    snap([worker(1), worker(2)], [rel(1, 2, 10)]),
    [seg('A', [1, 2])],
    OPTS,
  );
  assert.deepEqual(r.relations, []);
});

test('ignore une paire dont un lutteur est absent de la photo de départ', () => {
  const r = computeRecap(snap([worker(1)]), snap([worker(1), worker(9)], [rel(1, 9, 20)]), [seg('A', [1, 9])], OPTS);
  assert.deepEqual(r.relations, []);
});
