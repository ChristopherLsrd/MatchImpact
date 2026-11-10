# Match Impact — design

Date : 2026-11-10
Statut : validé en brainstorming, en attente de relecture
Source : `docs/SPEC.md` (cahier des charges initial). Ce document le remplace là où ils divergent.

## Objectif

Plugin pour Pro Wrestling Sim qui, à la fin de chaque show du joueur, affiche dans l'écran récapitulatif du jeu toutes les stats modifiées de chaque lutteur ayant participé : popularité régionale, momentum, moral, fatigue, endurance, stats de talent, relations entre partenaires et adversaires, blessures. Un historique des derniers shows est consultable depuis le menu latéral.

Le plugin est en lecture seule. Il n'écrit jamais en base, n'enregistre aucun intercepteur et ne modifie pas le comportement du jeu.

## Constats tirés du code du jeu

Ces faits ont été vérifiés dans le guide des plugins et dans `resources/app.asar` (`scripts/Booking.js`, `pages/bookingresults.html`). Ils expliquent les écarts avec le cahier des charges.

1. **Rien n'est écrit en base pendant le show.** Toutes les variations de stats d'un show sont accumulées en mémoire dans `Booking.changedWorkers`, puis écrites d'un coup par `Booking.updateChangedWorkersInDB()`, appelé depuis `Booking.showSummaryPage()`, c'est-à-dire quand l'écran récapitulatif de fin s'ouvre.
2. **`show:ended` arrive trop tard pour l'écran de fin.** Il n'est émis que dans `Booking.endShow()`, appelé par le bouton « End Show » qui *ferme* l'écran récapitulatif.
3. **`before:popularity-change` ne couvre que les matchs.** Les angles calculent leur popularité sans passer par l'intercepteur.
4. **Les stats de talent bougent pendant le show** (`Booking.changeWorkersStats` dans `calculateWorkerStatChanges`). Elles concernent les stats simples (`wrestlingSkill`, `entertainment`, `starPower`…) ou les stats détaillées (`brawling`, `technical`…) selon le mode de stats du monde (`StatResolver.isAdvanced()`).
5. **`show:started` n'est émis que par l'écran de booking du joueur** (`Booking.startShow`). Les shows des promotions IA ne le déclenchent pas.
6. **Écran de résultats** : page `#bookingResults`. L'écran de fin est `.bookingResultsFinalSummary` (masqué par `display:none` jusqu'à son ouverture). La colonne de droite est `.br-summary-side`, qui contient l'indicateur de popularité natif `.showPopGain`.
7. **Dossier des plugins sous Windows** : `%APPDATA%/ProWrestlingSimulator/plugins/` (et non `Pro Wrestling Sim`).
8. **Promotion du joueur** : `api.game.getState().promotionId`.

Conséquence : le récap porte sur l'ensemble du show (état avant / état après), pas sur chaque segment. Il n'y a pas de notification par segment (décision du brainstorming).

## Architecture

La racine du dépôt est le dossier du plugin.

```
plugin.json
index.js            point d'entrée : activate/deactivate, événements, IPC, réglages, UI
lib/stats.js        définition des stats suivies (colonne, libellé, groupe, sens)
lib/snapshot.js     requêtes SQL : photo des lutteurs, participants d'un show
lib/diff.js         comparaison de deux photos → récap (pur)
lib/render.js       récap → HTML (pur)
lib/history.js      lecture/écriture de l'historique borné (pur, storage injecté)
test/*.test.js      tests node --test de stats, diff, render, history
```

`diff`, `render` et `history` ne dépendent pas de l'objet `api` : `history` reçoit un objet `{ readJSON, writeJSON }`. `snapshot` reçoit une fonction `query(sql, params)`.

`plugin.json` reste celui du cahier des charges : permissions `events` et `database`, sans `database:write`.

## Flux de données

### 1. `show:started` → photo de départ

- Si `onlyMyPromotion` est actif et que `event.data.promotionID !== getState().promotionId`, le show est ignoré.
- Sinon, `snapshot.takeRoster(query, promotionID)` lit en une requête tous les lutteurs sous contrat actif avec la promotion (`contracts.promotionID = ? AND contracts.expired = 0`), avec les colonnes suivies de `workers` et `momentum`, `morale` du contrat.
- Puis une requête lit les relations entre ces lutteurs : `SELECT worker1, worker2, relationship FROM relationships WHERE worker1 IN (…) AND worker2 IN (…)`, paramètres `?` générés selon la taille de la liste.
- La photo est gardée en mémoire : `{ promotionID, showName, date, workers: Map<workerID, row>, relations: Map<"min-max", value> }`. Elle remplace toute photo précédente.

### 2. Détection de l'écran récapitulatif

