'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSummaryWatcher } = require('../../src/adapters/summaryWatcher');

function startedScript() {
  const scripts = [];
  const ui = { executeJS(js) { scripts.push(js); return Promise.resolve(); } };
  const ipc = { on() {} };
  createSummaryWatcher({ ui, ipc, onSummaryShown() {}, logger: { error() {} } }).start();
  return scripts[0];
}

function run(script, locale) {
  const el = { style: { display: 'none' } };
  const sent = [];
  let callback = null;
  const env = {
    window: {},
    document: { querySelector: () => el, querySelectorAll: () => [], body: {} },
    getComputedStyle: (e) => ({ display: e.style.display }),
    MutationObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() {} },
    plugins: { send: (...args) => sent.push(args) },
    Booking: { currentShow: 77 },
    I18n: locale === undefined ? undefined : { locale },
    console,
  };
  new Function(...Object.keys(env), script)(...Object.values(env));
  el.style.display = '';
  callback();
  return sent;
}

test('le script de surveillance est du JavaScript valide', () => {
  assert.doesNotThrow(() => new Function(startedScript()));
});

test('l\'ouverture de l\'écran de fin envoie le show et la langue du jeu', () => {
  assert.deepEqual(run(startedScript(), 'fr'), [['match-impact', 'summary-shown', { showID: 77, locale: 'fr' }]]);
});

test('sans I18n, la langue vaut null', () => {
  assert.deepEqual(run(startedScript(), undefined)[0][2], { showID: 77, locale: null });
});
