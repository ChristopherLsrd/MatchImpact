'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistoryPage } = require('../../src/adapters/historyPage');
const { createSettingsEditor } = require('../../src/application/SettingsEditor');
const fakes = require('../fakes');

const RECAP = {
  showName: 'Weekly', date: '2026-02-13', segments: [{ name: 'A vs B' }], relations: [],
  workers: [{
    workerID: 1, name: 'Alpha', segments: [0], injury: null, picture: null, contractPicture: null,
    changes: [{ key: 'stamina', before: 70, after: 72, delta: 2, inverted: false }],
  }],
};

function setup({ getRecap = () => RECAP, settings = fakes.createFakeSettings() } = {}) {
  const scripts = [];
  const handlers = {};
  const ui = { addPage() {}, addSideMenuItem() {}, executeJS(js) { scripts.push(js); return Promise.resolve(); } };
  const ipc = { handle(channel, fn) { handlers[channel] = fn; } };
  const logger = fakes.createFakeLogger();
  const queries = { listHistory: () => [{ index: 0, showName: 'Weekly', date: '2026-02-13', showID: 7 }], getRecap };
  const settingsEditor = createSettingsEditor({ settings, logger });
  createHistoryPage({ ui, ipc, queries, settingsEditor, logger }).start();
  return { scripts, handlers, settings, logger };
}

test('le script de page est valide et résout les photos du récap affiché', () => {
  const { scripts } = setup();
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
  assert.match(scripts[0], /detail\.innerHTML = recapHtml;[\s\S]*Game\.getContractImage[\s\S]*\}\)\(detail\);/);
});

test('le script de page envoie la langue du jeu et gère le bouton Réglages', () => {
  const [script] = setup().scripts;
  assert.match(script, /I18n\.locale/);
  assert.match(script, /'page-texts'/);
  assert.match(script, /'settings-form-html'/);
  assert.match(script, /'settings-set'/);
  assert.match(script, /mi-settings-button/);
  assert.match(script, /data-mi-saved/);
});

test('page-texts renvoie les textes de la coquille dans la langue demandée', () => {
  const { handlers } = setup();
  assert.deepEqual(handlers['page-texts']({}, 'fr'), { settings: 'Réglages', historyPick: 'Choisis un show dans la liste.', loading: 'Chargement…' });
  assert.equal(handlers['page-texts']({}, 'de').settings, 'Settings');
});

test('history-list-html et recap-html suivent la langue', () => {
  const { handlers } = setup();
  assert.match(handlers['history-list-html']({}, 'fr'), /data-mi-index="0"/);
  assert.match(handlers['recap-html']({}, 0, 'fr'), /Endurance/);
  assert.match(handlers['recap-html']({}, 0, 'en'), /Stamina/);
});

test('recap-html : récap introuvable ou illisible, traduit', () => {
  assert.match(setup({ getRecap: () => null }).handlers['recap-html']({}, 3, 'fr'), /Récap introuvable\./);
  const broken = setup({ getRecap: () => ({ workers: null }) });
  assert.match(broken.handlers['recap-html']({}, 0, 'en'), /Recap could not be read\./);
  assert.equal(broken.logger.errors.length, 1);
});

test('settings-form-html rend le formulaire avec les valeurs actuelles', () => {
  const { handlers } = setup({ settings: fakes.createFakeSettings({ trackSkills: false }) });
  const out = handlers['settings-form-html']({}, 'fr');
  assert.match(out, /<form class="mi-settings" lang="fr"/);
  assert.doesNotMatch(out.match(/<input[^>]*data-mi-setting="trackSkills"[^>]*>/)[0], /checked/);
});

test('settings-set enregistre par SettingsEditor', () => {
  const { handlers, settings } = setup();
  assert.deepEqual(handlers['settings-set']({}, 'minDelta', 50, 'fr'), { ok: true, value: 10 });
  assert.equal(settings.get('minDelta'), 10);
  assert.deepEqual(handlers['settings-set']({}, 'nope', 1), { ok: false });
});
