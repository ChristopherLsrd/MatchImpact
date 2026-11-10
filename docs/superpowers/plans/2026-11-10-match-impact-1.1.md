# Match Impact 1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le plugin en français ou en anglais selon la langue du jeu, et ajouter un écran « Réglages » dans la page Match Impact.

**Architecture:** Le domaine ne garde que les clés des stats ; un module `presentation/i18n.js` fournit les dictionnaires et chaque rendu reçoit la langue en paramètre. La fenêtre du jeu transmet `I18n.locale` avec chaque demande. Un nouveau cas d'usage `SettingsEditor` contrôle et enregistre les réglages ; `historyPage` sert le formulaire et reçoit les modifications.

**Tech Stack:** Plugin Electron (processus principal), CommonJS, Node 24, `node --test`, aucune dépendance.

**Spec:** `docs/superpowers/specs/2026-11-10-match-impact-1.1-design.md` (complète `docs/superpowers/specs/2026-11-10-match-impact-design.md`).

## Global Constraints

- Aucune dépendance externe ; `src/` ne `require` aucun module hors du dépôt.
- Règle de dépendance (`test/support/dependencyRule.js`) : `domain` → `domain` ; `application` → `domain`, `application` ; `presentation` → `domain`, `presentation` ; `adapters` → `domain`, `application/ports`, `presentation`. Un adapter n'importe jamais un autre adapter.
- Langue : `'fr'` si le code commence par `fr` (insensible à la casse), sinon `'en'` ; valeur absente = `'en'`.
- Tout texte issu de la base ou des réglages est échappé (`escapeHtml`). Aucun attribut `style=` dans le HTML produit.
- Couleurs : uniquement les tokens `--mi-*`, définis sur les sélecteurs du plugin, jamais sur `:root`.
- Commits : messages en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pas de push.
- Tests : `npm test` doit passer à la fin de chaque tâche.

## Fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/domain/stats.js`, `src/domain/recap.js` | retirer `label` | 1 |
| `src/presentation/i18n.js` (nouveau) | dictionnaires, `resolveLocale`, `t`, `statLabel` | 2 |
| `src/presentation/recapHtml.js` | rendus traduits, coquille avec bouton Réglages | 3 |
| `src/presentation/recapHtml.js` | `renderSettingsForm` et CSS | 4 |
| `src/application/ports.js`, `src/application/SettingsEditor.js` (nouveau), `src/application/ShowTracker.js`, `src/adapters/GameSettings.js` | ports `Settings.set` et `RecapView.setLocale`, contrôle des réglages, langue transmise | 5 |
| `src/adapters/GameRecapView.js`, `src/adapters/summaryWatcher.js` | langue mémorisée, langue envoyée par l'écran de fin | 6 |
| `src/adapters/historyPage.js` | handlers et script de page | 7 |
| `index.js`, `plugin.json`, `package.json`, `README.md` | branchement, version, doc | 8 |

---

### Task 1: Le domaine ne connaît plus que les clés des stats

**Files:**
- Modify: `src/domain/stats.js`
- Modify: `src/domain/recap.js:51`
- Test: `test/domain/stats.test.js`, `test/domain/recap.test.js`

**Interfaces:**
- Produces: `STATS` : `{ key, group, table, inverted }` (plus de `label`). `computeRecap(...).workers[].changes[]` : `{ key, before, after, delta, inverted }`.

- [ ] **Step 1: Adapter les tests**

Dans `test/domain/stats.test.js`, remplacer le test « chaque stat a une forme complète » par :

```js
test('chaque stat a une forme complète, sans libellé', () => {
  for (const s of STATS) {
    assert.equal(typeof s.key, 'string');
    assert.equal('label' in s, false, `libellé inattendu pour ${s.key}`);
    assert.ok(GROUPS.includes(s.group), `groupe inconnu pour ${s.key}`);
    assert.ok(['workers', 'contracts'].includes(s.table), `table inconnue pour ${s.key}`);
    assert.equal(typeof s.inverted, 'boolean');
  }
});
```

Dans `test/domain/recap.test.js` :
- ligne 30 : `{ key: 'entertainment', label: 'Divertissement', before: 62, after: 63.5, delta: 1.5, inverted: false },` devient `{ key: 'entertainment', before: 62, after: 63.5, delta: 1.5, inverted: false },`
- lignes 51-53 : `key: 'momentum', label: 'Momentum', before: 0, after: 5, delta: 5, inverted: false,` devient `key: 'momentum', before: 0, after: 5, delta: 5, inverted: false,`

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: 3 échecs (stats et deux tests de recap).

- [ ] **Step 3: Implémenter**

`src/domain/stats.js` : remplacer la fonction `stat` et le catalogue par :

```js
function stat(key, group, table, inverted) {
  return Object.freeze({ key, group, table, inverted });
}

/** Stats suivies, dans l'ordre d'affichage. Les libellés sont dans presentation/i18n.js. */
const STATS = Object.freeze([
  stat('northAmericaPop', 'popularity', 'workers', false),
  stat('southAmericaPop', 'popularity', 'workers', false),
  stat('europePop', 'popularity', 'workers', false),
  stat('asiaPop', 'popularity', 'workers', false),
  stat('oceaniaPop', 'popularity', 'workers', false),
  stat('africaPop', 'popularity', 'workers', false),
  stat('momentum', 'momentumMorale', 'contracts', false),
  stat('morale', 'momentumMorale', 'contracts', false),
  stat('fatigue', 'condition', 'workers', true),
  stat('stamina', 'condition', 'workers', false),
  stat('wrestlingSkill', 'skills', 'workers', false),
  stat('entertainment', 'skills', 'workers', false),
  stat('starPower', 'skills', 'workers', false),
  stat('psychology', 'skills', 'workers', false),
  stat('charisma', 'skills', 'workers', false),
  stat('brawling', 'skills', 'workers', false),
  stat('technical', 'skills', 'workers', false),
  stat('aerial', 'skills', 'workers', false),
  stat('puroresu', 'skills', 'workers', false),
  stat('acting', 'skills', 'workers', false),
  stat('basics', 'skills', 'workers', false),
  stat('consistency', 'skills', 'workers', false),
  stat('athleticism', 'skills', 'workers', false),
  stat('toughness', 'skills', 'workers', false),
  stat('resilience', 'skills', 'workers', false),
]);
```

`src/domain/recap.js`, dans `statChanges` :

```js
    changes.push({
      key: s.key, before: round1(before), after: round1(after), delta: round1(delta), inverted: s.inverted,
    });
```

Vérifier qu'aucun autre fichier de `src/` ne lit `.label` d'une stat : `grep -rn "\.label" src` ne doit renvoyer que `src/presentation/recapHtml.js` (corrigé à la tâche 3) et `src/adapters/GameSettings.js`/`ports.js` (labels des réglages, sans rapport).

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: les tests de `domain` passent. Des tests de `presentation` peuvent encore passer car leur fixture fournit `label` ; aucun échec attendu.

- [ ] **Step 5: Commit**

```bash
git add src/domain test/domain
git commit -m "refactor: le domaine ne garde que les clés des stats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dictionnaires anglais et français

**Files:**
- Create: `src/presentation/i18n.js`
- Test: `test/presentation/i18n.test.js`

**Interfaces:**
- Produces: `resolveLocale(code) → 'en'|'fr'` ; `t(locale, key, params?) → string` ; `statLabel(locale, statKey) → string` ; `MESSAGES` ; `STAT_LABELS`.

- [ ] **Step 1: Écrire les tests**

`test/presentation/i18n.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLocale, t, statLabel, MESSAGES, STAT_LABELS } = require('../../src/presentation/i18n');
const { STATS } = require('../../src/domain/stats');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