- Dans `activate`, un script est injecté par `api.ui.executeJS`, enveloppé dans `try/catch`. Il crée un `MutationObserver` sur `#bookingResults .bookingResultsFinalSummary` (attribut `style`), stocké dans `window.__matchImpactObserver`.
- Si l'élément n'existe pas encore (page non chargée), le script observe `document.body` (`childList`, `subtree`) jusqu'à son apparition, puis se rattache à l'élément.
- Quand l'écran passe de masqué à visible, il appelle `plugins.send('match-impact', 'summary-shown', { showID })`. `showID` vaut `Booking.currentShow` si cette variable existe, sinon `null`.
- Les callbacks d'un `MutationObserver` s'exécutent après la fin de la fonction synchrone `showSummaryPage()`, donc après l'écriture en base. À vérifier lors du test réel.

### 3. `summary-shown` → récap

Le handler `api.ipc.on('summary-shown', …)` :

1. Il ne fait rien s'il n'y a pas de photo de départ, ou si le récap de ce show a déjà été produit.
2. Il détermine les participants :
   - si `showID` est fourni : `segments` (`showID = ?`, triés par `segmentorder`) jointe à `opponents`, en excluant les lutteurs au bord du ring (`opponentSet >= 0`, comme `endShow`) ;
   - sinon : le dernier show complet de la promotion, `SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID WHERE e.promotionID = ? AND i.complete = 1 ORDER BY i.instanceID DESC LIMIT 1` (`complete = 1` est écrit par `showSummaryPage` juste après les stats).
   - Résultat : la liste des segments dans l'ordre du card, avec pour chacun nom, type, note et lutteurs.
3. Il relit en base les mêmes colonnes pour les participants (une requête `WHERE workerID IN (…)`) et les relations entre participants d'un même segment.
4. Il appelle `diff.compute(before, after, segments, settings)`.
5. Si `showEndOfShowPanel` est actif, il injecte `render.panel(recap)` avec `api.ui.widgets.inject({ pageId: 'bookingResults', selector: '.br-summary-side', position: 'beforeend', wrapperClass: 'match-impact-panel' })`. Si `widgets.inject` ne fonctionne pas sur une page déjà affichée, il se replie sur `executeJS` avec un élément marqué `data-plugin-id="match-impact"`.
6. Il ajoute le récap à l'historique.

### 4. `show:ended` → filet de sécurité

- Si le récap de ce show existe déjà, le handler ne fait rien de plus. Sinon (détection ratée), il produit le récap à partir de `event.data.segments` et `event.data.showID`, l'enregistre dans l'historique et l'affiche dans un panneau flottant ouvrable et refermable (style `event-logger`).
- Dans tous les cas, la photo de départ est effacée.

## Stats suivies (`lib/stats.js`)

| Groupe (réglage) | Colonnes | Défaut |
|---|---|---|
| Popularité (`trackPopularity`) | `northAmericaPop`, `southAmericaPop`, `europePop`, `asiaPop`, `oceaniaPop`, `africaPop` | activé |
| Momentum et moral (`trackMomentumMorale`) | `contracts.momentum`, `contracts.morale` | activé |
| Forme (`trackCondition`) | `fatigue` (sens inversé), `stamina` | activé |
| Talent (`trackSkills`) | `wrestlingSkill`, `entertainment`, `starPower`, `psychology`, `charisma`, `brawling`, `technical`, `aerial`, `puroresu`, `acting`, `basics`, `consistency`, `athleticism`, `toughness`, `resilience` | activé |
| Relations (`trackRelationships`) | `relationships.relationship` entre lutteurs d'un même segment | activé |
| Blessures | `injuryType`, `injuryHealDate` : vides avant, renseignés après | toujours |

Chaque entrée de `stats.js` contient : `key`, `label` (libellé court affiché), `group`, `table` (`workers` ou `contracts`), `inverted` (true pour `fatigue`).

## Calcul des écarts (`lib/diff.js`)

`compute(before, after, segments, settings)` renvoie :

```js
{
  showName, date, promotionID, showID,
  segments: [{ name, type, rating }],
  workers: [{
    workerID, name,
    segments: [index, …],            // segments disputés, dans l'ordre du card
    changes: [{ key, label, before, after, delta, inverted }],
    injury: { type, healDate } | null
  }],
  relations: [{ worker1, name1, worker2, name2, before, after, delta }]
}
```

Règles :
- Une stat apparaît si son groupe est activé et si `|after - before| >= minDelta`. Une valeur `null` vaut 0 (le jeu remplace les popularités `NULL` par 0).
- Les valeurs sont arrondies à une décimale pour l'affichage. `delta` est calculé avant l'arrondi.
- Les lutteurs sont triés selon l'ordre du card de leur première apparition.
- Un lutteur présent dans les participants mais absent de la photo de départ (contrat signé pendant le show) est ignoré.
- Un lutteur sans aucun changement ni blessure figure quand même dans le récap, avec la mention « Aucun changement ».
- Les relations ne sont comparées qu'entre lutteurs d'un même segment, chaque paire une seule fois. Une paire absente avant et présente après a pour ancienne valeur 0 (relation neutre).

## Affichage (`lib/render.js`)

### Panneau de fin de show

