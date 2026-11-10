# Match Impact — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un plugin Pro Wrestling Sim en lecture seule qui affiche, dans l'écran de fin de show du jeu, toutes les stats modifiées de chaque participant, et garde un historique des derniers shows.

**Architecture :** clean architecture en quatre couches (`src/domain`, `src/application`, `src/presentation`, `src/adapters`) avec une racine de composition `index.js`, seul fichier qui touche l'objet `api` du jeu. Le récap vient d'une comparaison en base : photo au `show:started`, relecture à l'ouverture de l'écran récapitulatif, détectée par un `MutationObserver` injecté dans la fenêtre du jeu.

**Tech Stack :** JavaScript CommonJS (processus principal Electron/Node), `node:test` et `node:assert/strict`, aucune dépendance npm. Outils MCP `pro-wrestling-sim` (`query`, `validate_plugin`) pour les vérifications sur le jeu.

**Spec :** `docs/superpowers/specs/2026-11-10-match-impact-design.md` (à lire avant de commencer ; le cahier initial est `docs/SPEC.md`).

## Global Constraints

- Plugin en lecture seule : permissions `["events", "database"]`, jamais `database:write`, aucun intercepteur, aucune écriture en base.
- `plugin.json` : `id` `match-impact`, `main` `index.js` (fichier déjà présent, ne pas le modifier).
- Règle de dépendance : `domain` n'importe que `domain` ; `application` importe `domain` ; `presentation` importe `domain` ; `adapters` importe `domain`, `application/ports`, `presentation` ; aucun `require` de module externe (`fs`, `path`…) dans `src/`. Seul `index.js` touche `api`.
- TDD obligatoire (rouge → vert → refactor) pour : `domain/*`, `application/*`, `presentation/*`, `adapters/StorageHistoryStore.js`, `adapters/SqlRosterReader.js`. Tests après coup pour `adapters/GameSettings.js` et `adapters/GameState.js`. Pas de test unitaire pour `GameRecapView.js`, `summaryWatcher.js`, `historyPage.js`, `index.js`.
- Toutes les requêtes SQL utilisent des paramètres `?`, jamais de valeur concaténée ; une requête groupée par lecture (`IN (...)`).
- CSS : uniquement mise en page et variables du thème (`var(--...)`), aucune couleur codée en dur ; classes préfixées `mi-` ; tout élément créé par `executeJS` porte `data-plugin-id="match-impact"`.
- Texte issu de la base toujours échappé avant d'être mis dans du HTML.
- Libellés affichés en français.
- Tests : `npm test` (`node --test`), Node 24 disponible localement.
- Dossier des plugins du jeu : `%APPDATA%/ProWrestlingSimulator/plugins/`.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Types partagés (référence pour toutes les tâches)

```js
// WorkerRow — un lutteur dans une photo
{ workerID: number, name: string, stats: { [statKey: string]: number|null },
  injuryType: string|null, injuryHealDate: string|null }

// Relation — valeur de relation entre deux lutteurs (ordre quelconque)
{ worker1: number, worker2: number, value: number }

// Snapshot — photo de la base
{ workers: WorkerRow[], relations: Relation[] }

// Segment — un segment du card, dans l'ordre
{ segmentID: number|null, name: string, type: string, rating: number|null,
  workers: [{ workerID: number, name: string }] }

// RecapOptions — lu dans les réglages
{ groups: { popularity: boolean, momentumMorale: boolean, condition: boolean,
            skills: boolean, relationships: boolean },
  minDelta: number }

// RecapBody — sortie de computeRecap
{ segments: [{ name, type, rating }],
  workers: [{ workerID, name, segments: number[],
              changes: [{ key, label, before, after, delta, inverted }],
              injury: { type: string, healDate: string|null } | null }],
  relations: [{ worker1, name1, worker2, name2, before, after, delta }] }

// Recap — RecapBody enrichi par ShowTracker
{ showID: number|null, showName: string, date: string|null, promotionID: number, ...RecapBody }
```

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `package.json` | script `npm test` | 1 |
| `test/support/dependencyRule.js` | vérificateur de la règle de dépendance | 1 |
| `test/architecture.test.js` | tests du vérificateur + scan de `src/` | 1 |
| `src/domain/stats.js` | catalogue des stats suivies | 2 |
| `src/domain/recap.js` | `computeRecap` (lutteurs, blessures, relations) | 3, 4 |
| `src/domain/history.js` | `addToHistory` | 5 |
| `src/application/ports.js` | contrats des ports, assertions, `SETTINGS_SCHEMA` | 6 |
| `test/fakes/index.js` | faux ports en mémoire | 6 |
| `src/application/ShowTracker.js` | cas d'usage du show en cours | 7 |
| `src/application/HistoryQueries.js` | lecture de l'historique | 8 |
| `src/presentation/recapHtml.js` | Recap → HTML, CSS | 9 |
| `src/adapters/StorageHistoryStore.js` | port HistoryStore | 10 |
| `src/adapters/SqlRosterReader.js` | port RosterReader | 11 |
| `src/adapters/GameSettings.js`, `src/adapters/GameState.js` | ports Settings, GameState | 12 |
| `src/adapters/GameRecapView.js` | port RecapView | 13 |
| `src/adapters/summaryWatcher.js` | détection de l'écran de fin | 14 |
| `src/adapters/historyPage.js` | page Historique | 15 |
| `index.js` | racine de composition | 16 |
| `README.md` | état du projet | 17 |

---

### Task 1 : socle de tests et test d'architecture

**Files :**
- Create : `package.json`
- Create : `test/support/dependencyRule.js`
- Test : `test/architecture.test.js`

**Interfaces :**
- Consumes : rien.
- Produces : `npm test` ; `violations(relFile: string, source: string) → string[]` dans `test/support/dependencyRule.js` (`relFile` relatif à `src/`, séparateur `/`, ex. `'domain/recap.js'`).

- [ ] **Step 1 : créer `package.json`**

```json
{
  "name": "match-impact",
  "version": "1.0.0",
  "private": true,
  "description": "Plugin Pro Wrestling Sim : récap des stats modifiées en fin de show.",
  "scripts": {
    "test": "node --test"
  },
  "license": "UNLICENSED"
}
```

- [ ] **Step 2 : écrire le test qui échoue**

`test/architecture.test.js` :

```js
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
```

- [ ] **Step 3 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module './support/dependencyRule'`.

- [ ] **Step 4 : écrire le vérificateur**

`test/support/dependencyRule.js` :

```js
'use strict';
const path = require('node:path');

// Cibles autorisées par couche, relatives à src/ (sans extension).
const ALLOWED = {
  domain: ['domain/'],
  application: ['domain/', 'application/'],
  presentation: ['domain/', 'presentation/'],
  adapters: ['domain/', 'application/ports', 'presentation/'],
};

function requiresOf(source) {
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const found = [];
  let match;
  while ((match = re.exec(source)) !== null) found.push(match[1]);
  return found;
}

function isAllowed(target, prefixes) {
  return prefixes.some((prefix) => (prefix.endsWith('/') ? target.startsWith(prefix) : target === prefix));
}

function violations(relFile, source) {
  const layer = relFile.split('/')[0];
  const allowed = ALLOWED[layer];
  if (!allowed) return [`${relFile} : couche inconnue "${layer}"`];
  const errors = [];
  for (const spec of requiresOf(source)) {
    if (!spec.startsWith('.')) {
      errors.push(`${relFile} : require("${spec}") interdit (module externe)`);
      continue;
    }
    const target = path.posix
      .normalize(path.posix.join(path.posix.dirname(relFile), spec))
      .replace(/\.js$/, '');
    if (!isAllowed(target, allowed)) {
      errors.push(`${relFile} : require("${spec}") viole la règle de dépendance`);
    }
  }
  return errors;
}

module.exports = { violations, ALLOWED };
```

- [ ] **Step 5 : vérifier le succès**

Run : `npm test`
Expected : PASS, 9 tests (le scan de `src/` passe car le dossier n'existe pas encore).

- [ ] **Step 6 : commit**

```bash
git add package.json test/architecture.test.js test/support/dependencyRule.js
git commit -m "test: socle node --test et test de la règle de dépendance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : catalogue des stats (`domain/stats.js`)

**Files :**
- Create : `src/domain/stats.js`
- Test : `test/domain/stats.test.js`

**Interfaces :**
- Consumes : rien.
- Produces : `STATS` (tableau gelé de `{ key, label, group, table, inverted }`), `GROUPS` (`['popularity', 'momentumMorale', 'condition', 'skills']`).

- [ ] **Step 1 : écrire le test qui échoue**

`test/domain/stats.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { STATS, GROUPS } = require('../../src/domain/stats');

const keysOf = (group) => STATS.filter((s) => s.group === group).map((s) => s.key);

test('chaque stat a une forme complète', () => {
  for (const s of STATS) {
    assert.equal(typeof s.key, 'string');
    assert.equal(typeof s.label, 'string');
    assert.ok(s.label.length > 0);
    assert.ok(GROUPS.includes(s.group), `groupe inconnu pour ${s.key}`);
    assert.ok(['workers', 'contracts'].includes(s.table), `table inconnue pour ${s.key}`);
    assert.equal(typeof s.inverted, 'boolean');
  }
});

test('les clés sont uniques', () => {
  const keys = STATS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('seule la fatigue a un sens inversé', () => {
  assert.deepEqual(STATS.filter((s) => s.inverted).map((s) => s.key), ['fatigue']);
});

test('popularité : les six régions de la table workers', () => {
  assert.deepEqual(keysOf('popularity'), [
    'northAmericaPop', 'southAmericaPop', 'europePop', 'asiaPop', 'oceaniaPop', 'africaPop',
  ]);
  assert.ok(STATS.filter((s) => s.group === 'popularity').every((s) => s.table === 'workers'));
});

test('momentum et moral viennent du contrat', () => {
  assert.deepEqual(keysOf('momentumMorale'), ['momentum', 'morale']);
  assert.ok(STATS.filter((s) => s.group === 'momentumMorale').every((s) => s.table === 'contracts'));
});

test('forme : fatigue et endurance', () => {
  assert.deepEqual(keysOf('condition'), ['fatigue', 'stamina']);
});

test('talent : stats simples puis détaillées', () => {
  assert.deepEqual(keysOf('skills'), [
    'wrestlingSkill', 'entertainment', 'starPower', 'psychology', 'charisma',
    'brawling', 'technical', 'aerial', 'puroresu', 'acting',
    'basics', 'consistency', 'athleticism', 'toughness', 'resilience',
  ]);
});

test('le catalogue est gelé', () => {
  assert.ok(Object.isFrozen(STATS));
  assert.ok(STATS.every((s) => Object.isFrozen(s)));
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/domain/stats'`.

- [ ] **Step 3 : implémenter**

`src/domain/stats.js` :