test('resolveLocale : français si le code commence par fr, sinon anglais', () => {
  assert.equal(resolveLocale('fr'), 'fr');
  assert.equal(resolveLocale('fr-FR'), 'fr');
  assert.equal(resolveLocale('FR'), 'fr');
  assert.equal(resolveLocale('en'), 'en');
  assert.equal(resolveLocale('de'), 'en');
  assert.equal(resolveLocale(''), 'en');
  assert.equal(resolveLocale(null), 'en');
  assert.equal(resolveLocale(undefined), 'en');
});

test('les deux langues ont les mêmes clés', () => {
  assert.deepEqual(Object.keys(MESSAGES.fr).sort(), Object.keys(MESSAGES.en).sort());
  assert.deepEqual(Object.keys(STAT_LABELS.fr).sort(), Object.keys(STAT_LABELS.en).sort());
});

test('chaque stat a un libellé dans les deux langues', () => {
  for (const s of STATS) {
    assert.ok(STAT_LABELS.en[s.key], `en : ${s.key}`);
    assert.ok(STAT_LABELS.fr[s.key], `fr : ${s.key}`);
  }
});

test('chaque réglage a un libellé et une aide dans les deux langues', () => {
  for (const s of SETTINGS_SCHEMA) {
    for (const lang of ['en', 'fr']) {
      assert.ok(MESSAGES[lang][`setting.${s.key}.label`], `${lang} : setting.${s.key}.label`);
      assert.equal(typeof MESSAGES[lang][`setting.${s.key}.help`], 'string', `${lang} : setting.${s.key}.help`);
    }
  }
});

test('t traduit et remplace les paramètres', () => {
  assert.equal(t('fr', 'wrestlers.many', { n: 3 }), '3 catcheurs');
  assert.equal(t('en', 'wrestlers.one', { n: 1 }), '1 wrestler');
  assert.equal(t('de', 'injury'), 'Injury');
  assert.equal(t('fr', 'injuryReturn', { type: 'Broken Arm', date: '2026-03-01' }), 'Broken Arm (retour 2026-03-01)');
});

test('t renvoie la clé si elle est inconnue et garde un paramètre manquant', () => {
  assert.equal(t('fr', 'nope.key'), 'nope.key');
  assert.equal(t('en', 'photoOf'), 'Photo of {name}');
});

test('statLabel traduit et renvoie la clé si la stat est inconnue', () => {
  assert.equal(statLabel('fr', 'stamina'), 'Endurance');
  assert.equal(statLabel('en', 'stamina'), 'Stamina');
  assert.equal(statLabel(undefined, 'europePop'), 'Pop Europe');
  assert.equal(statLabel('fr', 'mystery'), 'mystery');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/presentation/i18n.test.js 2>&1 | grep -E "^ℹ (pass|fail)|Cannot find"`
Expected: `Cannot find module '../../src/presentation/i18n'`.

- [ ] **Step 3: Implémenter**

`src/presentation/i18n.js` :

```js
'use strict';

// Textes du plugin en anglais et en français. La langue suit celle du jeu (I18n.locale) :
// français si elle commence par « fr », anglais sinon.

const STAT_LABELS = Object.freeze({
  en: Object.freeze({
    northAmericaPop: 'Pop N. America',
    southAmericaPop: 'Pop S. America',
    europePop: 'Pop Europe',
    asiaPop: 'Pop Asia',
    oceaniaPop: 'Pop Oceania',
    africaPop: 'Pop Africa',
    momentum: 'Momentum',
    morale: 'Morale',
    fatigue: 'Fatigue',
    stamina: 'Stamina',
    wrestlingSkill: 'Wrestling',
    entertainment: 'Entertainment',
    starPower: 'Star power',
    psychology: 'Psychology',
    charisma: 'Charisma',
    brawling: 'Brawling',
    technical: 'Technical',
    aerial: 'Aerial',
    puroresu: 'Puroresu',
    acting: 'Acting',
    basics: 'Basics',
    consistency: 'Consistency',
    athleticism: 'Athleticism',
    toughness: 'Toughness',
    resilience: 'Resilience',
  }),
  fr: Object.freeze({
    northAmericaPop: 'Pop Am. Nord',
    southAmericaPop: 'Pop Am. Sud',
    europePop: 'Pop Europe',
    asiaPop: 'Pop Asie',
    oceaniaPop: 'Pop Océanie',
    africaPop: 'Pop Afrique',
    momentum: 'Momentum',
    morale: 'Moral',
    fatigue: 'Fatigue',
    stamina: 'Endurance',
    wrestlingSkill: 'Wrestling',
    entertainment: 'Divertissement',
    starPower: 'Star power',
    psychology: 'Psychologie',
    charisma: 'Charisme',
    brawling: 'Bagarre',
    technical: 'Technique',
    aerial: 'Aérien',
    puroresu: 'Puroresu',
    acting: "Jeu d'acteur",
    basics: 'Bases',
    consistency: 'Régularité',
    athleticism: 'Athlétisme',
    toughness: 'Robustesse',
    resilience: 'Résilience',
  }),
});

const MESSAGES = Object.freeze({
  en: Object.freeze({
    'wrestlers.one': '{n} wrestler',
    'wrestlers.many': '{n} wrestlers',
    collapse: 'Collapse',
    close: 'Close',
    photoOf: 'Photo of {name}',
    injury: 'Injury',
    injuryReturn: '{type} (back {date})',
    relations: 'Relationships',
    noChange: 'No notable change during this show.',
    historyEmpty: 'No show recorded yet.',
    historyPick: 'Pick a show from the list.',
    loading: 'Loading…',
    recapMissing: 'Recap not found.',
    recapUnreadable: 'Recap could not be read.',
    settings: 'Settings',
    'settings.tracked': 'Tracked stats',
    'settings.display': 'Display',
    'settings.saved': 'Saved',
    'settings.error': 'Could not save',
    'settings.nextShow': 'Changes apply from the next show.',
    'setting.trackPopularity.label': 'Popularity',
    'setting.trackPopularity.help': 'Popularity in the six regions',
    'setting.trackMomentumMorale.label': 'Momentum and morale',
    'setting.trackMomentumMorale.help': 'Contract momentum and morale',
    'setting.trackCondition.label': 'Fatigue and stamina',
    'setting.trackCondition.help': '',
    'setting.trackSkills.label': 'Skills',
    'setting.trackSkills.help': 'Simple or detailed, depending on the world',
    'setting.trackRelationships.label': 'Relationships',
    'setting.trackRelationships.help': 'Between wrestlers of the same segment',
    'setting.showEndOfShowPanel.label': 'End-of-show panel',
    'setting.showEndOfShowPanel.help': 'Show the recap on the results screen',
    'setting.onlyMyPromotion.label': 'Only my promotion',
    'setting.onlyMyPromotion.help': "Ignore other promotions' shows",
    'setting.minDelta.label': 'Minimum change',
    'setting.minDelta.help': 'Smaller changes are hidden (0–10)',
    'setting.historySize.label': 'Shows kept',
    'setting.historySize.help': 'Number of shows in the history (1–100)',
  }),
  fr: Object.freeze({
    'wrestlers.one': '{n} catcheur',
    'wrestlers.many': '{n} catcheurs',
    collapse: 'Replier',
    close: 'Fermer',
    photoOf: 'Photo de {name}',
    injury: 'Blessure',
    injuryReturn: '{type} (retour {date})',
    relations: 'Relations',
    noChange: 'Aucun changement notable pendant ce show.',
    historyEmpty: "Aucun show enregistré pour l'instant.",
    historyPick: 'Choisis un show dans la liste.',
    loading: 'Chargement…',
    recapMissing: 'Récap introuvable.',
    recapUnreadable: 'Récap illisible.',
    settings: 'Réglages',
    'settings.tracked': 'Stats suivies',
    'settings.display': 'Affichage',
    'settings.saved': 'Enregistré',
    'settings.error': "Échec de l'enregistrement",
    'settings.nextShow': "Les changements s'appliquent dès le show suivant.",
    'setting.trackPopularity.label': 'Popularité',
    'setting.trackPopularity.help': 'Popularité dans les six régions',
    'setting.trackMomentumMorale.label': 'Momentum et moral',
    'setting.trackMomentumMorale.help': 'Momentum et moral du contrat',
    'setting.trackCondition.label': 'Fatigue et endurance',
    'setting.trackCondition.help': '',
    'setting.trackSkills.label': 'Talent',
    'setting.trackSkills.help': 'Simples ou détaillées selon le monde',
    'setting.trackRelationships.label': 'Relations',
    'setting.trackRelationships.help': "Entre lutteurs d'un même segment",
    'setting.showEndOfShowPanel.label': 'Panneau de fin de show',
    'setting.showEndOfShowPanel.help': "Affiche le récap dans l'écran de fin de show",
    'setting.onlyMyPromotion.label': 'Seulement ma promotion',
    'setting.onlyMyPromotion.help': 'Ignore les shows des autres promotions',
    'setting.minDelta.label': 'Écart minimum',
    'setting.minDelta.help': 'Les écarts plus petits sont masqués (0 à 10)',
    'setting.historySize.label': 'Shows conservés',
    'setting.historySize.help': "Nombre de shows dans l'historique (1 à 100)",
  }),
});

function resolveLocale(code) {
  return typeof code === 'string' && /^fr/i.test(code.trim()) ? 'fr' : 'en';
}

function has(dict, key) {
  return Object.prototype.hasOwnProperty.call(dict, key);
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined || params[name] === null ? match : String(params[name])
  ));
}