- C'est un `div.panel` avec un titre « Match Impact » et un bouton pour replier ou déplier, puis un `div.panelContents` à hauteur maximale avec défilement.
- Une carte par lutteur : son nom, ses segments en sous-titre, puis une ligne par stat modifiée : `Entertainment   62.0 → 63.5   ▲ +1.5`.
- Une section « Relations » liste les paires modifiées : `A ↔ B   40 → 45   ▲ +5`.
- La couleur suit l'effet sur le lutteur : `var(--positive-effect)` pour une bonne nouvelle, `var(--negative-effect)` pour une mauvaise. Pour `fatigue`, une hausse est une mauvaise nouvelle. Une blessure s'affiche en badge `var(--alert)`.
- Le CSS injecté (`api.ui.injectCSS`) ne contient que de la mise en page et des variables du thème, sans couleur codée en dur. Toutes les classes sont préfixées `mi-`.
- Tout le texte issu de la base (noms, types de blessure) est échappé.

### Page Historique

- Elle est créée par `api.ui.addPage({ id: 'matchImpactPage', title: 'Match Impact', initFunction: 'MatchImpactPage' })` et `api.ui.addSideMenuItem({ pageId: 'matchImpactPage', label: 'Match Impact', section: 'bottom' })`.
- `window.MatchImpactPage.init()` appelle `plugins.invoke('match-impact', 'get-history')` pour récupérer la liste des récaps.
- La page utilise la mise en page `leftRightSplit` : à gauche la liste des shows (date, nom), à droite le récap du show choisi, avec le même rendu que le panneau. Pour éviter de dupliquer le rendu, le HTML est produit côté plugin : `plugins.invoke('match-impact', 'render-recap', index)` le renvoie.

## Historique (`lib/history.js`)

- Fichier `data/history.json` : un tableau de récaps, du plus récent au plus ancien.
- `add(storage, recap, max)` ajoute le récap en tête puis tronque à `max` éléments (`historySize`). `list(storage)` renvoie le tableau, ou `[]` si le fichier est absent ou corrompu.

## Réglages (`api.settings`)

| Clé | Type | Défaut |
|---|---|---|
| `showEndOfShowPanel` | boolean | true |
| `onlyMyPromotion` | boolean | true |
| `trackPopularity` | boolean | true |
| `trackMomentumMorale` | boolean | true |
| `trackCondition` | boolean | true |
| `trackSkills` | boolean | true |
| `trackRelationships` | boolean | true |
| `minDelta` | number (0–10) | 0.5 |
| `historySize` | number (1–100) | 20 |

Les réglages sont lus au moment du calcul, pas mis en cache.

## Erreurs et robustesse

- Chaque handler (`show:started`, `summary-shown`, `show:ended`, IPC) est entièrement entouré d'un `try/catch` qui journalise avec `api.console.error`. Une erreur du plugin ne remonte jamais au jeu.
- Chaque champ d'événement est vérifié avant usage.
- Toutes les requêtes utilisent des paramètres `?`, jamais de concaténation de valeurs.
- Le code injecté par `executeJS` est enveloppé dans `try/catch` côté fenêtre du jeu.
- Sans photo de départ (plugin activé en plein show), aucun récap n'est produit.

## Nettoyage (`deactivate`)

- Le plugin déconnecte `window.__matchImpactObserver` et supprime cette variable et `window.MatchImpactPage` via `executeJS`.
- Il appelle `api.ui.widgets.removeAll()` et retire les éléments `[data-plugin-id="match-impact"]`.
- Les événements, handlers IPC et le CSS injecté sont nettoyés automatiquement par le jeu.

## Tests

- **Tests automatiques** (`node --test`) :
  - `diff` : seuil `minDelta`, groupes désactivés, `null` traité comme 0, ordre du card, lutteur absent de la photo, blessure, relations entre lutteurs d'un même segment uniquement ;
  - `render` : échappement HTML, sens de couleur inversé pour la fatigue, mention « Aucun changement » ;
  - `history` : troncature, fichier absent ou corrompu.
- **Validation** : `validate_plugin` via MCP.
- **Test réel** sur un show d'au moins trois segments, dont un angle :
  - le panneau apparaît dans l'écran récapitulatif ;
  - les variations de popularité concordent avec l'indicateur natif et avec les valeurs relevées en base via MCP après le show ;
  - désactiver le plugin retire son interface sans redémarrer ;
  - l'historique survit à un redémarrage du jeu.

## Critères de réussite

1. Le plugin se charge sans erreur et passe `validate_plugin`.
2. Sur un show d'au moins trois segments, le panneau de fin de show liste les bonnes variations pour tous les participants, angles compris.
3. Les variations de popularité affichées correspondent à celles du jeu.
4. Désactiver le plugin retire toute son interface sans redémarrer le jeu.
5. L'historique survit à un redémarrage du jeu.

## Hors périmètre

- Notifications après chaque segment.
- Lecture des variables internes du jeu (`Booking.changedWorkers`), sauf `Booking.currentShow`, utilisé de façon optionnelle pour identifier le show.
- Shows des promotions IA (ils n'émettent pas `show:started`).
- Mode de popularité avancé par région fine (`workerRegionalPopularity`) : seules les 6 colonnes continentales sont suivies.
