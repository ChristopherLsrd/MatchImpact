'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistoryPage } = require('../../src/adapters/historyPage');

test('le script de la page historique est valide et résout les photos du récap affiché', () => {
  const scripts = [];
  const ui = {
    addPage() {}, addSideMenuItem() {},
    executeJS(js) { scripts.push(js); return Promise.resolve(); },
  };
  const ipc = { handle() {} };
  createHistoryPage({ ui, ipc, queries: { listHistory: () => [], getRecap: () => null }, logger: { error() {} } }).start();
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
  assert.match(scripts[0], /detail\.innerHTML = recapHtml;[\s\S]*Game\.getContractImage[\s\S]*\}\)\(detail\);/);
});