function t(locale, key, params) {
  const dict = MESSAGES[resolveLocale(locale)];
  return interpolate(has(dict, key) ? dict[key] : String(key), params);
}

function statLabel(locale, statKey) {
  const dict = STAT_LABELS[resolveLocale(locale)];
  return has(dict, statKey) ? dict[statKey] : String(statKey);
}

module.exports = { resolveLocale, t, statLabel, MESSAGES, STAT_LABELS };
```

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/i18n.js test/presentation/i18n.test.js
git commit -m "feat: dictionnaires anglais et français du plugin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rendus traduits et bouton Réglages dans la coquille

**Files:**
- Modify: `src/presentation/recapHtml.js`
- Test: `test/presentation/recapHtml.test.js`

**Interfaces:**
- Consumes: `resolveLocale`, `t`, `statLabel` (tâche 2).
- Produces: `renderRecapBody(recap, locale)`, `renderPanel(recap, locale)`, `renderFloating(recap, locale)`, `renderHistoryList(items, locale)`, `renderHistoryPageShell()` (avec `#mi-settings-button`, `.mi-settings-label` vide, `.mi-history-pick` vide). Le libellé d'une stat vient toujours de `statLabel(locale, change.key)`, jamais de `change.label`.

- [ ] **Step 1: Adapter les tests existants au français et ajouter les tests anglais**

Dans `test/presentation/recapHtml.test.js`, juste après `const html = require(...)`, ajouter :

```js
// Les tests historiques vérifient le rendu français.
const fr = {
  renderRecapBody: (r) => html.renderRecapBody(r, 'fr'),
  renderPanel: (r) => html.renderPanel(r, 'fr'),
  renderFloating: (r) => html.renderFloating(r, 'fr'),
  renderHistoryList: (items) => html.renderHistoryList(items, 'fr'),
};
```

Puis remplacer dans tout le fichier les appels existants (sauf ceux de `fr` lui-même) :

```bash
sed -i -E '/^const fr = \{/,/^\};/!{s/html\.renderRecapBody\(/fr.renderRecapBody(/g;s/html\.renderPanel\(/fr.renderPanel(/g;s/html\.renderFloating\(/fr.renderFloating(/g;s/html\.renderHistoryList\(/fr.renderHistoryList(/g}' test/presentation/recapHtml.test.js
```

Dans le test « le panneau est marqué, titré et repliable », remplacer la première assertion par :

```js
  assert.match(out, /^<section class="mi-panel" data-plugin-id="match-impact" aria-label="Match Impact" lang="fr">/);
```

Dans « le panneau flottant a un identifiant et un bouton fermer », remplacer la première assertion par :

```js
  assert.match(out, /^<section class="mi-panel mi-floating" id="mi-floating" data-plugin-id="match-impact" aria-label="Match Impact" lang="fr">/);
```

Remplacer le test « la page historique a ses deux zones » par :

```js
test('la page historique a ses deux zones et le bouton Réglages, sans texte', () => {
  const out = html.renderHistoryPageShell();
  assert.match(out, /id="mi-history-list"/);
  assert.match(out, /id="mi-history-detail"/);
  assert.match(out, /leftRightSplit/);
  assert.match(out, /<button type="button" class="mi-settings-button clickable" id="mi-settings-button">⚙ <span class="mi-settings-label"><\/span><\/button>/);
  assert.match(out, /<div class="noResults mi-history-pick"><\/div>/);
});
```

Ajouter à la fin du fichier :

```js
test('rendu anglais : compteur, libellés, photo, relations, langue', () => {
  const out = html.renderPanel(recap(), 'en');
  assert.match(out, /lang="en"/);
  assert.match(out, /<span class="mi-count">1 wrestler<\/span>/);
  assert.match(out, /title="Collapse"/);
  assert.match(out, /aria-label="Photo of Gustave Le Brun"/);
  assert.match(out, /<span class="mi-label">Entertainment<\/span>/);
  assert.match(out, /<h3 class="mi-name">Relationships<\/h3>/);
});

test('rendu anglais : blessure et message vide', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Broken Arm', healDate: '2026-03-01' };
  assert.match(html.renderRecapBody(r, 'en'), /<span class="mi-label">Injury<\/span><span class="mi-injury-text">Broken Arm \(back 2026-03-01\)<\/span>/);
  const empty = recap({ relations: [] });
  empty.workers[0].changes = [];
  assert.match(html.renderRecapBody(empty, 'en'), /No notable change during this show\./);
});

test('une blessure sans date de retour affiche seulement le type', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Sprain', healDate: null };
  assert.match(html.renderRecapBody(r, 'fr'), /<span class="mi-injury-text">Sprain<\/span>/);
});

test('sans langue, le rendu est en anglais', () => {
  assert.match(html.renderPanel(recap()), /1 wrestler/);
  assert.match(html.renderRecapBody(recap()), /<div class="mi-recap" lang="en">/);
});

test('le libellé archivé est ignoré : la stat est traduite depuis sa clé', () => {
  const r = recap();
  r.workers[0].changes = [{ key: 'stamina', label: 'Endurance', before: 70, after: 72, delta: 2, inverted: false }];
  assert.match(html.renderRecapBody(r, 'en'), /<span class="mi-label">Stamina<\/span>/);
  assert.doesNotMatch(html.renderRecapBody(r, 'en'), /Endurance/);
});

test('la liste d\'historique vide est traduite', () => {
  assert.match(html.renderHistoryList([], 'en'), /No show recorded yet\./);
  assert.match(html.renderHistoryList([], 'fr'), /Aucun show enregistré/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/presentation/recapHtml.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: plusieurs échecs (compteur anglais, `lang`, bouton Réglages…).

- [ ] **Step 3: Implémenter**

Dans `src/presentation/recapHtml.js` :

1. Après `'use strict';`, ajouter `const { resolveLocale, t, statLabel } = require('./i18n');`.

2. Remplacer `renderInjury`, `renderCard`, `renderRelations`, `renderRecapBody`, `renderCount`, `renderHeader`, `renderPanel`, `renderFloating`, `renderHistoryList` et `renderHistoryPageShell` par :

```js
function renderInjury(injury, locale) {
  const text = injury.healDate
    ? t(locale, 'injuryReturn', { type: injury.type, date: injury.healDate })
    : String(injury.type);
  return `<div class="mi-stat mi-injury"><span class="mi-label">${escapeHtml(t(locale, 'injury'))}</span>`
    + `<span class="mi-injury-text">${escapeHtml(text)}</span></div>`;
}