```js
'use strict';

/** Groupes de stats, chacun piloté par un réglage. */
const GROUPS = Object.freeze(['popularity', 'momentumMorale', 'condition', 'skills']);

function stat(key, label, group, table, inverted) {
  return Object.freeze({ key, label, group, table, inverted });
}

/** Stats suivies, dans l'ordre d'affichage. */
const STATS = Object.freeze([
  stat('northAmericaPop', 'Pop Am. Nord', 'popularity', 'workers', false),
  stat('southAmericaPop', 'Pop Am. Sud', 'popularity', 'workers', false),
  stat('europePop', 'Pop Europe', 'popularity', 'workers', false),
  stat('asiaPop', 'Pop Asie', 'popularity', 'workers', false),
  stat('oceaniaPop', 'Pop Océanie', 'popularity', 'workers', false),
  stat('africaPop', 'Pop Afrique', 'popularity', 'workers', false),
  stat('momentum', 'Momentum', 'momentumMorale', 'contracts', false),
  stat('morale', 'Moral', 'momentumMorale', 'contracts', false),
  stat('fatigue', 'Fatigue', 'condition', 'workers', true),
  stat('stamina', 'Endurance', 'condition', 'workers', false),
  stat('wrestlingSkill', 'Wrestling', 'skills', 'workers', false),
  stat('entertainment', 'Divertissement', 'skills', 'workers', false),
  stat('starPower', 'Star power', 'skills', 'workers', false),
  stat('psychology', 'Psychologie', 'skills', 'workers', false),
  stat('charisma', 'Charisme', 'skills', 'workers', false),
  stat('brawling', 'Bagarre', 'skills', 'workers', false),
  stat('technical', 'Technique', 'skills', 'workers', false),
  stat('aerial', 'Aérien', 'skills', 'workers', false),
  stat('puroresu', 'Puroresu', 'skills', 'workers', false),
  stat('acting', "Jeu d'acteur", 'skills', 'workers', false),
  stat('basics', 'Bases', 'skills', 'workers', false),
  stat('consistency', 'Régularité', 'skills', 'workers', false),
  stat('athleticism', 'Athlétisme', 'skills', 'workers', false),
  stat('toughness', 'Robustesse', 'skills', 'workers', false),
  stat('resilience', 'Résilience', 'skills', 'workers', false),
]);

module.exports = { STATS, GROUPS };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS (tests de stats + architecture).

- [ ] **Step 5 : commit**

```bash
git add src/domain/stats.js test/domain/stats.test.js
git commit -m "feat(domain): catalogue des stats suivies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : calcul des écarts par lutteur (`domain/recap.js`)

**Files :**
- Create : `src/domain/recap.js`
- Test : `test/domain/recap.test.js`

**Interfaces :**
- Consumes : `STATS` de `src/domain/stats.js`.
- Produces : `computeRecap(before: Snapshot, after: Snapshot, segments: Segment[], options: RecapOptions) → RecapBody`. Dans cette tâche, `relations` vaut toujours `[]` (complété en tâche 4).

- [ ] **Step 1 : écrire les tests qui échouent**

`test/domain/recap.test.js` :

```js
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
    { key: 'entertainment', label: 'Divertissement', before: 62, after: 63.5, delta: 1.5, inverted: false },
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
    key: 'momentum', label: 'Momentum', before: 0, after: 5, delta: 5, inverted: false,
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

test('prend le nom affiché dans le card', () => {
  const r = recapFor({}, {});
  assert.equal(r.workers[0].name, 'Ring1');
});

test('résume les segments', () => {
  const r = computeRecap(snap([worker(1)]), snap([worker(1)]), [seg('A', [1], 'Angle', 72)], OPTS);
  assert.deepEqual(r.segments, [{ name: 'A', type: 'Angle', rating: 72 }]);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/domain/recap'`.

- [ ] **Step 3 : implémenter**

`src/domain/recap.js` :

```js
'use strict';
const { STATS } = require('./stats');

const EPSILON = 1e-9;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isReported(delta, minDelta) {
  return Math.abs(delta) > EPSILON && Math.abs(delta) + EPSILON >= minDelta;
}

/** Ordre d'apparition des lutteurs dans le card, segments de chacun, nom affiché. */
function indexCard(segments) {
  const order = [];
  const segmentsByWorker = new Map();
  const names = new Map();
  segments.forEach((segment, index) => {
    for (const w of segment.workers) {
      if (!segmentsByWorker.has(w.workerID)) {
        segmentsByWorker.set(w.workerID, []);
        order.push(w.workerID);
        names.set(w.workerID, w.name);
      }
      const list = segmentsByWorker.get(w.workerID);
      if (!list.includes(index)) list.push(index);
    }
  });
  return { order, segmentsByWorker, names };
}

function statChanges(beforeRow, afterRow, stats, minDelta) {
  const changes = [];
  for (const s of stats) {
    const before = toNumber(beforeRow.stats[s.key]);
    const after = toNumber(afterRow.stats[s.key]);
    const delta = after - before;
    if (!isReported(delta, minDelta)) continue;
    changes.push({
      key: s.key, label: s.label, before: round1(before), after: round1(after), delta: round1(delta), inverted: s.inverted,
    });
  }
  return changes;
}

function newInjury(beforeRow, afterRow) {
  if (!isBlank(beforeRow.injuryType) || isBlank(afterRow.injuryType)) return null;
  return { type: String(afterRow.injuryType), healDate: isBlank(afterRow.injuryHealDate) ? null : String(afterRow.injuryHealDate) };
}

function computeWorkers(beforeById, afterById, card, options) {
  const stats = STATS.filter((s) => options.groups[s.group]);
  const workers = [];
  for (const id of card.order) {
    const beforeRow = beforeById.get(id);
    const afterRow = afterById.get(id);
    if (!beforeRow || !afterRow) continue;
    workers.push({
      workerID: id,
      name: card.names.get(id) || afterRow.name,
      segments: card.segmentsByWorker.get(id),
      changes: statChanges(beforeRow, afterRow, stats, options.minDelta),
      injury: newInjury(beforeRow, afterRow),
    });
  }
  return workers;
}

/**
 * Compare deux photos et produit le récap d'un show.
 * @returns {{segments: Array, workers: Array, relations: Array}}
 */
function computeRecap(before, after, segments, options) {
  const beforeById = new Map(before.workers.map((w) => [w.workerID, w]));
  const afterById = new Map(after.workers.map((w) => [w.workerID, w]));
  const card = indexCard(segments);
  return {
    segments: segments.map((s) => ({ name: s.name, type: s.type, rating: s.rating })),
    workers: computeWorkers(beforeById, afterById, card, options),
    relations: [],
  };
}

module.exports = { computeRecap };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/domain/recap.js test/domain/recap.test.js
git commit -m "feat(domain): écarts de stats et blessures par lutteur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : écarts de relations (`domain/recap.js`)

**Files :**
- Modify : `src/domain/recap.js`
- Test : `test/domain/recap.test.js` (ajout)

**Interfaces :**
- Consumes : `computeRecap` de la tâche 3.
- Produces : `computeRecap(...).relations` = `[{ worker1, name1, worker2, name2, before, after, delta }]`, `worker1 < worker2`, une entrée par paire de lutteurs d'un même segment dont la relation a bougé d'au moins `minDelta`, si `options.groups.relationships`.

- [ ] **Step 1 : ajouter les tests qui échouent**

À la fin de `test/domain/recap.test.js` :

```js
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
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL sur les tests de relations (`r.relations` vaut `[]`).

- [ ] **Step 3 : implémenter**

Dans `src/domain/recap.js`, ajouter avant `computeRecap` :

```js
function relationKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function relationMap(relations) {
  const map = new Map();
  for (const r of relations) {
    const key = relationKey(r.worker1, r.worker2);
    if (!map.has(key)) map.set(key, toNumber(r.value));
  }
  return map;
}

function computeRelations(before, after, segments, card, beforeById, options) {
  if (!options.groups.relationships) return [];
  const beforeValues = relationMap(before.relations);
  const afterValues = relationMap(after.relations);
  const seen = new Set();
  const relations = [];
  for (const segment of segments) {
    const ids = segment.workers.map((w) => w.workerID).filter((id) => beforeById.has(id));
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = Math.min(ids[i], ids[j]);
        const b = Math.max(ids[i], ids[j]);
        const key = relationKey(a, b);
        if (a === b || seen.has(key)) continue;
        seen.add(key);
        const beforeValue = beforeValues.has(key) ? beforeValues.get(key) : 0;
        const afterValue = afterValues.has(key) ? afterValues.get(key) : 0;
        const delta = afterValue - beforeValue;
        if (!isReported(delta, options.minDelta)) continue;
        relations.push({
          worker1: a, name1: card.names.get(a), worker2: b, name2: card.names.get(b),
          before: round1(beforeValue), after: round1(afterValue), delta: round1(delta),
        });
      }
    }
  }
  return relations;
}
```

Puis, dans `computeRecap`, remplacer `relations: [],` par :

```js
    relations: computeRelations(before, after, segments, card, beforeById, options),
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/domain/recap.js test/domain/recap.test.js
git commit -m "feat(domain): écarts de relations entre lutteurs d'un même segment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : historique borné (`domain/history.js`)

**Files :**
- Create : `src/domain/history.js`
- Test : `test/domain/history.test.js`

**Interfaces :**
- Consumes : rien.
- Produces : `addToHistory(list: Recap[], recap: Recap, max: number) → Recap[]` (nouvelle liste, récap en tête, longueur ≤ max ; `max` invalide ou < 1 → 1).

- [ ] **Step 1 : écrire le test qui échoue**

`test/domain/history.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { addToHistory } = require('../../src/domain/history');

test('ajoute le récap en tête', () => {
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 5), [{ id: 2 }, { id: 1 }]);
});

test('tronque à la taille maximale', () => {
  const list = [{ id: 3 }, { id: 2 }, { id: 1 }];
  assert.deepEqual(addToHistory(list, { id: 4 }, 3), [{ id: 4 }, { id: 3 }, { id: 2 }]);
});

test('ne modifie pas la liste reçue', () => {
  const list = [{ id: 1 }];
  addToHistory(list, { id: 2 }, 5);
  assert.deepEqual(list, [{ id: 1 }]);
});

test('traite une liste invalide comme vide', () => {
  assert.deepEqual(addToHistory(null, { id: 1 }, 5), [{ id: 1 }]);
});

test('une taille invalide garde au moins un récap', () => {
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 0), [{ id: 2 }]);
  assert.deepEqual(addToHistory([{ id: 1 }], { id: 2 }, 'abc'), [{ id: 2 }]);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/domain/history'`.

- [ ] **Step 3 : implémenter**

`src/domain/history.js` :

