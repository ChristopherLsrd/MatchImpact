'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createShowTracker, readOptions } = require('../../src/application/ShowTracker');
const fakes = require('../fakes');

function worker(id, stats = {}) {
  return { workerID: id, name: `W${id}`, stats, injuryType: '', injuryHealDate: null };
}
const CARD = [
  { segmentID: 10, name: 'A vs B', type: 'Match', rating: 61, workers: [{ workerID: 1, name: 'A' }, { workerID: 2, name: 'B' }] },
  { segmentID: 11, name: 'Promo B', type: 'Angle', rating: 70, workers: [{ workerID: 2, name: 'B' }] },
];
const STARTED = { promotionID: 1, showName: 'Weekly', date: '2026-02-13' };

function setup({ settings = {}, playerPromotion = 1, history = [], roster } = {}) {
  const deps = {
    roster: roster || fakes.createFakeRoster({
      roster: { workers: [worker(1, { entertainment: 60 }), worker(2, { momentum: 40 }), worker(3)], relations: [] },
      after: { workers: [worker(1, { entertainment: 62 }), worker(2, { momentum: 45 }), worker(3)], relations: [] },
      cards: { 77: CARD },
      latestShow: 77,
    }),
    history: fakes.createFakeHistoryStore(history),
    view: fakes.createFakeView(),
    settings: fakes.createFakeSettings(settings),
    gameState: fakes.createFakeGameState(playerPromotion),
    logger: fakes.createFakeLogger(),
  };
  return { ...deps, tracker: createShowTracker(deps) };
}

test('refuse un port manquant', () => {
  assert.throws(() => createShowTracker({}), TypeError);
});

test('photographie le roster au début du show', () => {
  const { tracker, roster } = setup();
  tracker.onShowStarted(STARTED);
  assert.deepEqual(roster.calls[0], ['readRoster', 1]);
  assert.equal(tracker.hasSnapshot(), true);
});

test('ignore le show d\'une autre promotion', () => {
  const { tracker, roster, view } = setup({ playerPromotion: 2 });
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(roster.calls.length, 0);
  assert.equal(view.summary.length, 0);
});

test('suit une autre promotion si onlyMyPromotion est désactivé', () => {
  const { tracker, roster } = setup({ playerPromotion: 2, settings: { onlyMyPromotion: false } });
  tracker.onShowStarted(STARTED);
  assert.deepEqual(roster.calls[0], ['readRoster', 1]);
});

test('produit le récap à l\'ouverture de l\'écran de fin', () => {
  const { tracker, roster, view, history } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(view.summary.length, 1);
  const recap = view.summary[0];
  assert.equal(recap.showID, 77);
  assert.equal(recap.showName, 'Weekly');
  assert.equal(recap.date, '2026-02-13');
  assert.equal(recap.promotionID, 1);
  assert.deepEqual(recap.workers.map((w) => w.workerID), [1, 2]);
  assert.deepEqual(recap.workers[0].changes.map((c) => c.key), ['entertainment']);
  assert.deepEqual(recap.workers[1].changes.map((c) => c.key), ['momentum']);
  assert.ok(roster.calls.some((c) => c[0] === 'readWorkers' && c[1].join() === '1,2' && c[2] === 1));
  assert.equal(history.list.length, 1);
  assert.equal(history.list[0], recap);
});

test('retrouve le show quand l\'écran de fin ne donne pas son identifiant', () => {
  const { tracker, roster, view } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: null });
  assert.ok(roster.calls.some((c) => c[0] === 'findLatestCompletedShow' && c[1] === 1 && c[2] === '2026-02-13'));
  assert.equal(view.summary[0].showID, 77);
});

test('ne fait rien sans photo de départ', () => {
  const { tracker, view, history } = setup();
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(view.summary.length, 0);
  assert.equal(history.saves, 0);
});

test('ne produit le récap qu\'une fois', () => {
  const { tracker, view, history } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(view.summary.length, 1);
  assert.equal(history.saves, 1);
});

test('show:ended après l\'écran de fin ne refait rien et efface la photo', () => {
  const { tracker, view, history } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  tracker.onShowEnded({ showID: 77, segments: [] });
  assert.equal(view.floating.length, 0);
  assert.equal(history.saves, 1);
  assert.equal(tracker.hasSnapshot(), false);
});