function renderCard(worker, segments, locale) {
  const match = worker.segments
    .map((i) => (segments[i] ? segments[i].name : ''))
    .filter(Boolean)
    .join(' · ');
  const stats = worker.changes
    .map((c) => renderStat(statLabel(locale, c.key), c.before, c.after, c.delta, c.inverted ? c.delta < 0 : c.delta > 0))
    .join('');
  return '<article class="mi-card">'
    + '<div class="mi-id">'
    + `<div class="mi-avatar" role="img" aria-label="${escapeHtml(t(locale, 'photoOf', { name: worker.name }))}"`
    + ` data-mi-picture="${escapeHtml(worker.picture)}" data-mi-contract-picture="${escapeHtml(worker.contractPicture)}">`
    + `${escapeHtml(initials(worker.name))}</div>`
    + '<div class="mi-id-text">'
    + `<h3 class="mi-name">${escapeHtml(worker.name)}</h3>`
    + `<p class="mi-match" title="${escapeHtml(match)}">${escapeHtml(match)}</p>`
    + '</div></div>'
    + `<div class="mi-stats">${stats}${worker.injury ? renderInjury(worker.injury, locale) : ''}</div>`
    + '</article>';
}

function renderRelations(relations, locale) {
  if (!relations.length) return '';
  return '<article class="mi-card mi-relations">'
    + `<div class="mi-id"><div class="mi-id-text"><h3 class="mi-name">${escapeHtml(t(locale, 'relations'))}</h3></div></div>`
    + '<div class="mi-stats">'
    + relations.map((r) => renderStat(`${r.name1} ↔ ${r.name2}`, r.before, r.after, r.delta, r.delta > 0)).join('')
    + '</div></article>';
}

function shownWorkers(recap) {
  return recap.workers.filter((w) => w.changes.length || w.injury);
}

function renderRecapBody(recap, locale) {
  const lang = resolveLocale(locale);
  const show = `<p class="mi-show">${escapeHtml(recap.showName)}${recap.date ? ` · ${escapeHtml(recap.date)}` : ''}</p>`;
  const workers = shownWorkers(recap);
  const relations = recap.relations || [];
  const content = workers.length || relations.length
    ? workers.map((w) => renderCard(w, recap.segments, lang)).join('') + renderRelations(relations, lang)
    : `<div class="noResults">${escapeHtml(t(lang, 'noChange'))}</div>`;
  return `<div class="mi-recap" lang="${lang}">${show}${content}</div>`;
}

function renderCount(recap, locale) {
  const n = shownWorkers(recap).length;
  return `<span class="mi-count">${escapeHtml(t(locale, n > 1 ? 'wrestlers.many' : 'wrestlers.one', { n }))}</span>`;
}

function renderHeader(recap, button, locale) {
  return '<header class="mi-header"><h2>Match Impact</h2>'
    + `<div class="mi-header-tools">${renderCount(recap, locale)}${button}</div></header>`;
}

function renderPanel(recap, locale) {
  const lang = resolveLocale(locale);
  const label = escapeHtml(t(lang, 'collapse'));
  const toggle = `<button type="button" class="mi-toggle clickable" title="${label}" aria-label="${label}"`
    + ' onclick="this.closest(\'.mi-panel\').classList.toggle(\'mi-collapsed\')">▾</button>';
  return `<section class="mi-panel" ${PLUGIN_ATTR} aria-label="Match Impact" lang="${lang}">`
    + renderHeader(recap, toggle, lang)
    + renderRecapBody(recap, lang)
    + '</section>';
}

function renderFloating(recap, locale) {
  const lang = resolveLocale(locale);
  const label = escapeHtml(t(lang, 'close'));
  const close = `<button type="button" class="mi-close clickable" title="${label}" aria-label="${label}"`
    + ' onclick="this.closest(\'.mi-floating\').remove()">✕</button>';
  return `<section class="mi-panel mi-floating" id="mi-floating" ${PLUGIN_ATTR} aria-label="Match Impact" lang="${lang}">`
    + renderHeader(recap, close, lang)
    + renderRecapBody(recap, lang)
    + '</section>';
}
```

et :

```js
function renderHistoryList(items, locale) {
  if (!items.length) return `<div class="noResults">${escapeHtml(t(locale, 'historyEmpty'))}</div>`;
  return '<ul class="mi-history-list">'
    + items.map((i) => `<li class="clickable" data-mi-index="${Number(i.index)}">`
      + `<span class="mi-history-date">${escapeHtml(i.date)}</span> `
      + `<span class="mi-history-name">${escapeHtml(i.showName)}</span></li>`).join('')
    + '</ul>';
}