```js
'use strict';

/** Renvoie une nouvelle liste : `recap` en tête, au plus `max` éléments. */
function addToHistory(list, recap, max) {
  const base = Array.isArray(list) ? list : [];
  const limit = Math.max(1, Math.floor(Number(max)) || 1);
  return [recap, ...base].slice(0, limit);
}

module.exports = { addToHistory };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/domain/history.js test/domain/history.test.js
git commit -m "feat(domain): historique borné

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : ports et faux ports (`application/ports.js`, `test/fakes`)

**Files :**
- Create : `src/application/ports.js`
- Create : `test/fakes/index.js`
- Test : `test/application/ports.test.js`

**Interfaces :**
- Consumes : rien.
- Produces :
  - `SETTINGS_SCHEMA` (tableau gelé de `{ key, label, type, default, description, min?, max? }`) ;
  - `PORTS` (nom du port → noms de méthodes) ;
  - `assertPort(name, candidate) → candidate` (lève `TypeError`) ;
  - `assertSnapshot(s)`, `assertWorkerRow(w)`, `assertRelation(r)`, `assertSegments(list)` (lèvent `TypeError`, renvoient l'argument) ;
  - fakes : `createFakeRoster({ roster, after, cards, latestShow })` (propriété `calls`), `createFakeHistoryStore(initial)` (propriétés `saves`, `list`), `createFakeView()` (propriétés `summary`, `floating`), `createFakeSettings(overrides)` (méthode `set`), `createFakeGameState(promotionId)`, `createFakeLogger()` (propriétés `logs`, `errors`).

- [ ] **Step 1 : écrire le test qui échoue**

`test/application/ports.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SETTINGS_SCHEMA, assertPort, assertSnapshot, assertSegments,
} = require('../../src/application/ports');
const fakes = require('../fakes');

test('les réglages ont les clés et défauts de la spec', () => {
  const defaults = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  assert.deepEqual(defaults, {
    showEndOfShowPanel: true,
    onlyMyPromotion: true,
    trackPopularity: true,
    trackMomentumMorale: true,
    trackCondition: true,
    trackSkills: true,
    trackRelationships: true,
    minDelta: 0.5,
    historySize: 20,
  });
});

test('les réglages numériques ont des bornes', () => {
  const byKey = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s]));
  assert.deepEqual([byKey.minDelta.min, byKey.minDelta.max], [0, 10]);
  assert.deepEqual([byKey.historySize.min, byKey.historySize.max], [1, 100]);
  assert.ok(SETTINGS_SCHEMA.every((s) => typeof s.label === 'string' && typeof s.description === 'string'));
});

test('les faux ports respectent les contrats', () => {
  assertPort('RosterReader', fakes.createFakeRoster());
  assertPort('HistoryStore', fakes.createFakeHistoryStore());
  assertPort('RecapView', fakes.createFakeView());
  assertPort('Settings', fakes.createFakeSettings());
  assertPort('GameState', fakes.createFakeGameState());
  assertPort('Logger', fakes.createFakeLogger());
});

test('assertPort refuse une méthode manquante', () => {
  assert.throws(() => assertPort('HistoryStore', { load() {} }), TypeError);
});

test('assertPort refuse un port inconnu ou une valeur vide', () => {
  assert.throws(() => assertPort('Nope', {}), TypeError);
  assert.throws(() => assertPort('Logger', null), TypeError);
});

test('assertSnapshot accepte une photo valide et refuse une photo invalide', () => {
  const ok = { workers: [{ workerID: 1, name: 'A', stats: {}, injuryType: null, injuryHealDate: null }], relations: [{ worker1: 1, worker2: 2, value: 3 }] };
  assert.equal(assertSnapshot(ok), ok);
  assert.throws(() => assertSnapshot({ workers: [{ workerID: '1', name: 'A', stats: {} }], relations: [] }), TypeError);
  assert.throws(() => assertSnapshot({ workers: [] }), TypeError);
});