test('show:ended sans écran de fin détecté produit le récap en panneau flottant', () => {
  const { tracker, view, history } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onShowEnded({ showID: 77, segments: [] });
  assert.equal(view.summary.length, 0);
  assert.equal(view.floating.length, 1);
  assert.equal(view.floating[0].showID, 77);
  assert.equal(history.saves, 1);
});

test('show:ended sans identifiant utilise les segments de l\'événement', () => {
  const { tracker, view } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onShowEnded({
    segments: [{ segmentType: 'Match', segmentName: 'A vs B', rating: 61, workers: [{ workerID: 1, workerName: 'A' }] }],
  });
  const recap = view.floating[0];
  assert.equal(recap.showID, null);
  assert.deepEqual(recap.segments, [{ name: 'A vs B', type: 'Match', rating: 61 }]);
  assert.deepEqual(recap.workers.map((w) => w.workerID), [1]);
});

test('sans panneau, archive quand même le récap', () => {
  const { tracker, view, history } = setup({ settings: { showEndOfShowPanel: false } });
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(view.summary.length, 0);
  assert.equal(history.saves, 1);
});

test('respecte la taille de l\'historique', () => {
  const old = Array.from({ length: 3 }, (_, i) => ({ showName: `old${i}` }));
  const { tracker, history } = setup({ history: old, settings: { historySize: 3 } });
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(history.list.length, 3);
  assert.equal(history.list[0].showName, 'Weekly');
});

test('applique les réglages de suivi', () => {
  const { tracker, view } = setup({ settings: { trackSkills: false } });
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.deepEqual(view.summary[0].workers[0].changes, []);
});

test('attrape et journalise l\'erreur d\'un port', () => {
  const roster = fakes.createFakeRoster({ roster: { workers: [worker(1)], relations: [] } });
  roster.readCard = () => { throw new Error('db down'); };
  const { tracker, logger, view } = setup({ roster });
  tracker.onShowStarted(STARTED);
  assert.doesNotThrow(() => tracker.onSummaryShown({ showID: 77 }));
  assert.equal(logger.errors.length, 1);
  assert.equal(view.summary.length, 0);
});

test('ignore les événements mal formés', () => {
  const { tracker, logger } = setup();
  assert.doesNotThrow(() => tracker.onShowStarted(undefined));
  assert.doesNotThrow(() => tracker.onSummaryShown(undefined));
  assert.doesNotThrow(() => tracker.onShowEnded(undefined));
  assert.equal(tracker.hasSnapshot(), false);
  assert.equal(logger.errors.length, 0);
});

test('readOptions traduit les réglages', () => {
  const options = readOptions(fakes.createFakeSettings({ trackCondition: false, minDelta: 2 }));
  assert.deepEqual(options, {
    groups: { popularity: true, momentumMorale: true, condition: false, skills: true, relationships: true },
    minDelta: 2,
  });
});

test('readOptions remplace un seuil invalide par 0.5', () => {
  assert.equal(readOptions(fakes.createFakeSettings({ minDelta: -1 })).minDelta, 0.5);
  assert.equal(readOptions(fakes.createFakeSettings({ minDelta: 'x' })).minDelta, 0.5);
});

test('un échec d\'écriture de l\'historique ne masque pas le panneau (écran de fin)', () => {
  const { tracker, view, history, logger } = setup();
  history.save = () => { throw new Error('disque plein'); };
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77 });
  assert.equal(view.summary.length, 1);
  assert.equal(logger.errors.length, 1);
  assert.equal(logger.errors[0][0], 'archive');
});

test('un échec d\'écriture de l\'historique ne masque pas le panneau (show:ended)', () => {
  const { tracker, view, history, logger } = setup();
  history.save = () => { throw new Error('disque plein'); };
  tracker.onShowStarted(STARTED);
  tracker.onShowEnded({ showID: 77 });
  assert.equal(view.floating.length, 1);
  assert.equal(logger.errors.length, 1);
  assert.equal(logger.errors[0][0], 'archive');
  assert.equal(tracker.hasSnapshot(), false);
});

test('transmet la langue de l\'écran de fin à la vue', () => {
  const { tracker, view } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77, locale: 'fr' });
  assert.deepEqual(view.summaryLocales, ['fr']);
});
