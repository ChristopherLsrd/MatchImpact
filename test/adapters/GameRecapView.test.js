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
  return {
    scripts,
    injectCSS() {},
    executeJS(js) { scripts.push(js); return Promise.resolve(typeof result === 'function' ? result(js) : result); },
  };
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

const tick = () => new Promise((r) => setImmediate(r));

test('le panneau du résumé suit la langue reçue', async () => {
  const ui = fakeUi(true);
  createGameRecapView(ui, logger).showInSummary(RECAP, 'fr');
  await tick();
  assert.match(ui.scripts[0], /lang=\\"fr\\"/);
  assert.match(ui.scripts[0], /1 catcheur/);
});

test('le panneau flottant reprend la dernière langue connue', async () => {
  const ui = fakeUi(false);
  const view = createGameRecapView(ui, logger);
  view.showInSummary(RECAP, 'fr');
  await tick();
  await tick();
  assert.equal(ui.scripts.length, 2);
  assert.match(ui.scripts[1], /mi-floating/);
  assert.match(ui.scripts[1], /1 catcheur/);
});

test('sans langue connue, le panneau est en anglais ; une langue vide ne change rien', async () => {
  const ui = fakeUi(true);
  const view = createGameRecapView(ui, logger);
  view.showFloating(RECAP);
  view.setLocale('fr');
  view.setLocale('');
  view.showFloating(RECAP);
  await tick();
  assert.match(ui.scripts[0], /1 wrestler/);
  assert.match(ui.scripts[1], /1 catcheur/);
});

test('refreshLocale lit la langue du jeu', async () => {
  const ui = fakeUi((js) => (js.includes('I18n') && !js.includes('insertAdjacentHTML') ? 'fr-FR' : true));
  const view = createGameRecapView(ui, logger);
  view.refreshLocale();
  await tick();
  assert.doesNotThrow(() => new Function(ui.scripts[0]));
  view.showFloating(RECAP);
  await tick();
  assert.match(ui.scripts[1], /1 catcheur/);
});