test('assertSegments accepte un card valide et refuse un card invalide', () => {
  const ok = [{ segmentID: 1, name: 'A', type: 'Match', rating: 50, workers: [{ workerID: 1, name: 'A' }] }];
  assert.equal(assertSegments(ok), ok);
  assert.throws(() => assertSegments([{ name: 'A', type: 'Match', workers: [{ workerID: 1 }] }]), TypeError);
  assert.throws(() => assertSegments(null), TypeError);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/application/ports'`.

- [ ] **Step 3 : implémenter les ports**

`src/application/ports.js` :

```js
'use strict';

/**
 * @typedef {{workerID:number,name:string,stats:Object<string,number|null>,injuryType:string|null,injuryHealDate:string|null}} WorkerRow
 * @typedef {{worker1:number,worker2:number,value:number}} Relation
 * @typedef {{workers:WorkerRow[],relations:Relation[]}} Snapshot
 * @typedef {{segmentID:number|null,name:string,type:string,rating:number|null,workers:{workerID:number,name:string}[]}} Segment
 *
 * Ports :
 * - RosterReader : readRoster(promotionID) → Snapshot ; readWorkers(ids, promotionID) → WorkerRow[] ;
 *   readRelations(ids) → Relation[] ; readCard(showID) → Segment[] ;
 *   findLatestCompletedShow(promotionID, date) → number|null
 * - HistoryStore : load() → Recap[] (vide si absent/corrompu) ; save(list)
 * - RecapView : showInSummary(recap) ; showFloating(recap)
 * - Settings : get(key) → valeur (clés et défauts : SETTINGS_SCHEMA)
 * - GameState : playerPromotionId() → number|null
 * - Logger : log(...args) ; error(...args)
 */

function setting(key, label, type, def, description, bounds = {}) {
  return Object.freeze({ key, label, type, default: def, description, ...bounds });
}

const SETTINGS_SCHEMA = Object.freeze([
  setting('showEndOfShowPanel', 'Panneau de fin de show', 'boolean', true, "Affiche le récap Match Impact dans l'écran de fin de show"),
  setting('onlyMyPromotion', 'Seulement ma promotion', 'boolean', true, 'Ignore les shows des autres promotions'),
  setting('trackPopularity', 'Suivre la popularité', 'boolean', true, 'Popularité dans les six régions'),
  setting('trackMomentumMorale', 'Suivre momentum et moral', 'boolean', true, 'Momentum et moral du contrat'),
  setting('trackCondition', 'Suivre la forme', 'boolean', true, 'Fatigue et endurance'),
  setting('trackSkills', 'Suivre le talent', 'boolean', true, 'Stats de talent, simples et détaillées'),
  setting('trackRelationships', 'Suivre les relations', 'boolean', true, "Relations entre lutteurs d'un même segment"),
  setting('minDelta', 'Écart minimum', 'number', 0.5, 'Les écarts plus petits sont ignorés', { min: 0, max: 10 }),
  setting('historySize', "Taille de l'historique", 'number', 20, 'Nombre de shows conservés', { min: 1, max: 100 }),
]);

const PORTS = Object.freeze({
  RosterReader: ['readRoster', 'readWorkers', 'readRelations', 'readCard', 'findLatestCompletedShow'],
  HistoryStore: ['load', 'save'],
  RecapView: ['showInSummary', 'showFloating'],
  Settings: ['get'],
  GameState: ['playerPromotionId'],
  Logger: ['log', 'error'],
});

function assertPort(name, candidate) {
  const methods = PORTS[name];
  if (!methods) throw new TypeError(`Port inconnu : ${name}`);
  if (!candidate || typeof candidate !== 'object') throw new TypeError(`${name} : objet attendu`);
  for (const method of methods) {
    if (typeof candidate[method] !== 'function') throw new TypeError(`${name} : méthode ${method}() manquante`);
  }
  return candidate;
}

function assertWorkerRow(w) {
  if (!w || typeof w.workerID !== 'number' || typeof w.name !== 'string' || !w.stats || typeof w.stats !== 'object') {
    throw new TypeError('WorkerRow invalide');
  }
  return w;
}

function assertRelation(r) {
  if (!r || typeof r.worker1 !== 'number' || typeof r.worker2 !== 'number' || typeof r.value !== 'number') {
    throw new TypeError('Relation invalide');
  }
  return r;
}

function assertSnapshot(s) {
  if (!s || !Array.isArray(s.workers) || !Array.isArray(s.relations)) {
    throw new TypeError('Snapshot : { workers: [], relations: [] } attendu');
  }
  s.workers.forEach(assertWorkerRow);
  s.relations.forEach(assertRelation);
  return s;
}

function assertSegments(list) {
  if (!Array.isArray(list)) throw new TypeError('Segments : tableau attendu');
  for (const s of list) {
    if (!s || typeof s.name !== 'string' || typeof s.type !== 'string' || !Array.isArray(s.workers)) {
      throw new TypeError('Segment invalide');
    }
    for (const w of s.workers) {
      if (!w || typeof w.workerID !== 'number' || typeof w.name !== 'string') throw new TypeError('Participant invalide');
    }
  }
  return list;
}

module.exports = {
  SETTINGS_SCHEMA, PORTS, assertPort, assertSnapshot, assertWorkerRow, assertRelation, assertSegments,
};
```

- [ ] **Step 4 : implémenter les faux ports**

`test/fakes/index.js` :

```js
'use strict';
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

function createFakeRoster({
  roster = { workers: [], relations: [] },
  after = { workers: [], relations: [] },
  cards = {},
  latestShow = null,
} = {}) {
  const calls = [];
  return {
    calls,
    readRoster(promotionID) {
      calls.push(['readRoster', promotionID]);
      return roster;
    },
    readWorkers(ids, promotionID) {
      calls.push(['readWorkers', ids, promotionID]);
      return after.workers.filter((w) => ids.includes(w.workerID));
    },
    readRelations(ids) {
      calls.push(['readRelations', ids]);
      return after.relations.filter((r) => ids.includes(r.worker1) && ids.includes(r.worker2));
    },
    readCard(showID) {
      calls.push(['readCard', showID]);
      return cards[showID] || [];
    },
    findLatestCompletedShow(promotionID, date) {
      calls.push(['findLatestCompletedShow', promotionID, date]);
      return latestShow;
    },
  };
}

function createFakeHistoryStore(initial = []) {
  let list = initial.slice();
  return {
    saves: 0,
    get list() { return list; },
    load() { return list.slice(); },
    save(next) { this.saves += 1; list = next.slice(); },
  };
}

function createFakeView() {
  return {
    summary: [],
    floating: [],
    showInSummary(recap) { this.summary.push(recap); },
    showFloating(recap) { this.floating.push(recap); },
  };
}

function createFakeSettings(overrides = {}) {
  const values = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  Object.assign(values, overrides);
  return {
    get(key) { return values[key]; },
    set(key, value) { values[key] = value; },
  };
}

function createFakeGameState(promotionId = 1) {
  return { playerPromotionId() { return promotionId; } };
}

function createFakeLogger() {
  return {
    logs: [],
    errors: [],
    log(...args) { this.logs.push(args); },
    error(...args) { this.errors.push(args); },
  };
}

module.exports = {
  createFakeRoster, createFakeHistoryStore, createFakeView, createFakeSettings, createFakeGameState, createFakeLogger,
};
```

- [ ] **Step 5 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 6 : commit**

```bash
git add src/application/ports.js test/fakes/index.js test/application/ports.test.js
git commit -m "feat(application): contrats des ports, schéma des réglages et faux ports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : cas d'usage du show (`application/ShowTracker.js`)

**Files :**
- Create : `src/application/ShowTracker.js`
- Test : `test/application/ShowTracker.test.js`

**Interfaces :**
- Consumes : `computeRecap` (tâches 3-4), `addToHistory` (tâche 5), `assertPort` (tâche 6), faux ports (tâche 6).
- Produces : `createShowTracker({ roster, history, view, settings, gameState, logger }) → { onShowStarted(data), onSummaryShown(payload), onShowEnded(data), hasSnapshot() }` et `readOptions(settings) → RecapOptions`.
  - `data` de `onShowStarted` : `event.data` de `show:started` (`promotionID`, `showName`, `date`).
  - `payload` de `onSummaryShown` : `{ showID: number|null }`.
  - `data` de `onShowEnded` : `event.data` de `show:ended` (`showID`, `segments[]` avec `segmentType`, `segmentName`, `workers[{workerID, workerName}]`, `rating`).
  - Aucune méthode ne lève d'exception : les erreurs sont envoyées à `logger.error`.

- [ ] **Step 1 : écrire les tests qui échouent**

`test/application/ShowTracker.test.js` :

```js
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
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/application/ShowTracker'`.

- [ ] **Step 3 : implémenter**

`src/application/ShowTracker.js` :

```js
'use strict';
const { computeRecap } = require('../domain/recap');
const { addToHistory } = require('../domain/history');
const { assertPort } = require('./ports');

const DEFAULT_MIN_DELTA = 0.5;
const DEFAULT_HISTORY_SIZE = 20;

function readOptions(settings) {
  const minDelta = Number(settings.get('minDelta'));
  return {
    groups: {
      popularity: Boolean(settings.get('trackPopularity')),
      momentumMorale: Boolean(settings.get('trackMomentumMorale')),
      condition: Boolean(settings.get('trackCondition')),
      skills: Boolean(settings.get('trackSkills')),
      relationships: Boolean(settings.get('trackRelationships')),
    },
    minDelta: Number.isFinite(minDelta) && minDelta >= 0 ? minDelta : DEFAULT_MIN_DELTA,
  };
}

function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Convertit les segments de l'événement show:ended en Segment[]. */
function segmentsFromEvent(list) {
  if (!Array.isArray(list)) return [];
  return list.map((s) => ({
    segmentID: null,
    name: String((s && s.segmentName) || ''),
    type: String((s && s.segmentType) || ''),
    rating: s && typeof s.rating === 'number' ? s.rating : null,
    workers: (s && Array.isArray(s.workers) ? s.workers : [])
      .filter((w) => w && toId(w.workerID) !== null)
      .map((w) => ({ workerID: toId(w.workerID), name: String(w.workerName || '') })),
  }));
}

function participantIds(segments) {
  const ids = [];
  for (const s of segments) {
    for (const w of s.workers) if (!ids.includes(w.workerID)) ids.push(w.workerID);
  }
  return ids;
}

function createShowTracker({ roster, history, view, settings, gameState, logger }) {
  assertPort('RosterReader', roster);
  assertPort('HistoryStore', history);
  assertPort('RecapView', view);
  assertPort('Settings', settings);
  assertPort('GameState', gameState);
  assertPort('Logger', logger);

  let current = null; // { promotionID, showName, date, before, recapDone }

  function buildRecap(showID, segments) {
    const ids = participantIds(segments);
    const after = {
      workers: roster.readWorkers(ids, current.promotionID),
      relations: roster.readRelations(ids),
    };
    const body = computeRecap(current.before, after, segments, readOptions(settings));
    return {
      showID, showName: current.showName, date: current.date, promotionID: current.promotionID, ...body,
    };
  }

  function archive(recap) {
    const max = Number(settings.get('historySize')) || DEFAULT_HISTORY_SIZE;
    history.save(addToHistory(history.load(), recap, max));
  }

  function onShowStarted(data) {
    try {
      current = null;
      const promotionID = toId(data && data.promotionID);
      if (promotionID === null) return;
      if (settings.get('onlyMyPromotion') && promotionID !== toId(gameState.playerPromotionId())) return;
      const before = roster.readRoster(promotionID);
      current = {
        promotionID,
        showName: String((data && data.showName) || ''),
        date: (data && data.date) || null,
        before,
        recapDone: false,
      };
    } catch (e) {
      current = null;
      logger.error('show:started', e);
    }
  }

  function onSummaryShown(payload) {
    try {
      if (!current || current.recapDone) return;
      let showID = toId(payload && payload.showID);
      if (showID === null) showID = toId(roster.findLatestCompletedShow(current.promotionID, current.date));
      if (showID === null) return;
      const recap = buildRecap(showID, roster.readCard(showID));
      current.recapDone = true;
      archive(recap);
      if (settings.get('showEndOfShowPanel')) view.showInSummary(recap);
    } catch (e) {
      logger.error('summary-shown', e);
    }
  }

  function onShowEnded(data) {
    try {
      if (!current || current.recapDone) return;
      const showID = toId(data && data.showID);
      const segments = showID !== null ? roster.readCard(showID) : segmentsFromEvent(data && data.segments);
      const recap = buildRecap(showID, segments);
      current.recapDone = true;
      archive(recap);
      if (settings.get('showEndOfShowPanel')) view.showFloating(recap);
    } catch (e) {
      logger.error('show:ended', e);
    } finally {
      current = null;
    }
  }

  return {
    onShowStarted,
    onSummaryShown,
    onShowEnded,
    hasSnapshot: () => current !== null,
  };
}

module.exports = { createShowTracker, readOptions };
```

Note : le test « show:ended sans identifiant » passe `segments` avec un seul lutteur ; `buildRecap` lit alors `readWorkers([1], 1)` dans le faux roster.

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/application/ShowTracker.js test/application/ShowTracker.test.js
git commit -m "feat(application): suivi du show et production du récap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : lecture de l'historique (`application/HistoryQueries.js`)

**Files :**
- Create : `src/application/HistoryQueries.js`
- Test : `test/application/HistoryQueries.test.js`

**Interfaces :**
- Consumes : `assertPort`, faux ports (tâche 6).
- Produces : `createHistoryQueries({ history, logger }) → { listHistory(), getRecap(index) }`.
  - `listHistory() → [{ index: number, showName: string, date: string|null, showID: number|null }]` (`[]` en cas d'erreur).
  - `getRecap(index) → Recap | null`.

- [ ] **Step 1 : écrire le test qui échoue**

`test/application/HistoryQueries.test.js` :

```js
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
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/application/HistoryQueries'`.

- [ ] **Step 3 : implémenter**

`src/application/HistoryQueries.js` :

```js
'use strict';
const { assertPort } = require('./ports');

function createHistoryQueries({ history, logger }) {
  assertPort('HistoryStore', history);
  assertPort('Logger', logger);

  function listHistory() {
    try {
      return history.load().map((recap, index) => ({
        index,
        showName: String((recap && recap.showName) || ''),
        date: (recap && recap.date) || null,
        showID: recap && recap.showID !== undefined ? recap.showID : null,
      }));
    } catch (e) {
      logger.error('listHistory', e);
      return [];
    }
  }

  function getRecap(index) {
    try {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0) return null;
      return history.load()[i] || null;
    } catch (e) {
      logger.error('getRecap', e);
      return null;
    }
  }

  return { listHistory, getRecap };
}

module.exports = { createHistoryQueries };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/application/HistoryQueries.js test/application/HistoryQueries.test.js
git commit -m "feat(application): lecture de l'historique

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : rendu HTML (`presentation/recapHtml.js`)

**Files :**
- Create : `src/presentation/recapHtml.js`
- Test : `test/presentation/recapHtml.test.js`

**Interfaces :**
- Consumes : la forme `Recap` (types partagés).
- Produces : `escapeHtml(s)`, `renderRecapBody(recap)`, `renderPanel(recap)`, `renderFloating(recap)`, `renderHistoryList(items)`, `renderHistoryPageShell()`, `RECAP_CSS` (chaînes). Identifiants DOM produits : `mi-floating` (panneau flottant), `mi-history-list`, `mi-history-detail` (page), attribut `data-mi-index` sur chaque ligne d'historique.

- [ ] **Step 1 : écrire les tests qui échouent**

`test/presentation/recapHtml.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../src/presentation/recapHtml');

function recap(overrides = {}) {
  return {
    showID: 7,
    showName: 'Weekly',
    date: '2026-02-13',
    promotionID: 1,
    segments: [{ name: 'A vs B', type: 'Match', rating: 61 }, { name: 'Promo', type: 'Angle', rating: 70 }],
    workers: [
      {
        workerID: 1, name: 'Alpha', segments: [0, 1], injury: null,
        changes: [
          { key: 'entertainment', label: 'Divertissement', before: 62, after: 63.5, delta: 1.5, inverted: false },
          { key: 'fatigue', label: 'Fatigue', before: 10, after: 18, delta: 8, inverted: true },
          { key: 'momentum', label: 'Momentum', before: 50, after: 45, delta: -5, inverted: false },
        ],
      },
      { workerID: 2, name: 'Beta', segments: [0], injury: null, changes: [] },
    ],
    relations: [{ worker1: 1, name1: 'Alpha', worker2: 2, name2: 'Beta', before: 40, after: 45, delta: 5 }],
    ...overrides,
  };
}

test('escapeHtml échappe les caractères spéciaux', () => {
  assert.equal(html.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(html.escapeHtml(null), '');
});

test('le corps affiche le show, les lutteurs et leurs segments', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Weekly/);
  assert.match(out, /2026-02-13/);
  assert.match(out, /Alpha/);
  assert.match(out, /A vs B · Promo/);
});

test('une ligne de stat montre avant, après et écart', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Divertissement/);
  assert.match(out, /62 → 63\.5/);
  assert.match(out, /▲ \+1\.5/);
  assert.match(out, /▼ −5/);
});

test('une hausse est positive, sauf pour la fatigue', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /<tr class="mi-change mi-good"><td class="mi-label">Divertissement/);
  assert.match(out, /<tr class="mi-change mi-bad"><td class="mi-label">Fatigue/);
  assert.match(out, /<tr class="mi-change mi-bad"><td class="mi-label">Momentum/);
});

test('un lutteur sans changement affiche la mention', () => {
  assert.match(html.renderRecapBody(recap()), /Aucun changement/);
});

test('une blessure s\'affiche avec sa date de retour', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Broken Arm', healDate: '2026-03-01' };
  const out = html.renderRecapBody(r);
  assert.match(out, /class="mi-injury"/);
  assert.match(out, /Broken Arm/);
  assert.match(out, /2026-03-01/);
});

