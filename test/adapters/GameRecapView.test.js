'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameRecapView } = require('../../src/adapters/GameRecapView');

const RECAP = {
  showName: 'Weekly', date: '2026-02-13', segments: [{ name: 'A vs B' }], relations: [],
  workers: [{
    workerID: 1, name: 'Alpha', segments: [0], injury: null, picture: 'A.png', contractPicture: null,
    changes: [{ key: 'momentum', label: 'Momentum', before: 50, after: 45, delta: -5, inverted: false }],
  }],
};

function fakeUi(result) {
  const scripts = [];
  return { scripts, injectCSS() {}, executeJS(js) { scripts.push(js); return Promise.resolve(result); } };
}

const logger = { error() {} };

test('le panneau du résumé est un script valide qui résout les photos', async () => {
  const ui = fakeUi(true);
  createGameRecapView(ui, logger).showInSummary(RECAP);
  await new Promise((r) => setImmediate(r));
  assert.equal(ui.scripts.length, 1);
  assert.doesNotThrow(() => new Function(ui.scripts[0]));
  assert.match(ui.scripts[0], /Game\.getContractImage/);
  assert.match(ui.scripts[0], /side\.querySelector\('\.mi-panel'\)/);
});

test('le panneau flottant est un script valide qui résout les photos', async () => {
  const ui = fakeUi(true);
  createGameRecapView(ui, logger).showFloating(RECAP);
  await new Promise((r) => setImmediate(r));
  assert.doesNotThrow(() => new Function(ui.scripts[0]));
  assert.match(ui.scripts[0], /Game\.getContractImage/);
  assert.match(ui.scripts[0], /getElementById\('mi-floating'\)/);
});