// Coquille sans texte : le script de page la remplit dans la langue du jeu (handler page-texts).
function renderHistoryPageShell() {
  return '<div class="leftRightSplit mi-history">'
    + '<div class="leftListContainer">'
    + '<button type="button" class="mi-settings-button clickable" id="mi-settings-button">⚙ <span class="mi-settings-label"></span></button>'
    + '<div class="leftList" id="mi-history-list"></div></div>'
    + '<div class="rightDetail" id="mi-history-detail"><div class="noResults mi-history-pick"></div></div>'
    + '</div>';
}
```

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe, y compris `test/adapters/*` (ils appellent les rendus sans langue : anglais).

- [ ] **Step 5: Commit**

```bash
git add src/presentation/recapHtml.js test/presentation/recapHtml.test.js
git commit -m "feat: récap et historique traduits selon la langue du jeu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Formulaire de réglages

**Files:**
- Modify: `src/presentation/recapHtml.js`
- Test: `test/presentation/settingsForm.test.js`

**Interfaces:**
- Consumes: `t`, `resolveLocale` (tâche 2) ; `schema` = tableau `{ key, type: 'boolean'|'number', default, min?, max? }` (en pratique `SETTINGS_SCHEMA`, passé par l'adapter).
- Produces: `renderSettingsForm(schema, values, locale) → string` : `<form class="mi-settings" lang data-mi-saved data-mi-error onsubmit="return false">` ; chaque champ a `name` et `data-mi-setting` = clé ; zone `.mi-settings-status`. Export ajouté à `module.exports`.

- [ ] **Step 1: Écrire les tests**

`test/presentation/settingsForm.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSettingsForm, RECAP_CSS } = require('../../src/presentation/recapHtml');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

const DEFAULTS = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));

function field(out, key) {
  const m = out.match(new RegExp(`<input[^>]*data-mi-setting="${key}"[^>]*>`));
  return m ? m[0] : null;
}

test('un champ par réglage, dans deux blocs', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  for (const s of SETTINGS_SCHEMA) assert.ok(field(out, s.key), `champ manquant : ${s.key}`);
  assert.equal((out.match(/<fieldset class="mi-settings-block">/g) || []).length, 2);
  assert.match(out, /<legend>Stats suivies<\/legend>/);
  assert.match(out, /<legend>Affichage<\/legend>/);
  assert.ok(out.indexOf('data-mi-setting="trackRelationships"') < out.indexOf('<legend>Affichage</legend>'));
});

test('les cases reflètent les valeurs', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, trackSkills: false }, 'fr');
  assert.match(field(out, 'trackSkills'), /type="checkbox"/);
  assert.doesNotMatch(field(out, 'trackSkills'), /checked/);
  assert.match(field(out, 'trackPopularity'), / checked/);
});

test('les nombres ont leur valeur, leurs bornes et leur pas', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, minDelta: 2.5, historySize: 40 }, 'fr');
  assert.match(field(out, 'minDelta'), /type="number"[^>]* min="0" max="10" step="0\.1" value="2\.5"/);
  assert.match(field(out, 'historySize'), /type="number"[^>]* min="1" max="100" step="1" value="40"/);
});

test('une valeur absente prend le défaut du schéma', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, {}, 'fr');
  assert.match(field(out, 'minDelta'), /value="0\.5"/);
  assert.match(field(out, 'trackRelationships'), / checked/);
});

test('libellés, aides et messages dans la langue demandée', () => {
  const fr = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  assert.match(fr, /<form class="mi-settings" lang="fr" data-mi-saved="Enregistré" data-mi-error="Échec de l&#39;enregistrement" onsubmit="return false">/);
  assert.match(fr, /<span class="mi-setting-label">Talent<\/span><span class="mi-setting-help">Simples ou détaillées selon le monde<\/span>/);
  assert.match(fr, /Les changements s&#39;appliquent dès le show suivant\./);
  const en = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, undefined);
  assert.match(en, /lang="en"/);
  assert.match(en, /<span class="mi-setting-label">Shows kept<\/span>/);
  assert.match(en, /<h2 class="mi-settings-title">Settings<\/h2>/);
});

test('une aide vide n\'ajoute pas de ligne', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  assert.match(out, /<span class="mi-setting-label">Fatigue et endurance<\/span><\/span>/);
});

test('zone d\'état annoncée, valeurs échappées, aucun style en ligne', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, minDelta: '"><b>x' }, 'fr');
  assert.match(out, /<p class="mi-settings-status" aria-live="polite"><\/p><\/form>$/);
  assert.doesNotMatch(out, /"><b>x/);
  assert.doesNotMatch(out, /style=/);
});

test('le CSS stylise le formulaire avec les tokens du plugin', () => {
  assert.match(RECAP_CSS, /\.mi-panel, \.mi-recap, \.mi-settings, \.mi-settings-button \{/);
  assert.match(RECAP_CSS, /\.mi-settings-block \{[^}]*background: var\(--mi-card\);/);
  assert.match(RECAP_CSS, /\.mi-settings-status\.is-error \{ color: var\(--mi-bad\); \}/);
  assert.match(RECAP_CSS, /\.mi-settings-button\.active \{/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/presentation/settingsForm.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: échecs (`renderSettingsForm is not a function`).

- [ ] **Step 3: Implémenter**

Dans `src/presentation/recapHtml.js`, avant `function renderHistoryList`, ajouter :

```js
// Ordre des réglages dans le formulaire.
const SETTINGS_BLOCKS = [
  { title: 'settings.tracked', keys: ['trackPopularity', 'trackMomentumMorale', 'trackCondition', 'trackSkills', 'trackRelationships'] },
  { title: 'settings.display', keys: ['showEndOfShowPanel', 'onlyMyPromotion', 'minDelta', 'historySize'] },
];
const SETTING_STEPS = { minDelta: '0.1', historySize: '1' };

function settingValue(def, values) {
  const value = values ? values[def.key] : undefined;
  return value === undefined || value === null ? def.default : value;
}

function renderSettingField(def, value, locale) {
  const key = escapeHtml(def.key);
  const id = `mi-setting-${key}`;
  const helpText = t(locale, `setting.${def.key}.help`);
  const text = `<span class="mi-setting-text"><span class="mi-setting-label">${escapeHtml(t(locale, `setting.${def.key}.label`))}</span>`
    + `${helpText ? `<span class="mi-setting-help">${escapeHtml(helpText)}</span>` : ''}</span>`;
  if (def.type === 'boolean') {
    return `<label class="mi-setting mi-setting-check" for="${id}">`
      + `<input type="checkbox" id="${id}" name="${key}" data-mi-setting="${key}"${value === true ? ' checked' : ''}>`
      + `${text}</label>`;
  }
  const min = def.min === undefined ? '' : ` min="${Number(def.min)}"`;
  const max = def.max === undefined ? '' : ` max="${Number(def.max)}"`;
  return `<label class="mi-setting mi-setting-number" for="${id}">${text}`
    + `<input type="number" id="${id}" name="${key}" data-mi-setting="${key}"${min}${max}`
    + ` step="${SETTING_STEPS[def.key] || 'any'}" value="${escapeHtml(value)}"></label>`;
}

function renderSettingsForm(schema, values, locale) {
  const lang = resolveLocale(locale);
  const byKey = new Map((schema || []).map((def) => [def.key, def]));
  const blocks = SETTINGS_BLOCKS.map((block) => {
    const fields = block.keys
      .filter((key) => byKey.has(key))
      .map((key) => renderSettingField(byKey.get(key), settingValue(byKey.get(key), values), lang))
      .join('');
    return `<fieldset class="mi-settings-block"><legend>${escapeHtml(t(lang, block.title))}</legend>${fields}</fieldset>`;
  }).join('');
  return `<form class="mi-settings" lang="${lang}" data-mi-saved="${escapeHtml(t(lang, 'settings.saved'))}"`
    + ` data-mi-error="${escapeHtml(t(lang, 'settings.error'))}" onsubmit="return false">`
    + `<h2 class="mi-settings-title">${escapeHtml(t(lang, 'settings'))}</h2>`
    + blocks
    + `<p class="mi-settings-note">${escapeHtml(t(lang, 'settings.nextShow'))}</p>`
    + '<p class="mi-settings-status" aria-live="polite"></p></form>';
}
```

Dans `RECAP_CSS` :
- remplacer la première ligne `'.mi-panel, .mi-recap {',` par `'.mi-panel, .mi-recap, .mi-settings, .mi-settings-button {',` ;
- juste avant la ligne `'.mi-history-list li { display: flex; gap: 8px; }',`, insérer :

```js
  '.mi-settings { box-sizing: border-box; max-width: 760px; padding: 20px; background: var(--mi-bg);'
    + ' border-radius: var(--mi-radius); display: flex; flex-direction: column; gap: 12px; }',
  '.mi-settings-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'
    + ' color: var(--mi-text-2); }',
  '.mi-settings-block { margin: 0; padding: 8px 20px; background: var(--mi-card); border: 1px solid var(--mi-border);'
    + ' border-radius: var(--mi-radius); }',
  '.mi-settings-block legend { padding: 0 4px; font-size: 12px; font-weight: 700; color: var(--mi-muted); }',
  '.mi-setting { display: flex; align-items: center; gap: 12px; min-height: 44px; border-top: 1px solid var(--mi-border);'
    + ' cursor: pointer; }',
  '.mi-settings-block legend + .mi-setting { border-top: none; }',
  '.mi-setting-text { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-width: 0; }',
  '.mi-setting-label { font-size: 14px; color: var(--mi-text); }',
  '.mi-setting-help { font-size: 12px; color: var(--mi-muted); }',
  '.mi-setting input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--mi-good); }',
  '.mi-setting input[type="number"] { width: 80px; padding: 4px 8px; background: var(--mi-bg); color: var(--mi-text);'
    + ' border: 1px solid var(--mi-border); border-radius: 6px; font: inherit; }',
  '.mi-settings-note { margin: 0; font-size: 12px; color: var(--mi-muted); }',
  '.mi-settings-status { margin: 0; min-height: 1.4em; font-size: 12px; font-weight: 600; color: var(--mi-good); }',
  '.mi-settings-status.is-error { color: var(--mi-bad); }',
  '.mi-settings-button { display: flex; align-items: center; gap: 8px; width: 100%; margin-bottom: 8px; padding: 8px 12px;'
    + ' background: var(--mi-card); color: var(--mi-text-2); border: 1px solid var(--mi-border); border-radius: 8px;'
    + ' font: inherit; cursor: pointer; }',
  '.mi-settings-button.active { border-color: var(--mi-good); color: var(--mi-text); }',
```

Ajouter `renderSettingsForm,` à `module.exports` (après `renderHistoryPageShell,`).

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/recapHtml.js test/presentation/settingsForm.test.js
git commit -m "feat: formulaire de réglages traduit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ports, SettingsEditor et langue transmise par ShowTracker

**Files:**
- Modify: `src/application/ports.js`
- Create: `src/application/SettingsEditor.js`
- Modify: `src/application/ShowTracker.js` (`onSummaryShown`)
- Modify: `src/adapters/GameSettings.js`
- Modify: `test/fakes/index.js`
- Test: `test/application/SettingsEditor.test.js`, `test/application/ShowTracker.test.js`, `test/adapters/GameSettings.test.js`

**Interfaces:**
- Produces: port `Settings` = `get(key)`, `set(key, value)` ; port `RecapView` = `showInSummary(recap, locale)`, `showFloating(recap)`, `setLocale(locale)`. `createSettingsEditor({ settings, logger }) → { getAll(): Object, set(key, value): { ok: true, value } | { ok: false } }`.

- [ ] **Step 1: Écrire les tests**

`test/application/SettingsEditor.test.js` :

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSettingsEditor } = require('../../src/application/SettingsEditor');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');
const fakes = require('../fakes');

function setup(overrides = {}) {
  const settings = fakes.createFakeSettings(overrides);
  const logger = fakes.createFakeLogger();
  return { settings, logger, editor: createSettingsEditor({ settings, logger }) };
}

test('refuse un port manquant', () => {
  assert.throws(() => createSettingsEditor({}), TypeError);
});

test('getAll renvoie toutes les clés du schéma', () => {
  const { editor } = setup({ trackSkills: false });
  const all = editor.getAll();
  assert.deepEqual(Object.keys(all), SETTINGS_SCHEMA.map((s) => s.key));
  assert.equal(all.trackSkills, false);
  assert.equal(all.historySize, 20);
});

test('enregistre un booléen', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('trackSkills', false), { ok: true, value: false });
  assert.equal(settings.get('trackSkills'), false);
});

test('refuse un booléen invalide', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('trackSkills', 'false'), { ok: false });
  assert.equal(settings.get('trackSkills'), true);
});

test('ramène un nombre dans ses bornes', () => {
  const { editor, settings } = setup();
  assert.deepEqual(editor.set('minDelta', 25), { ok: true, value: 10 });
  assert.deepEqual(editor.set('minDelta', -1), { ok: true, value: 0 });
  assert.deepEqual(editor.set('minDelta', 2.5), { ok: true, value: 2.5 });
  assert.equal(settings.get('minDelta'), 2.5);
});

test('arrondit la taille de l\'historique à l\'entier', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('historySize', 12.6), { ok: true, value: 13 });
  assert.deepEqual(editor.set('historySize', 0.2), { ok: true, value: 1 });
});

test('refuse un nombre non fini ou d\'un autre type', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('minDelta', Number.NaN), { ok: false });
  assert.deepEqual(editor.set('minDelta', Infinity), { ok: false });
  assert.deepEqual(editor.set('minDelta', '3'), { ok: false });
});

test('refuse une clé inconnue', () => {
  const { editor } = setup();
  assert.deepEqual(editor.set('hack', true), { ok: false });
  assert.deepEqual(editor.set('__proto__', true), { ok: false });
});

test('journalise une erreur d\'écriture', () => {
  const logger = fakes.createFakeLogger();
  const settings = { get: () => true, set: () => { throw new Error('disque plein'); } };
  const editor = createSettingsEditor({ settings, logger });
  assert.deepEqual(editor.set('trackSkills', false), { ok: false });
  assert.equal(logger.errors.length, 1);
});
```

Dans `test/application/ShowTracker.test.js`, ajouter à la fin :

```js
test('transmet la langue de l\'écran de fin à la vue', () => {
  const { tracker, view } = setup();
  tracker.onShowStarted(STARTED);
  tracker.onSummaryShown({ showID: 77, locale: 'fr' });
  assert.deepEqual(view.summaryLocales, ['fr']);
});
```

Dans `test/adapters/GameSettings.test.js`, remplacer `fakeSettingsApi` par :

```js
function fakeSettingsApi(values = {}) {
  return {
    registered: null,
    writes: [],
    register(schema) { this.registered = schema; },
    get(key) { return values[key]; },
    set(key, value) { this.writes.push([key, value]); values[key] = value; },
  };
}
```

et ajouter à la fin :

```js
test('set enregistre la valeur auprès du jeu', () => {
  const api = fakeSettingsApi();
  const settings = createGameSettings(api);
  settings.set('trackSkills', false);
  assert.deepEqual(api.writes, [['trackSkills', false]]);
  assert.equal(settings.get('trackSkills'), false);
});
```

Dans `test/fakes/index.js`, remplacer `createFakeView` par :

```js
function createFakeView() {
  return {
    summary: [],
    summaryLocales: [],
    floating: [],
    locale: null,
    showInSummary(recap, locale) { this.summary.push(recap); this.summaryLocales.push(locale); },
    showFloating(recap) { this.floating.push(recap); },
    setLocale(locale) { this.locale = locale; },
  };
}
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: échecs de `SettingsEditor` (module absent), de `ShowTracker` (langue `undefined`) et de `GameSettings` (`set` absent).

- [ ] **Step 3: Implémenter**

`src/application/ports.js` :
- dans le commentaire d'en-tête, remplacer les lignes `RecapView` et `Settings` par :

```js
 * - RecapView : showInSummary(recap, locale) ; showFloating(recap) ; setLocale(locale)
 * - Settings : get(key) → valeur (clés et défauts : SETTINGS_SCHEMA) ; set(key, value)
```

- remplacer `SETTINGS_SCHEMA` par (libellés en anglais : le jeu ne les affiche pas, l'écran du plugin utilise i18n) :

```js
const SETTINGS_SCHEMA = Object.freeze([
  setting('showEndOfShowPanel', 'End-of-show panel', 'boolean', true, 'Show the recap on the results screen'),
  setting('onlyMyPromotion', 'Only my promotion', 'boolean', true, "Ignore other promotions' shows"),
  setting('trackPopularity', 'Popularity', 'boolean', true, 'Popularity in the six regions'),
  setting('trackMomentumMorale', 'Momentum and morale', 'boolean', true, 'Contract momentum and morale'),
  setting('trackCondition', 'Fatigue and stamina', 'boolean', true, 'Fatigue and stamina'),
  setting('trackSkills', 'Skills', 'boolean', true, 'Simple or detailed, depending on the world'),
  setting('trackRelationships', 'Relationships', 'boolean', true, 'Between wrestlers of the same segment'),
  setting('minDelta', 'Minimum change', 'number', 0.5, 'Smaller changes are hidden', { min: 0, max: 10 }),
  setting('historySize', 'Shows kept', 'number', 20, 'Number of shows in the history', { min: 1, max: 100 }),
]);
```

- dans `PORTS`, remplacer les lignes `RecapView` et `Settings` par :

```js
  RecapView: ['showInSummary', 'showFloating', 'setLocale'],
  Settings: ['get', 'set'],
```

`src/application/SettingsEditor.js` :

```js
'use strict';
const { SETTINGS_SCHEMA, assertPort } = require('./ports');

const INTEGER_KEYS = Object.freeze(['historySize']);

/** Lit et modifie les réglages du plugin en contrôlant chaque valeur. */
function createSettingsEditor({ settings, logger }) {
  assertPort('Settings', settings);
  assertPort('Logger', logger);

  const byKey = new Map(SETTINGS_SCHEMA.map((def) => [def.key, def]));

  function getAll() {
    return Object.fromEntries(SETTINGS_SCHEMA.map((def) => [def.key, settings.get(def.key)]));
  }

  function normalize(def, value) {
    if (def.type === 'boolean') return typeof value === 'boolean' ? { ok: true, value } : { ok: false };
    if (def.type !== 'number' || typeof value !== 'number' || !Number.isFinite(value)) return { ok: false };
    let next = INTEGER_KEYS.includes(def.key) ? Math.round(value) : value;
    if (def.min !== undefined) next = Math.max(def.min, next);
    if (def.max !== undefined) next = Math.min(def.max, next);
    return { ok: true, value: next };
  }

  function set(key, value) {
    const def = byKey.get(key);
    if (!def) return { ok: false };
    const result = normalize(def, value);
    if (!result.ok) return result;
    try {
      settings.set(key, result.value);
      return result;
    } catch (e) {
      logger.error('settings.set', e);
      return { ok: false };
    }
  }

  return { getAll, set };
}

