'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { violations } = require('./support/dependencyRule');

const SRC = path.join(__dirname, '..', 'src');

function listJs(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full, base);
    return entry.name.endsWith('.js') ? [path.relative(base, full).split(path.sep).join('/')] : [];
  });
}

test('accepte un cas d\'usage qui importe le domaine', () => {
  assert.deepEqual(violations('application/ShowTracker.js', "const r = require('../domain/recap');"), []);
});

test('refuse le domaine qui importe un adapter', () => {
  assert.equal(violations('domain/recap.js', "require('../adapters/SqlRosterReader')").length, 1);
});

test('refuse un adapter qui importe un autre adapter', () => {
  assert.equal(violations('adapters/GameRecapView.js', "require('./SqlRosterReader')").length, 1);
});

test('refuse un adapter qui importe un cas d\'usage', () => {
  assert.equal(violations('adapters/GameSettings.js', "require('../application/ShowTracker')").length, 1);
});

test('accepte un adapter qui importe ports, domaine et présentation', () => {
  const source = "require('../application/ports'); require('../domain/stats'); require('../presentation/recapHtml');";
  assert.deepEqual(violations('adapters/GameSettings.js', source), []);
});

test('refuse la présentation qui importe l\'application', () => {
  assert.equal(violations('presentation/recapHtml.js', "require('../application/ports')").length, 1);
});

test('refuse un module externe dans src/', () => {
  assert.equal(violations('domain/recap.js', "require('fs')").length, 1);
});

test('refuse une couche inconnue', () => {
  assert.equal(violations('utils/x.js', '').length, 1);
});

test('tout le code de src/ respecte la règle de dépendance', () => {
  const errors = listJs(SRC).flatMap((rel) => violations(rel, fs.readFileSync(path.join(SRC, rel), 'utf8')));
  assert.deepEqual(errors, []);
});