test('les relations ont leur section', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Relations/);
  assert.match(out, /Alpha ↔ Beta/);
  assert.match(out, /40 → 45/);
});

test('pas de section relations sans relation', () => {
  assert.doesNotMatch(html.renderRecapBody(recap({ relations: [] })), /Relations/);
});

test('un récap vide affiche un message', () => {
  assert.match(html.renderRecapBody(recap({ workers: [], relations: [] })), /class="noResults"/);
});

test('le texte venu de la base est échappé', () => {
  const r = recap({ showName: '<b>x</b>' });
  r.workers[0].name = '<script>';
  const out = html.renderRecapBody(r);
  assert.doesNotMatch(out, /<script>/);
  assert.doesNotMatch(out, /<b>x<\/b>/);
});

test('le panneau est marqué, repliable et utilise les classes natives', () => {
  const out = html.renderPanel(recap());
  assert.match(out, /class="panel mi-panel"/);
  assert.match(out, /data-plugin-id="match-impact"/);
  assert.match(out, /class="panelContents mi-body"/);
  assert.match(out, /mi-collapsed/);
});

test('le panneau flottant a un identifiant et un bouton fermer', () => {
  const out = html.renderFloating(recap());
  assert.match(out, /id="mi-floating"/);
  assert.match(out, /data-plugin-id="match-impact"/);
  assert.match(out, /mi-close/);
});

test('la liste d\'historique porte les index et échappe les noms', () => {
  const out = html.renderHistoryList([{ index: 0, showName: '<i>W</i>', date: '2026-02-13', showID: 7 }]);
  assert.match(out, /data-mi-index="0"/);
  assert.match(out, /&lt;i&gt;W&lt;\/i&gt;/);
});

test('une liste d\'historique vide affiche un message', () => {
  assert.match(html.renderHistoryList([]), /class="noResults"/);
});

test('la page historique a ses deux zones', () => {
  const out = html.renderHistoryPageShell();
  assert.match(out, /id="mi-history-list"/);
  assert.match(out, /id="mi-history-detail"/);
  assert.match(out, /leftRightSplit/);
});

test('aucune couleur codée en dur', () => {
  assert.doesNotMatch(html.RECAP_CSS, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(html.RECAP_CSS, /rgba?\(|hsla?\(/i);
  assert.doesNotMatch(html.renderPanel(recap()) + html.renderFloating(recap()), /style=/);
  assert.match(html.RECAP_CSS, /var\(--positive-effect\)/);
  assert.match(html.RECAP_CSS, /var\(--negative-effect\)/);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/presentation/recapHtml'`.

- [ ] **Step 3 : implémenter**

`src/presentation/recapHtml.js` :

```js
'use strict';

const PLUGIN_ATTR = 'data-plugin-id="match-impact"';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValue(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatDelta(delta) {
  const arrow = delta > 0 ? '▲' : '▼';
  const sign = delta > 0 ? '+' : '−';
  return `${arrow} ${sign}${formatValue(Math.abs(delta))}`;
}

function changeRow(label, before, after, delta, good) {
  return `<tr class="mi-change ${good ? 'mi-good' : 'mi-bad'}">`
    + `<td class="mi-label">${escapeHtml(label)}</td>`
    + `<td class="mi-values">${formatValue(before)} → ${formatValue(after)}</td>`
    + `<td class="mi-delta">${formatDelta(delta)}</td></tr>`;
}

function renderWorker(worker, segments) {
  const segmentNames = worker.segments
    .map((i) => (segments[i] ? segments[i].name : ''))
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const injury = worker.injury
    ? `<div class="mi-injury">Blessure : ${escapeHtml(worker.injury.type)}`
      + `${worker.injury.healDate ? ` (retour ${escapeHtml(worker.injury.healDate)})` : ''}</div>`
    : '';
  const changes = worker.changes.length
    ? `<table class="mi-changes"><tbody>${worker.changes
      .map((c) => changeRow(c.label, c.before, c.after, c.delta, c.inverted ? c.delta < 0 : c.delta > 0))
      .join('')}</tbody></table>`
    : (worker.injury ? '' : '<div class="mi-nochange">Aucun changement</div>');
  return '<div class="mi-worker">'
    + `<div class="mi-worker-head"><span class="mi-worker-name">${escapeHtml(worker.name)}</span>`
    + `<span class="mi-worker-segs">${segmentNames}</span></div>`
    + `${injury}${changes}</div>`;
}

function renderRelations(relations) {
  if (!relations.length) return '';
  return '<div class="mi-relations"><h4>Relations</h4><table class="mi-changes"><tbody>'
    + relations.map((r) => changeRow(`${r.name1} ↔ ${r.name2}`, r.before, r.after, r.delta, r.delta > 0)).join('')
    + '</tbody></table></div>';
}

function renderRecapBody(recap) {
  const header = `<div class="mi-show">${escapeHtml(recap.showName)}${recap.date ? ` · ${escapeHtml(recap.date)}` : ''}</div>`;
  if (!recap.workers.length && !recap.relations.length) {
    return `${header}<div class="noResults">Aucun participant suivi pour ce show.</div>`;
  }
  return header
    + recap.workers.map((w) => renderWorker(w, recap.segments)).join('')
    + renderRelations(recap.relations);
}

function renderPanel(recap) {
  return `<div class="panel mi-panel" ${PLUGIN_ATTR}>`
    + '<h3 class="mi-title">Match Impact'
    + '<span class="mi-toggle clickable" title="Replier" onclick="this.closest(\'.mi-panel\').classList.toggle(\'mi-collapsed\')">▾</span></h3>'
    + `<div class="panelContents mi-body">${renderRecapBody(recap)}</div></div>`;
}

function renderFloating(recap) {
  return `<div class="panel mi-panel mi-floating" id="mi-floating" ${PLUGIN_ATTR}>`
    + '<h3 class="mi-title">Match Impact'
    + '<span class="mi-close clickable" title="Fermer" onclick="this.closest(\'.mi-floating\').remove()">✕</span></h3>'
    + `<div class="panelContents mi-body">${renderRecapBody(recap)}</div></div>`;
}

function renderHistoryList(items) {
  if (!items.length) return '<div class="noResults">Aucun show enregistré pour l\'instant.</div>';
  return '<ul class="mi-history-list">'
    + items.map((i) => `<li class="clickable" data-mi-index="${Number(i.index)}">`
      + `<span class="mi-history-date">${escapeHtml(i.date)}</span> `
      + `<span class="mi-history-name">${escapeHtml(i.showName)}</span></li>`).join('')
    + '</ul>';
}

function renderHistoryPageShell() {
  return '<div class="leftRightSplit mi-history">'
    + '<div class="leftListContainer"><div class="leftList" id="mi-history-list"></div></div>'
    + '<div class="rightDetail" id="mi-history-detail"><div class="noResults">Choisis un show dans la liste.</div></div>'
    + '</div>';
}

const RECAP_CSS = [
  '.mi-panel .mi-title { display: flex; justify-content: space-between; align-items: center; }',
  '.mi-panel .mi-toggle, .mi-panel .mi-close { cursor: pointer; padding: 0 6px; }',
  '.mi-panel .mi-body { max-height: 45vh; overflow-y: auto; }',
  '.mi-panel.mi-collapsed .mi-body { display: none; }',
  '.mi-show { color: var(--color-2); margin-bottom: 8px; }',
  '.mi-worker { padding: 6px 0; border-bottom: var(--panel-border); }',
  '.mi-worker-head { display: flex; justify-content: space-between; gap: 8px; }',
  '.mi-worker-name { font-weight: bold; color: var(--color-0); }',
  '.mi-worker-segs { color: var(--color-2); font-size: 0.85em; text-align: right; }',
  '.mi-changes { width: 100%; border-collapse: collapse; }',
  '.mi-changes td { padding: 2px 4px; }',
  '.mi-values { text-align: right; color: var(--color-2); white-space: nowrap; }',
  '.mi-delta { text-align: right; white-space: nowrap; font-weight: bold; }',
  '.mi-good .mi-delta { color: var(--positive-effect); }',
  '.mi-bad .mi-delta { color: var(--negative-effect); }',
  '.mi-injury { color: var(--alert); font-weight: bold; }',
  '.mi-nochange { color: var(--color-2); font-style: italic; }',
  '.mi-relations h4 { margin: 8px 0 4px; color: var(--color-1); }',
  '.mi-floating { position: fixed; right: 16px; bottom: 16px; width: 420px; max-width: calc(100vw - 32px);'
    + ' z-index: 9000; background: var(--background-1); box-shadow: var(--panel-shadow); }',
  '.mi-history-list li { display: flex; gap: 8px; }',
  '.mi-history-date { color: var(--color-2); }',
].join('\n');

module.exports = {
  escapeHtml, renderRecapBody, renderPanel, renderFloating, renderHistoryList, renderHistoryPageShell, RECAP_CSS,
};
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/presentation/recapHtml.js test/presentation/recapHtml.test.js
git commit -m "feat(presentation): rendu HTML du récap et de l'historique

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : stockage de l'historique (`adapters/StorageHistoryStore.js`)

**Files :**
- Create : `src/adapters/StorageHistoryStore.js`
- Test : `test/adapters/StorageHistoryStore.test.js`

**Interfaces :**
- Consumes : `assertPort` (tâche 6). `storage` = `api.storage` (`readJSON(name) → valeur|null`, `writeJSON(name, value)`).
- Produces : `createStorageHistoryStore(storage) → HistoryStore`, fichier `history.json`.

- [ ] **Step 1 : écrire le test qui échoue**

`test/adapters/StorageHistoryStore.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStorageHistoryStore } = require('../../src/adapters/StorageHistoryStore');
const { assertPort } = require('../../src/application/ports');

function fakeStorage(value, { throws = false } = {}) {
  return {
    writes: [],
    readJSON(name) {
      this.lastRead = name;
      if (throws) throw new SyntaxError('Unexpected token');
      return value;
    },
    writeJSON(name, data) { this.writes.push([name, data]); },
  };
}

test('respecte le contrat HistoryStore', () => {
  assertPort('HistoryStore', createStorageHistoryStore(fakeStorage(null)));
});

test('lit history.json', () => {
  const storage = fakeStorage([{ showName: 'A' }]);
  assert.deepEqual(createStorageHistoryStore(storage).load(), [{ showName: 'A' }]);
  assert.equal(storage.lastRead, 'history.json');
});

test('renvoie une liste vide si le fichier est absent', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage(null)).load(), []);
});

test('renvoie une liste vide si le JSON est invalide', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage(null, { throws: true })).load(), []);
});

test('renvoie une liste vide si le contenu n\'est pas un tableau', () => {
  assert.deepEqual(createStorageHistoryStore(fakeStorage({ a: 1 })).load(), []);
});