module.exports = { createSettingsEditor };
```

`src/application/ShowTracker.js`, dans `onSummaryShown`, remplacer
`if (settings.get('showEndOfShowPanel')) view.showInSummary(recap);`
par
`if (settings.get('showEndOfShowPanel')) view.showInSummary(recap, payload && payload.locale);`

`src/adapters/GameSettings.js`, remplacer l'objet renvoyé par :

```js
  return {
    get(key) {
      const value = settingsApi.get(key);
      return value === undefined || value === null ? defaults[key] : value;
    },
    set(key, value) {
      settingsApi.set(key, value);
    },
  };
```

`src/adapters/GameRecapView.js` : `createShowTracker` vérifie le port `RecapView` (`assertPort`), qui exige maintenant `setLocale`. Pour que le plugin reste chargeable entre ce commit et le suivant, ajouter dans `createGameRecapView` une version provisoire (la tâche 6 la remplace) :

```js
  function setLocale() {}
```

et retourner `{ showInSummary, showFloating, setLocale }`.

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe (le test `ports` « les réglages numériques ont des bornes » reste vrai : libellés et descriptions sont des chaînes).

- [ ] **Step 5: Commit**

```bash
git add src/application src/adapters/GameSettings.js src/adapters/GameRecapView.js test/application test/adapters/GameSettings.test.js test/fakes
git commit -m "feat: SettingsEditor, Settings.set et langue transmise à la vue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: La vue mémorise la langue ; l'écran de fin l'envoie

**Files:**
- Modify: `src/adapters/GameRecapView.js`
- Modify: `src/adapters/summaryWatcher.js`
- Test: `test/adapters/GameRecapView.test.js`, `test/adapters/summaryWatcher.test.js` (nouveau)

**Interfaces:**
- Consumes: `resolveLocale` (tâche 2), `renderPanel(recap, locale)`, `renderFloating(recap, locale)` (tâche 3).
- Produces: `createGameRecapView(ui, logger) → { showInSummary(recap, locale), showFloating(recap), setLocale(locale), refreshLocale() }`. `refreshLocale()` lit `I18n.locale` dans la fenêtre du jeu par `ui.executeJS` et appelle `setLocale`. Le message `summary-shown` contient `{ showID, locale }`.

- [ ] **Step 1: Écrire les tests**

Dans `test/adapters/GameRecapView.test.js`, remplacer `fakeUi` par :

```js
function fakeUi(result) {
  const scripts = [];
  return {
    scripts,
    injectCSS() {},
    executeJS(js) { scripts.push(js); return Promise.resolve(typeof result === 'function' ? result(js) : result); },
  };
}
```

et ajouter à la fin :

```js
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
```

`test/adapters/summaryWatcher.test.js` :

```js
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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: échecs des nouveaux tests (langue ignorée, `refreshLocale` absent, `locale` absent du message).

- [ ] **Step 3: Implémenter**

`src/adapters/GameRecapView.js` : ajouter `resolveLocale` aux imports :

```js
const { renderPanel, renderFloating, resolveAvatarsJs, RECAP_CSS } = require('../presentation/recapHtml');
const { resolveLocale } = require('../presentation/i18n');

const LOCALE_SCRIPT = '(function () { try {'
  + " return (typeof I18n !== 'undefined' && I18n && I18n.locale) ? String(I18n.locale) : null;"
  + ' } catch (e) { return null; } })();';
```

et remplacer `createGameRecapView` par :

```js
function createGameRecapView(ui, logger) {
  ui.injectCSS(RECAP_CSS);
  let locale = 'en';

  function setLocale(value) {
    if (typeof value === 'string' && value.trim()) locale = resolveLocale(value);
  }

  function refreshLocale() {
    Promise.resolve(ui.executeJS(LOCALE_SCRIPT))
      .then(setLocale)
      .catch((e) => logger.error('refreshLocale', e));
  }

  function showFloating(recap) {
    Promise.resolve(ui.executeJS(floatingScript(renderFloating(recap, locale))))
      .catch((e) => logger.error('showFloating', e));
  }

  function showInSummary(recap, value) {
    setLocale(value);
    Promise.resolve(ui.executeJS(summaryScript(renderPanel(recap, locale))))
      .then((inserted) => { if (inserted !== true) showFloating(recap); })
      .catch((e) => { logger.error('showInSummary', e); showFloating(recap); });
  }

  return { showInSummary, showFloating, setLocale, refreshLocale };
}
```

`src/adapters/summaryWatcher.js`, dans `WATCH_SCRIPT`, remplacer la ligne
`plugins.send('match-impact', '${CHANNEL}', { showID: isFinite(showID) ? showID : null });`
par :

```js
      var locale = (typeof I18n !== 'undefined' && I18n && I18n.locale) ? String(I18n.locale) : null;
      plugins.send('match-impact', '${CHANNEL}', { showID: isFinite(showID) ? showID : null, locale: locale });
```

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/GameRecapView.js src/adapters/summaryWatcher.js test/adapters/GameRecapView.test.js test/adapters/summaryWatcher.test.js
git commit -m "feat: le panneau suit la langue du jeu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Page Match Impact — textes traduits et écran de réglages

**Files:**
- Modify: `src/adapters/historyPage.js`
- Test: `test/adapters/historyPage.test.js`

**Interfaces:**
- Consumes: `renderHistoryList(items, locale)`, `renderRecapBody(recap, locale)`, `renderHistoryPageShell()`, `renderSettingsForm(schema, values, locale)`, `resolveAvatarsJs`, `escapeHtml` (tâches 3-4) ; `t` (tâche 2) ; `SETTINGS_SCHEMA` (`application/ports`) ; `settingsEditor` (`getAll`, `set`, tâche 5).
- Produces: `createHistoryPage({ ui, ipc, queries, settingsEditor, logger })`. Handlers IPC : `page-texts(locale) → { settings, historyPick, loading }` ; `history-list-html(locale)` ; `recap-html(index, locale)` ; `settings-form-html(locale)` ; `settings-set(key, value) → { ok, value? }`.

- [ ] **Step 1: Écrire les tests**

Remplacer `test/adapters/historyPage.test.js` par :

```js
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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/adapters/historyPage.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: échecs (handlers absents, script sans `I18n.locale`).

- [ ] **Step 3: Implémenter**

Remplacer `src/adapters/historyPage.js` par :