test('écrit la liste dans history.json', () => {
  const storage = fakeStorage(null);
  createStorageHistoryStore(storage).save([{ showName: 'A' }]);
  assert.deepEqual(storage.writes, [['history.json', [{ showName: 'A' }]]]);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/adapters/StorageHistoryStore'`.

- [ ] **Step 3 : implémenter**

`src/adapters/StorageHistoryStore.js` :

```js
'use strict';

const FILE = 'history.json';

function createStorageHistoryStore(storage) {
  return {
    load() {
      try {
        const data = storage.readJSON(FILE);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    save(list) {
      storage.writeJSON(FILE, list);
    },
  };
}

module.exports = { createStorageHistoryStore };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/adapters/StorageHistoryStore.js test/adapters/StorageHistoryStore.test.js
git commit -m "feat(adapters): stockage de l'historique dans data/history.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : lecture de la base (`adapters/SqlRosterReader.js`)

**Files :**
- Create : `src/adapters/SqlRosterReader.js`
- Test : `test/adapters/SqlRosterReader.test.js`

**Interfaces :**
- Consumes : `STATS` (tâche 2), `assertPort`, `assertSnapshot`, `assertSegments` (tâche 6). `query(sql, params) → rows[]` (sera `api.database.query`).
- Produces : `createSqlRosterReader(query) → RosterReader` ; constantes exportées `SQL` (`SELECT_WORKERS`, `CARD`, `LATEST_WITH_DATE`, `LATEST`) pour la vérification sur une vraie sauvegarde.

- [ ] **Step 1 : écrire les tests qui échouent**

`test/adapters/SqlRosterReader.test.js` :

```js
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
  assert.match(query.calls[0].sql, /WHERE s\.showID = \? AND o\.opponentSet >= 0/);
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
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../../src/adapters/SqlRosterReader'`.

- [ ] **Step 3 : implémenter**

`src/adapters/SqlRosterReader.js` :

```js
'use strict';
const { STATS } = require('../domain/stats');

const STAT_COLUMNS = STATS.map((s) => `${s.table === 'contracts' ? 'c' : 'w'}.${s.key}`);

const SQL = Object.freeze({
  SELECT_WORKERS: `SELECT w.workerID, w.name, w.injuryType, w.injuryHealDate, ${STAT_COLUMNS.join(', ')} `
    + 'FROM workers w JOIN contracts c ON c.workerID = w.workerID',
  CARD: 'SELECT s.segmentID, s.segmentType, s.segmentName, s.rating, o.workerID, '
    + "COALESCE(NULLIF(o.workerName, ''), c.contractName, w.name) AS workerName "
    + 'FROM segments s JOIN opponents o ON o.segmentID = s.segmentID '
    + 'LEFT JOIN contracts c ON c.contractID = o.contractID '
    + 'LEFT JOIN workers w ON w.workerID = o.workerID '
    + 'WHERE s.showID = ? AND o.opponentSet >= 0 '
    + 'ORDER BY s.segmentorder, s.segmentID, o.opponentSet',
  LATEST_WITH_DATE: 'SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID '
    + 'WHERE e.promotionID = ? AND i.complete = 1 AND i.airDate <= ? '
    + 'ORDER BY i.airDate DESC, i.instanceID DESC LIMIT 1',
  LATEST: 'SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID '
    + 'WHERE e.promotionID = ? AND i.complete = 1 ORDER BY i.instanceID DESC LIMIT 1',
});

function placeholders(count) {
  return Array(count).fill('?').join(', ');
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toWorkerRow(row) {
  const stats = {};
  for (const s of STATS) stats[s.key] = toNullableNumber(row[s.key]);
  return {
    workerID: Number(row.workerID),
    name: String(row.name || ''),
    stats,
    injuryType: row.injuryType === undefined ? null : row.injuryType,
    injuryHealDate: row.injuryHealDate === undefined ? null : row.injuryHealDate,
  };
}

function uniqueWorkers(rows) {
  const seen = new Set();
  const workers = [];
  for (const row of rows) {
    const w = toWorkerRow(row);
    if (seen.has(w.workerID)) continue;
    seen.add(w.workerID);
    workers.push(w);
  }
  return workers;
}

function createSqlRosterReader(query) {
  function readRelations(ids) {
    if (!Array.isArray(ids) || ids.length < 2) return [];
    const list = placeholders(ids.length);
    const rows = query(
      `SELECT worker1, worker2, relationship FROM relationships WHERE worker1 IN (${list}) AND worker2 IN (${list})`,
      [...ids, ...ids],
    );
    return rows.map((r) => ({ worker1: Number(r.worker1), worker2: Number(r.worker2), value: toNullableNumber(r.relationship) || 0 }));
  }

  function readRoster(promotionID) {
    const workers = uniqueWorkers(query(`${SQL.SELECT_WORKERS} WHERE c.promotionID = ? AND c.expired = 0`, [promotionID]));
    return { workers, relations: readRelations(workers.map((w) => w.workerID)) };
  }

  function readWorkers(ids, promotionID) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return uniqueWorkers(query(
      `${SQL.SELECT_WORKERS} WHERE c.promotionID = ? AND c.expired = 0 AND w.workerID IN (${placeholders(ids.length)})`,
      [promotionID, ...ids],
    ));
  }

  function readCard(showID) {
    const segments = [];
    const byId = new Map();
    for (const r of query(SQL.CARD, [showID])) {
      if (!byId.has(r.segmentID)) {
        const segment = {
          segmentID: Number(r.segmentID),
          name: String(r.segmentName || ''),
          type: String(r.segmentType || ''),
          rating: toNullableNumber(r.rating),
          workers: [],
        };
        byId.set(r.segmentID, segment);
        segments.push(segment);
      }
      const segment = byId.get(r.segmentID);
      const workerID = Number(r.workerID);
      if (!segment.workers.some((w) => w.workerID === workerID)) {
        segment.workers.push({ workerID, name: String(r.workerName || '') });
      }
    }
    return segments;
  }

  function findLatestCompletedShow(promotionID, date) {
    const rows = date ? query(SQL.LATEST_WITH_DATE, [promotionID, date]) : query(SQL.LATEST, [promotionID]);
    return rows.length ? Number(rows[0].instanceID) : null;
  }

  return { readRoster, readWorkers, readRelations, readCard, findLatestCompletedShow };
}

module.exports = { createSqlRosterReader, SQL };
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS.

- [ ] **Step 5 : exécuter le SQL sur une vraie sauvegarde**

Avec l'outil MCP `mcp__pro-wrestling-sim__query`, sauvegarde `WOW` (promotion 190, show 307), exécuter les requêtes exactes produites par l'adapter. Pour les obtenir :

Run : `node -e "const {SQL}=require('./src/adapters/SqlRosterReader');console.log(SQL.SELECT_WORKERS+' WHERE c.promotionID = ? AND c.expired = 0');console.log(SQL.CARD);console.log(SQL.LATEST_WITH_DATE)"`

Puis via MCP :
1. la requête des lutteurs avec `params: ["190"]` → environ 30 lignes, chacune avec les 25 colonnes de stats, `injuryType`, `injuryHealDate` ;
2. `SELECT worker1, worker2, relationship FROM relationships WHERE worker1 IN (?, ?, ?) AND worker2 IN (?, ?, ?)` avec trois `workerID` tirés du résultat 1, répétés deux fois dans `params` → aucune erreur ;
3. `SQL.CARD` avec `params: ["307"]` → les segments du show 307 dans l'ordre du card, angles compris, chacun avec ses participants (comparer avec `mcp__pro-wrestling-sim__get_show` sur ce show) ;
4. `SQL.LATEST_WITH_DATE` avec `params: ["190", "2026-02-13"]` → `instanceID` 307.

Expected : aucune erreur SQL ; résultats conformes. En cas d'écart, corriger l'adapter et ses tests avant de committer.

- [ ] **Step 6 : commit**

```bash
git add src/adapters/SqlRosterReader.js test/adapters/SqlRosterReader.test.js
git commit -m "feat(adapters): lecture du roster, des relations et du card en SQL paramétré

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : réglages et état du jeu (`adapters/GameSettings.js`, `adapters/GameState.js`)

**Files :**
- Create : `src/adapters/GameSettings.js`
- Create : `src/adapters/GameState.js`
- Test : `test/adapters/GameSettings.test.js`, `test/adapters/GameState.test.js`

**Interfaces :**
- Consumes : `SETTINGS_SCHEMA`, `assertPort` (tâche 6). `settingsApi` = `api.settings` (`register(schema)`, `get(key)`) ; `gameApi` = `api.game` (`getState() → { promotionId } | null`).
- Produces : `createGameSettings(settingsApi) → Settings` (enregistre le schéma à la création ; défaut si la valeur est `undefined` ou `null`) ; `createGameState(gameApi) → GameState`.

Ces deux adapters sont testés après coup (spec) : écrire l'implémentation, puis les tests.

- [ ] **Step 1 : implémenter**

`src/adapters/GameSettings.js` :

```js
'use strict';
const { SETTINGS_SCHEMA } = require('../application/ports');

function createGameSettings(settingsApi) {
  settingsApi.register(SETTINGS_SCHEMA.map((s) => ({ ...s })));
  const defaults = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  return {
    get(key) {
      const value = settingsApi.get(key);
      return value === undefined || value === null ? defaults[key] : value;
    },
  };
}

module.exports = { createGameSettings };
```

`src/adapters/GameState.js` :

```js
'use strict';

function createGameState(gameApi) {
  return {
    playerPromotionId() {
      const state = gameApi.getState();
      if (!state || state.promotionId === null || state.promotionId === undefined) return null;
      const id = Number(state.promotionId);
      return Number.isFinite(id) ? id : null;
    },
  };
}

module.exports = { createGameState };
```

- [ ] **Step 2 : écrire les tests**

`test/adapters/GameSettings.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameSettings } = require('../../src/adapters/GameSettings');
const { SETTINGS_SCHEMA, assertPort } = require('../../src/application/ports');

function fakeSettingsApi(values = {}) {
  return {
    registered: null,
    register(schema) { this.registered = schema; },
    get(key) { return values[key]; },
  };
}

test('enregistre le schéma des réglages', () => {
  const api = fakeSettingsApi();
  createGameSettings(api);
  assert.deepEqual(api.registered.map((s) => s.key), SETTINGS_SCHEMA.map((s) => s.key));
});

test('respecte le contrat Settings', () => {
  assertPort('Settings', createGameSettings(fakeSettingsApi()));
});

test('renvoie la valeur enregistrée, y compris false et 0', () => {
  const settings = createGameSettings(fakeSettingsApi({ trackSkills: false, minDelta: 0 }));
  assert.equal(settings.get('trackSkills'), false);
  assert.equal(settings.get('minDelta'), 0);
});

test('renvoie le défaut si la valeur est absente', () => {
  const settings = createGameSettings(fakeSettingsApi({ historySize: null }));
  assert.equal(settings.get('historySize'), 20);
  assert.equal(settings.get('trackRelationships'), true);
});
```

`test/adapters/GameState.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameState } = require('../../src/adapters/GameState');
const { assertPort } = require('../../src/application/ports');

test('respecte le contrat GameState', () => {
  assertPort('GameState', createGameState({ getState: () => null }));
});

test('renvoie la promotion du joueur', () => {
  assert.equal(createGameState({ getState: () => ({ promotionId: '190' }) }).playerPromotionId(), 190);
});

test('renvoie null sans sauvegarde chargée ou sans promotion', () => {
  assert.equal(createGameState({ getState: () => null }).playerPromotionId(), null);
  assert.equal(createGameState({ getState: () => ({}) }).playerPromotionId(), null);
});
```

- [ ] **Step 3 : vérifier**

Run : `npm test`
Expected : PASS.

- [ ] **Step 4 : commit**

```bash
git add src/adapters/GameSettings.js src/adapters/GameState.js test/adapters/GameSettings.test.js test/adapters/GameState.test.js
git commit -m "feat(adapters): réglages du plugin et promotion du joueur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : affichage du récap (`adapters/GameRecapView.js`)

**Files :**
- Create : `src/adapters/GameRecapView.js`

**Interfaces :**
- Consumes : `renderPanel`, `renderFloating`, `RECAP_CSS` (tâche 9). `ui` = `api.ui` (`injectCSS(css)`, `executeJS(js) → Promise`) ; `logger` (port Logger).
- Produces : `createGameRecapView(ui, logger) → RecapView`. `showInSummary` insère le panneau dans `#bookingResults .br-summary-side` (remplace un panneau existant) ; si la colonne est introuvable, le script renvoie `false` et l'adapter appelle `showFloating`. `showFloating` remplace l'éventuel `#mi-floating` et l'ajoute à `document.body`.

Pas de test unitaire (spec : code d'interface mince) ; vérification au test réel (tâche 17). Les tests d'architecture continuent de passer.

- [ ] **Step 1 : implémenter**

`src/adapters/GameRecapView.js` :

```js
'use strict';
const { renderPanel, renderFloating, RECAP_CSS } = require('../presentation/recapHtml');

function summaryScript(html) {
  return '(function () { try {'
    + " var side = document.querySelector('#bookingResults .br-summary-side');"
    + ' if (!side) return false;'
    + " var old = side.querySelector('.mi-panel'); if (old) old.remove();"
    + ` side.insertAdjacentHTML('beforeend', ${JSON.stringify(html)});`
    + ' return true;'
    + " } catch (e) { console.error('[match-impact] panneau', e); return false; } })();";
}

function floatingScript(html) {
  return '(function () { try {'
    + " var old = document.getElementById('mi-floating'); if (old) old.remove();"
    + ` document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(html)});`
    + ' return true;'
    + " } catch (e) { console.error('[match-impact] panneau flottant', e); return false; } })();";
}

function createGameRecapView(ui, logger) {
  ui.injectCSS(RECAP_CSS);

  function showFloating(recap) {
    Promise.resolve(ui.executeJS(floatingScript(renderFloating(recap))))
      .catch((e) => logger.error('showFloating', e));
  }

  function showInSummary(recap) {
    Promise.resolve(ui.executeJS(summaryScript(renderPanel(recap))))
      .then((inserted) => { if (inserted !== true) showFloating(recap); })
      .catch((e) => { logger.error('showInSummary', e); showFloating(recap); });
  }

  return { showInSummary, showFloating };
}

module.exports = { createGameRecapView };
```

- [ ] **Step 2 : vérifier**

Run : `npm test`
Expected : PASS (le test d'architecture inclut ce fichier).

Run : `node -e "require('./src/adapters/GameRecapView')"`
Expected : aucune sortie, aucune erreur.

- [ ] **Step 3 : commit**

```bash
git add src/adapters/GameRecapView.js
git commit -m "feat(adapters): panneau de fin de show et panneau flottant de secours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : détection de l'écran de fin (`adapters/summaryWatcher.js`)

**Files :**
- Create : `src/adapters/summaryWatcher.js`

**Interfaces :**
- Consumes : `ui` = `api.ui` (`executeJS`), `ipc` = `api.ipc` (`on(channel, (event, data) => …)`), `onSummaryShown(payload)` (sera `tracker.onSummaryShown`), `logger`.
- Produces : `createSummaryWatcher({ ui, ipc, onSummaryShown, logger }) → { start(), stop() }`. Canal IPC `summary-shown`, données `{ showID: number|null }`. Variable globale dans la fenêtre du jeu : `window.__matchImpactObserver`.

Pas de test unitaire (spec) ; vérification au test réel (tâche 17).

- [ ] **Step 1 : implémenter**

`src/adapters/summaryWatcher.js` :

```js
'use strict';

const CHANNEL = 'summary-shown';

// Script exécuté dans la fenêtre du jeu. Observe le body : le jeu peut recréer la page de résultats.
const WATCH_SCRIPT = `(function () { try {
  if (window.__matchImpactObserver) { window.__matchImpactObserver.disconnect(); }
  var SELECTOR = '#bookingResults .bookingResultsFinalSummary';
  var wasVisible = false;
  function isVisible(el) { return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; }
  function check() {
    var visible = isVisible(document.querySelector(SELECTOR));
    if (visible && !wasVisible) {
      var showID = (typeof Booking !== 'undefined' && Booking && Booking.currentShow != null) ? Number(Booking.currentShow) : null;
      plugins.send('match-impact', '${CHANNEL}', { showID: isFinite(showID) ? showID : null });
    }
    wasVisible = visible;
  }
  wasVisible = isVisible(document.querySelector(SELECTOR));
  var observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  window.__matchImpactObserver = observer;
} catch (e) { console.error('[match-impact] surveillance', e); } })();`;

const STOP_SCRIPT = `(function () { try {
  if (window.__matchImpactObserver) { window.__matchImpactObserver.disconnect(); }
  delete window.__matchImpactObserver;
} catch (e) { console.error('[match-impact] arrêt surveillance', e); } })();`;

function createSummaryWatcher({ ui, ipc, onSummaryShown, logger }) {
  function start() {
    ipc.on(CHANNEL, (event, data) => onSummaryShown(data || {}));
    Promise.resolve(ui.executeJS(WATCH_SCRIPT)).catch((e) => logger.error('summaryWatcher.start', e));
  }

  function stop() {
    Promise.resolve(ui.executeJS(STOP_SCRIPT)).catch((e) => logger.error('summaryWatcher.stop', e));
  }

  return { start, stop };
}

module.exports = { createSummaryWatcher };
```

- [ ] **Step 2 : vérifier**

Run : `npm test`
Expected : PASS.

Run : `node -e "const s=require('./src/adapters/summaryWatcher');const calls=[];s.createSummaryWatcher({ui:{executeJS:(js)=>{new Function(js);calls.push(js.length);return Promise.resolve()}},ipc:{on:()=>{}},onSummaryShown:()=>{},logger:console}).start();console.log('scripts ok',calls.length)"`
Expected : `scripts ok 1` (le script injecté est du JavaScript syntaxiquement valide).

- [ ] **Step 3 : commit**

```bash
git add src/adapters/summaryWatcher.js
git commit -m "feat(adapters): détection de l'ouverture de l'écran de fin de show

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15 : page Historique (`adapters/historyPage.js`)

**Files :**
- Create : `src/adapters/historyPage.js`

**Interfaces :**
- Consumes : `renderHistoryList`, `renderRecapBody`, `renderHistoryPageShell` (tâche 9). `ui` = `api.ui` (`addPage`, `addSideMenuItem`, `executeJS`), `ipc` = `api.ipc` (`handle(channel, (event, ...args) => valeur)`), `queries` (tâche 8 : `listHistory()`, `getRecap(index)`), `logger`.
- Produces : `createHistoryPage({ ui, ipc, queries, logger }) → { start(), stop() }`. Canaux IPC `history-list-html` (→ HTML de la liste) et `recap-html` (index → HTML du récap). Page `matchImpactPage`, objet global `window.MatchImpactPage`.

Pas de test unitaire (spec) ; vérification au test réel (tâche 17).

- [ ] **Step 1 : implémenter**

`src/adapters/historyPage.js` :

```js
'use strict';
const { renderHistoryList, renderRecapBody, renderHistoryPageShell } = require('../presentation/recapHtml');

const PAGE_ID = 'matchImpactPage';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<path fill="currentColor" d="M64 64v384h416v-48H112V64H64zm96 256 96-112 80 64 128-144 32 32-160 176-80-64-64 80-32-32z"/></svg>';

const PAGE_SCRIPT = `(function () { try {
  window.MatchImpactPage = {
    init: function () {
      var list = document.getElementById('mi-history-list');
      var detail = document.getElementById('mi-history-detail');
      if (!list || !detail) return;
      list.innerHTML = '<div class="loading">Chargement…</div>';
      plugins.invoke('match-impact', 'history-list-html').then(function (html) {
        list.innerHTML = html;
        list.onclick = function (event) {
          var item = event.target.closest('[data-mi-index]');
          if (!item) return;
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          item.classList.add('active');
          plugins.invoke('match-impact', 'recap-html', Number(item.getAttribute('data-mi-index'))).then(function (recapHtml) {
            detail.innerHTML = recapHtml;
          });
        };
      }).catch(function (e) { console.error('[match-impact] historique', e); });
    }
  };
} catch (e) { console.error('[match-impact] page historique', e); } })();`;

const STOP_SCRIPT = "(function () { try { delete window.MatchImpactPage; } catch (e) {} })();";

function createHistoryPage({ ui, ipc, queries, logger }) {
  function start() {
    ipc.handle('history-list-html', () => renderHistoryList(queries.listHistory()));
    ipc.handle('recap-html', (event, index) => {
      const recap = queries.getRecap(index);
      return recap ? renderRecapBody(recap) : '<div class="noResults">Récap introuvable.</div>';
    });
    ui.addPage({
      id: PAGE_ID,
      title: 'Match Impact',
      backButton: 'mainOfficePage',
      initFunction: 'MatchImpactPage',
      html: renderHistoryPageShell(),
    });
    ui.addSideMenuItem({ pageId: PAGE_ID, label: 'Match Impact', section: 'bottom', svgIcon: ICON });
    Promise.resolve(ui.executeJS(PAGE_SCRIPT)).catch((e) => logger.error('historyPage.start', e));
  }

  function stop() {
    Promise.resolve(ui.executeJS(STOP_SCRIPT)).catch((e) => logger.error('historyPage.stop', e));
  }

  return { start, stop };
}

module.exports = { createHistoryPage };
```

- [ ] **Step 2 : vérifier**

Run : `npm test`
Expected : PASS.

Run : `node -e "const p=require('./src/adapters/historyPage');const h={};p.createHistoryPage({ui:{addPage:()=>{},addSideMenuItem:()=>{},executeJS:(js)=>{new Function(js);return Promise.resolve()}},ipc:{handle:(c,f)=>{h[c]=f}},queries:{listHistory:()=>[],getRecap:()=>null},logger:console}).start();console.log(Object.keys(h).join(','),'|',h['recap-html']({},0))"`
Expected : `history-list-html,recap-html | <div class="noResults">Récap introuvable.</div>`

- [ ] **Step 3 : commit**

```bash
git add src/adapters/historyPage.js
git commit -m "feat(adapters): page Historique dans le menu latéral

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16 : racine de composition (`index.js`), validation et installation

**Files :**
- Create : `index.js`

**Interfaces :**
- Consumes : toutes les fabriques des tâches 6 à 15 :
  `createShowTracker`, `createHistoryQueries`, `createSqlRosterReader`, `createStorageHistoryStore`, `createGameRecapView`, `createGameSettings`, `createGameState`, `createSummaryWatcher`, `createHistoryPage`.
- Produces : `module.exports = { activate(api), deactivate() }` (contrat du chargeur de plugins).

- [ ] **Step 1 : implémenter**

`index.js` :

```js
'use strict';
const path = require('path');

const PLUGIN_DIR = __dirname + path.sep;

// Le jeu vide le cache du module principal au rechargement à chaud ; on vide aussi celui de src/.
function purgeModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(PLUGIN_DIR) && key !== __filename) delete require.cache[key];
  }
}