```js
'use strict';
const {
  renderHistoryList, renderRecapBody, renderHistoryPageShell, renderSettingsForm, resolveAvatarsJs, escapeHtml,
} = require('../presentation/recapHtml');
const { t } = require('../presentation/i18n');
const { SETTINGS_SCHEMA } = require('../application/ports');

const PAGE_ID = 'matchImpactPage';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<path fill="currentColor" d="M64 64v384h416v-48H112V64H64zm96 256 96-112 80 64 128-144 32 32-160 176-80-64-64 80-32-32z"/></svg>';

// Script exécuté dans la fenêtre du jeu. Chaque appel transmet la langue du jeu (I18n.locale).
const PAGE_SCRIPT = `(function () { try {
  function locale() {
    try { return (typeof I18n !== 'undefined' && I18n && I18n.locale) ? String(I18n.locale) : null; } catch (e) { return null; }
  }
  function invoke() {
    return plugins.invoke.apply(plugins, ['match-impact'].concat(Array.prototype.slice.call(arguments)));
  }
  function bindSettings(form) {
    var status = form.querySelector('.mi-settings-status');
    var timer = null;
    function show(text, isError) {
      if (!status) return;
      if (timer) { clearTimeout(timer); timer = null; }
      status.textContent = text || '';
      status.classList.toggle('is-error', !!isError);
      if (!isError) timer = setTimeout(function () { status.textContent = ''; }, 2000);
    }
    form.addEventListener('change', function (event) {
      var input = event.target;
      var key = input && input.getAttribute ? input.getAttribute('data-mi-setting') : null;
      if (!key) return;
      var value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else {
        if (input.value === '') return;
        value = Number(input.value);
        if (!isFinite(value)) return;
      }
      invoke('settings-set', key, value, locale()).then(function (result) {
        if (result && result.ok) {
          if (input.type === 'checkbox') { input.checked = result.value; } else { input.value = result.value; }
          show(form.getAttribute('data-mi-saved'), false);
        } else {
          show(form.getAttribute('data-mi-error'), true);
        }
      }).catch(function (e) {
        console.error('[match-impact] réglage', e);
        show(form.getAttribute('data-mi-error'), true);
      });
    });
  }
  window.MatchImpactPage = {
    init: function () {
      var list = document.getElementById('mi-history-list');
      var detail = document.getElementById('mi-history-detail');
      var button = document.getElementById('mi-settings-button');
      if (!list || !detail) return;
      list.innerHTML = '<div class="loading mi-loading"></div>';
      invoke('page-texts', locale()).then(function (texts) {
        if (!texts) return;
        var label = button ? button.querySelector('.mi-settings-label') : null;
        if (label) label.textContent = texts.settings;
        var pick = detail.querySelector('.mi-history-pick');
        if (pick) pick.textContent = texts.historyPick;
        var loading = list.querySelector('.mi-loading');
        if (loading) loading.textContent = texts.loading;
      }).catch(function (e) { console.error('[match-impact] textes', e); });
      invoke('history-list-html', locale()).then(function (html) {
        list.innerHTML = html;
        list.onclick = function (event) {
          var item = event.target.closest('[data-mi-index]');
          if (!item) return;
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          if (button) button.classList.remove('active');
          item.classList.add('active');
          invoke('recap-html', Number(item.getAttribute('data-mi-index')), locale()).then(function (recapHtml) {
            detail.innerHTML = recapHtml;
            ${resolveAvatarsJs('detail')}
          }).catch(function (e) { console.error('[match-impact] récap', e); });
        };
      }).catch(function (e) { console.error('[match-impact] historique', e); });
      if (button) {
        button.onclick = function () {
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          button.classList.add('active');
          invoke('settings-form-html', locale()).then(function (formHtml) {
            detail.innerHTML = formHtml;
            var form = detail.querySelector('form.mi-settings');
            if (form) bindSettings(form);
          }).catch(function (e) { console.error('[match-impact] réglages', e); });
        };
      }
    }
  };
} catch (e) { console.error('[match-impact] page historique', e); } })();`;

const STOP_SCRIPT = "(function () { try { delete window.MatchImpactPage; } catch (e) {} })();";

function noResults(locale, key) {
  return `<div class="noResults">${escapeHtml(t(locale, key))}</div>`;
}

function createHistoryPage({ ui, ipc, queries, settingsEditor, logger }) {
  function start() {
    ipc.handle('page-texts', (event, locale) => ({
      settings: t(locale, 'settings'),
      historyPick: t(locale, 'historyPick'),
      loading: t(locale, 'loading'),
    }));
    ipc.handle('history-list-html', (event, locale) => renderHistoryList(queries.listHistory(), locale));
    ipc.handle('recap-html', (event, index, locale) => {
      try {
        const recap = queries.getRecap(index);
        return recap ? renderRecapBody(recap, locale) : noResults(locale, 'recapMissing');
      } catch (e) {
        logger.error('recap-html', e);
        return noResults(locale, 'recapUnreadable');
      }
    });
    ipc.handle('settings-form-html', (event, locale) => {
      try {
        return renderSettingsForm(SETTINGS_SCHEMA, settingsEditor.getAll(), locale);
      } catch (e) {
        logger.error('settings-form-html', e);
        return noResults(locale, 'settings.error');
      }
    });
    ipc.handle('settings-set', (event, key, value) => settingsEditor.set(key, value));
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

  function reinject() {
    Promise.resolve(ui.executeJS(PAGE_SCRIPT)).catch((e) => logger.error('historyPage.reinject', e));
  }

  return { start, stop, reinject };
}

module.exports = { createHistoryPage };
```

Note : `PAGE_SCRIPT` est un template string ; la seule interpolation autorisée est `${resolveAvatarsJs('detail')}`. Ne pas y écrire d'autre `${`.

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"`
Expected: tout passe, y compris `test/architecture.test.js` (l'adapter importe `presentation/*` et `application/ports`, autorisés).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/historyPage.js test/adapters/historyPage.test.js
git commit -m "feat: écran Réglages et textes traduits dans la page Match Impact

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Branchement, version 1.1.0 et README

**Files:**
- Modify: `index.js`
- Modify: `plugin.json`, `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `createSettingsEditor` (tâche 5), `view.refreshLocale()` (tâche 6), `createHistoryPage({ ..., settingsEditor })` (tâche 7).

- [ ] **Step 1: Brancher dans `index.js`**

- Après `const { createGameState } = require('./src/adapters/GameState');`, ajouter :
  `const { createSettingsEditor } = require('./src/application/SettingsEditor');`
- Après `const queries = createHistoryQueries({ history, logger });`, ajouter :
  `const settingsEditor = createSettingsEditor({ settings, logger });`
- Remplacer `const page = createHistoryPage({ ui: api.ui, ipc: api.ipc, queries, logger });` par :
  `const page = createHistoryPage({ ui: api.ui, ipc: api.ipc, queries, settingsEditor, logger });`
- Après `page.start();`, ajouter `view.refreshLocale();`
- Remplacer le corps de `reinject` par :

```js
    reinject = () => {
      view.refreshLocale();
      watcher.reinject();
      page.reinject();
    };
```

- [ ] **Step 2: Version et description**

`plugin.json` : `"version": "1.1.0"` et `"description": "End-of-show recap of each wrestler's stat changes, with history."`.
`package.json` : `"version": "1.1.0"`.

- [ ] **Step 3: README**

Dans `README.md` :
- après le paragraphe « Le plugin est en lecture seule… », ajouter :

```markdown
Le plugin s'affiche en français si le jeu est en français, et en anglais pour toutes les autres langues.
```

- remplacer la ligne de titre `## Réglages` et la ligne vide qui suit par :

```markdown
## Réglages

Les réglages se modifient dans la page **Match Impact** du menu latéral, bouton **⚙ Réglages** en haut de la liste. Chaque changement est enregistré tout de suite et s'applique dès le show suivant.

```

- dans la section `## État`, remplacer la ligne `- [x] Page Historique et réglages` par :

```markdown
- [x] Page Historique et écran de réglages
- [x] Anglais et français selon la langue du jeu (1.1.0)
```

- [ ] **Step 4: Vérifier**

Run: `npm test 2>&1 | grep -E "^not ok|^ℹ (pass|fail)"` puis `node -e "require('./index.js'); console.log('ok')"`
Expected: tout passe ; `ok` (le module se charge sans erreur de syntaxe).

- [ ] **Step 5: Commit**

```bash
git add index.js plugin.json package.json README.md
git commit -m "feat: version 1.1.0 (langue du jeu et écran de réglages)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Vérification en jeu (après le plan, avec l'utilisateur)

1. Jeu en français : panneau, historique et réglages en français. Jeu en anglais : tout en anglais, y compris les anciens shows.
2. Décocher « Talent », jouer un show : aucune stat de talent. Écart minimum à 5 : seuls les écarts d'au moins 5 apparaissent. Valeurs conservées après redémarrage.