let teardown = null;

module.exports = {
  activate(api) {
    purgeModuleCache();
    const { createShowTracker } = require('./src/application/ShowTracker');
    const { createHistoryQueries } = require('./src/application/HistoryQueries');
    const { createSqlRosterReader } = require('./src/adapters/SqlRosterReader');
    const { createStorageHistoryStore } = require('./src/adapters/StorageHistoryStore');
    const { createGameRecapView } = require('./src/adapters/GameRecapView');
    const { createGameSettings } = require('./src/adapters/GameSettings');
    const { createGameState } = require('./src/adapters/GameState');
    const { createSummaryWatcher } = require('./src/adapters/summaryWatcher');
    const { createHistoryPage } = require('./src/adapters/historyPage');

    const logger = {
      log: (...args) => api.console.log(...args),
      error: (...args) => api.console.error(...args),
    };
    const settings = createGameSettings(api.settings);
    const roster = createSqlRosterReader((sql, params) => api.database.query(sql, params));
    const history = createStorageHistoryStore(api.storage);
    const view = createGameRecapView(api.ui, logger);
    const gameState = createGameState(api.game);

    const tracker = createShowTracker({ roster, history, view, settings, gameState, logger });
    const queries = createHistoryQueries({ history, logger });

    api.events.on('show:started', (event) => tracker.onShowStarted(event && event.data));
    api.events.on('show:ended', (event) => tracker.onShowEnded(event && event.data));

    const watcher = createSummaryWatcher({
      ui: api.ui, ipc: api.ipc, onSummaryShown: (payload) => tracker.onSummaryShown(payload), logger,
    });
    const page = createHistoryPage({ ui: api.ui, ipc: api.ipc, queries, logger });
    watcher.start();
    page.start();

    teardown = () => {
      watcher.stop();
      page.stop();
      try { api.ui.widgets.removeAll(); } catch (e) { logger.error('widgets.removeAll', e); }
      Promise.resolve(api.ui.executeJS(
        "(function () { try { document.querySelectorAll('[data-plugin-id=\"match-impact\"]')"
        + '.forEach(function (el) { el.remove(); }); } catch (e) {} })();',
      )).catch((e) => logger.error('nettoyage', e));
    };

    logger.log('Match Impact activé.');
  },

  deactivate() {
    if (!teardown) return;
    try { teardown(); } catch (e) { /* le jeu nettoie le reste */ }
    teardown = null;
  },
};
```

- [ ] **Step 2 : vérifier hors du jeu avec une fausse API**

Run :

```bash
node -e "
const plugin = require('./index.js');
const noop = () => {};
const api = {
  console: { log: console.log, error: console.error },
  settings: { register: noop, get: () => undefined },
  database: { query: () => [] },
  storage: { readJSON: () => null, writeJSON: noop },
  ui: { injectCSS: noop, executeJS: (js) => { new Function(js); return Promise.resolve(true); }, addPage: noop, addSideMenuItem: noop, widgets: { removeAll: noop } },
  game: { getState: () => ({ promotionId: 1 }) },
  events: { on: noop },
  ipc: { on: noop, handle: noop },
};
plugin.activate(api);
plugin.deactivate();
console.log('activate/deactivate ok');
"
```

Expected : `Match Impact activé.` puis `activate/deactivate ok`.

- [ ] **Step 3 : lancer toute la suite**

Run : `npm test`
Expected : PASS, aucun test en échec.

- [ ] **Step 4 : valider le plugin avec l'outil du jeu**

Appeler `mcp__pro-wrestling-sim__validate_plugin` avec `plugin: "F:/Dev/MatchImpact"`.
Expected : aucun problème signalé (manifeste, fichier principal, syntaxe JavaScript).

- [ ] **Step 5 : installer le plugin dans le jeu par une jonction**

Vérifier d'abord que la cible n'existe pas :

Run (PowerShell) : `Test-Path "$env:APPDATA\ProWrestlingSimulator\plugins\match-impact"`
Expected : `False`. Si `True`, s'arrêter et demander à l'utilisateur.

Run (PowerShell) : `New-Item -ItemType Junction -Path "$env:APPDATA\ProWrestlingSimulator\plugins\match-impact" -Target "F:\Dev\MatchImpact"`
Expected : la jonction est créée.

Puis : `mcp__pro-wrestling-sim__validate_plugin` avec `plugin: "match-impact"`.
Expected : aucun problème signalé.

- [ ] **Step 6 : commit**

```bash
git add index.js
git commit -m "feat: racine de composition du plugin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17 : test réel dans le jeu et mise à jour du README

**Files :**
- Modify : `README.md` (section « État »)

**Interfaces :**
- Consumes : le plugin installé (tâche 16).
- Produces : critères de réussite de la spec vérifiés ; README à jour.

Cette tâche demande l'utilisateur : c'est lui qui joue le show. Lui donner chaque étape, attendre son retour, et vérifier côté base via MCP.

- [ ] **Step 1 : activer le plugin**

Demander à l'utilisateur de lancer le jeu (ou de recharger les plugins), d'activer « Match Impact » dans les réglages des plugins, puis d'ouvrir DevTools (F12) et de vérifier la ligne `[Plugin:match-impact] Match Impact activé.` sans erreur.

- [ ] **Step 2 : relever les valeurs avant le show**

Demander le nom de la sauvegarde et du show à jouer (au moins trois segments, dont un angle). Avec `mcp__pro-wrestling-sim__query` sur cette sauvegarde, relever pour les participants prévus : `northAmericaPop`, `entertainment`, `wrestlingSkill`, `fatigue` (table `workers`) et `momentum`, `morale` (contrat actif avec la promotion du joueur). La sauvegarde n'est écrite sur disque qu'au moment où le jeu sauvegarde : si les valeurs lues via MCP sont anciennes, s'appuyer sur la comparaison de l'étape 4.

- [ ] **Step 3 : jouer le show**

L'utilisateur joue le show jusqu'à l'écran « Show Complete ».
Expected :
- le panneau « Match Impact » apparaît dans la colonne de droite, sous la popularité de la promotion ;
- un lutteur par carte, dans l'ordre du card, avec ses segments en sous-titre ;
- les angles ont leurs participants ;
- le bouton ▾ replie et déplie le panneau.

Si le panneau n'apparaît pas : regarder DevTools. Si le panneau flottant apparaît après « End Show », c'est que la détection a raté (corriger `summaryWatcher`) ; s'il n'apparaît pas non plus, vérifier les erreurs `[Plugin:match-impact]`.

- [ ] **Step 4 : comparer avec le jeu et la base**

- Les variations de popularité du panneau correspondent à celles affichées par le jeu dans les résultats de chaque segment (« popularity changes »).
- Après une sauvegarde du jeu, relire via MCP les mêmes colonnes qu'à l'étape 2 : chaque écart affiché ≥ `minDelta` correspond à `après − avant` (arrondi à une décimale).

- [ ] **Step 5 : historique, désactivation, rechargement**

- Cliquer « End Show », ouvrir « Match Impact » dans le menu latéral : le show apparaît, le clic affiche son récap.
- Désactiver le plugin dans les réglages : l'entrée de menu, la page et tout panneau disparaissent sans redémarrer.
- Réactiver le plugin : l'entrée revient, l'historique est intact.
- Redémarrer le jeu : l'historique est toujours là (`F:\Dev\MatchImpact\data\history.json` existe).
- Modifier un libellé dans `src/domain/stats.js`, recharger le plugin à chaud, jouer un show : le nouveau libellé apparaît (rechargement des modules de `src/`). Annuler la modification ensuite.

- [ ] **Step 6 : mettre à jour le README**

Remplacer la section « État » de `README.md` par :

```markdown
## État

- [x] Cahier des charges et design (`docs/`)
- [x] Domaine, cas d'usage, présentation et adapters, testés (`npm test`)
- [x] Validation `validate_plugin`
- [x] Test réel : panneau de fin de show, historique, désactivation à chaud

## Développement

- Tests : `npm test` (Node 24, aucune dépendance).
- Architecture : voir la spec, section « Architecture (clean architecture) ». Le test `test/architecture.test.js` fait respecter la règle de dépendance.
```

- [ ] **Step 7 : commit et push**

```bash
git add README.md
git commit -m "docs: état du projet après le test réel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

## Couverture de la spec

| Exigence de la spec | Tâche |
|---|---|
| Photo au `show:started`, filtre `onlyMyPromotion` | 7, 11, 12, 16 |
| Détection de l'écran récapitulatif (`MutationObserver`, `summary-shown`, `Booking.currentShow` optionnel) | 14 |
| Récap à l'ouverture de l'écran, repli `findLatestCompletedShow` | 7, 11 |
| Filet de sécurité `show:ended` et panneau flottant | 7, 13 |
| Stats suivies et groupes | 2 |
| Règles de calcul (seuil, null, arrondi, ordre, absent, sans changement, blessure, relations) | 3, 4 |
| Panneau dans `.br-summary-side`, couleurs du thème, échappement | 9, 13 |
| Page Historique, menu latéral | 9, 15 |
| `data/history.json` borné | 5, 10 |
| Réglages et défauts | 6, 12 |
| Erreurs attrapées, SQL paramétré, requêtes groupées | 7, 8, 11 |
| Nettoyage à la désactivation | 13, 14, 15, 16 |
| Règle de dépendance testée | 1 |
| Rechargement à chaud des modules de `src/` | 16, 17 |
| Critères de réussite 1 à 5 | 16, 17 |
