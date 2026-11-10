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
8. **Promotion du joueur** : `api.game.getState().promotionId` en priorité. Le jeu lit `saveInfo.promotionID`, colonne absente des sauvegardes réelles, donc cette valeur vaut `null` (constaté au premier test en jeu). L'adapter se replie alors sur `SELECT saveUserPromotion FROM saveInfo LIMIT 1`.

Conséquence : le récap porte sur l'ensemble du show (état avant / état après), pas sur chaque segment. Il n'y a pas de notification par segment (décision du brainstorming).

## Architecture (clean architecture)

La racine du dépôt est le dossier du plugin. Le code suit la clean architecture : des couches concentriques où **les dépendances pointent toujours vers l'intérieur**. Le métier ne connaît ni le jeu, ni SQL, ni le DOM, ni l'objet `api`.

```
plugin.json
package.json                       scripts : "test": "node --test" (aucune dépendance npm)
index.js                           racine de composition : seul fichier qui touche `api`
src/
  domain/                          entités et règles métier — pur, sans dépendance
    stats.js                       catalogue des stats suivies
    recap.js                       computeRecap(before, after, card, options) → Recap
    history.js                     addToHistory(list, recap, max) → nouvelle liste
  application/                     cas d'usage — ne dépendent que du domaine et des ports
    ports.js                       contrats des ports (JSDoc), fonctions d'assertion, SETTINGS_SCHEMA
    ShowTracker.js                 onShowStarted / onSummaryShown / onShowEnded
    HistoryQueries.js              listHistory() / getRecap(index)
  presentation/                    mise en forme — pur, dépend du domaine uniquement
    recapHtml.js                   Recap → HTML (panneau, page historique)
  adapters/                        implémentation des ports avec l'API du jeu
    SqlRosterReader.js             port RosterReader  ← api.database.query
    StorageHistoryStore.js         port HistoryStore  ← api.storage
    GameRecapView.js               port RecapView     ← api.ui (widgets, executeJS, injectCSS)
    GameSettings.js                port Settings      ← api.settings (+ déclaration du schéma)
    GameState.js                   port GameState     ← api.game.getState(), repli saveInfo.saveUserPromotion
    summaryWatcher.js              script renderer (MutationObserver) + écoute IPC
    historyPage.js                 page + entrée de menu + script renderer
test/
  domain/ application/ presentation/ adapters/   un fichier *.test.js par module
  fakes/                                         implémentations en mémoire des ports
  architecture.test.js                           vérifie la règle de dépendance
```

### Règle de dépendance

| Couche | Peut importer | Ne doit jamais importer |
|---|---|---|
| `domain` | rien en dehors de `domain` | `application`, `presentation`, `adapters`, `api`, `fs`, DOM |
| `application` | `domain` | `presentation`, `adapters`, `api` |
| `presentation` | `domain` | `application`, `adapters`, `api` |
| `adapters` | `domain`, `application/ports`, `presentation` | les autres adapters |
| `index.js` | tout | — |

Un test d'architecture (`test/architecture.test.js`) lit les `require(...)` de chaque fichier de `src/` et échoue si cette règle est violée.

### Ports (définis par l'application, implémentés par les adapters)

| Port | Méthodes | Adapter |
|---|---|---|
| `RosterReader` | `readRoster(promotionID)` → `{ workers, relations }` ; `readWorkers(ids, promotionID)` → `workers` ; `readRelations(ids)` → `relations` ; `readCard(showID)` → `card` ; `findLatestCompletedShow(promotionID, date)` → `showID` ou `null` | `SqlRosterReader` |
| `HistoryStore` | `load()` → `Recap[]` (tableau vide si absent ou corrompu) ; `save(list)` | `StorageHistoryStore` |
| `RecapView` | `showInSummary(recap)` ; `showFloating(recap)` | `GameRecapView` |
| `Settings` | `get(key)` (clés et défauts : `SETTINGS_SCHEMA`, exporté par `ports.js`) | `GameSettings` |
| `GameState` | `playerPromotionId()` | `GameState` |
| `Logger` | `log(...)` ; `error(...)` | `api.console` |

Les données échangées par les ports sont des objets simples du domaine (`WorkerRow`, `Relation`, `Card`, `Recap`), jamais des lignes SQL brutes ni des objets du jeu. `SqlRosterReader` est le seul module qui connaît les noms de tables et les jointures ; il obtient la liste des colonnes suivies auprès de `domain/stats.js`.

### Rôle de chaque couche

- **Domaine** : ce qu'est une stat suivie, comment on compare deux photos (seuil, sens inversé, blessure, relations d'un même segment, ordre du card), comment on borne l'historique. Fonctions pures et déterministes.
- **Application** : `ShowTracker` détient l'état du show en cours (photo de départ, récap déjà produit ou non) et orchestre : filtrer la promotion → photographier → à l'écran récap, relire, calculer, afficher, archiver → au `show:ended`, filet de sécurité puis remise à zéro. Toute erreur d'un port est attrapée et journalisée via `Logger`.
- **Présentation** : transforme un `Recap` en HTML (échappement, classes `mi-`, variables du thème). Aucune connaissance du jeu.
- **Adapters** : traduisent entre le monde du jeu et les ports, avec le moins de code possible et aucune règle métier.
- **Racine de composition** (`index.js`) : `activate(api)` instancie les adapters, les injecte dans les cas d'usage, branche `api.events` et `api.ipc` sur les méthodes de `ShowTracker` et `HistoryQueries`. `deactivate()` démonte tout.

### Chargement des modules

Le plugin tourne dans le processus principal (Node, CommonJS) : `index.js` charge `src/` par `require('./src/...')`. Au rechargement à chaud, le jeu vide le cache du module principal ; pour que les sous-modules soient eux aussi rechargés, `index.js` supprime au début d'`activate` les entrées de `require.cache` situées sous son dossier. À vérifier lors du test réel.

`plugin.json` reste celui du cahier des charges : permissions `events` et `database`, sans `database:write`.

## Flux de données

### 1. `show:started` → photo de départ

- Si `onlyMyPromotion` est actif et que `event.data.promotionID` diffère de la promotion du joueur (`GameState.playerPromotionId()`), le show est ignoré.
- Sinon, `ShowTracker.onShowStarted` appelle `RosterReader.readRoster(promotionID)`, qui lit en une requête tous les lutteurs sous contrat actif avec la promotion (`contracts.promotionID = ? AND contracts.expired = 0`), avec les colonnes suivies de `workers` et `momentum`, `morale` du contrat.
- Puis une seconde requête lit les relations entre ces lutteurs : `SELECT worker1, worker2, relationship FROM relationships WHERE worker1 IN (…) AND worker2 IN (…)`, paramètres `?` générés selon la taille de la liste.
- La photo est gardée en mémoire par `ShowTracker` : `{ promotionID, showName, date, workers: Map<workerID, row>, relations: Map<"min-max", value> }`. Elle remplace toute photo précédente.

### 2. Détection de l'écran récapitulatif

- Dans `activate`, l'adapter `summaryWatcher` injecte un script par `api.ui.executeJS`, enveloppé dans `try/catch`. Il crée un `MutationObserver` sur `document.body` (`childList`, `subtree`, `attributes` filtré sur `style`), stocké dans `window.__matchImpactObserver`. À chaque mutation, il relit `#bookingResults .bookingResultsFinalSummary` et compare son état visible à l'état précédent. Observer `body` plutôt que l'élément lui-même résiste au cas où le jeu recrée la page de résultats.
- Quand l'écran passe de masqué à visible, il supprime d'abord les éventuels `#bookingResults .mi-panel` (la page `#bookingResults` persiste toute la session : sans ce nettoyage, le panneau du show précédent resterait affiché sous le nouveau récap), puis il appelle `plugins.send('match-impact', 'summary-shown', { showID })`. `showID` vaut `Booking.currentShow` si cette variable existe, sinon `null`. Le canal IPC est `summary-shown`.
- Au rechargement du renderer, le jeu appelle l'export `onRendererLoad` du plugin : `index.js` le fait relancer les deux scripts injectés (observateur et définition de `MatchImpactPage`) par `reinject()` de `summaryWatcher` et `historyPage`, sans réenregistrer les handlers IPC.
- Les callbacks d'un `MutationObserver` s'exécutent après la fin de la fonction synchrone `showSummaryPage()`, donc après l'écriture en base. À vérifier lors du test réel.

### 3. `summary-shown` → récap

`summaryWatcher` reçoit `summary-shown` par `api.ipc.on` et appelle `ShowTracker.onSummaryShown(showID)`, qui :

1. Il ne fait rien s'il n'y a pas de photo de départ, ou si le récap de ce show a déjà été produit.
2. Il détermine les participants avec `RosterReader.readCard(showID)` (ou `findLatestCompletedShow` si `showID` est absent) :
   - si `showID` est fourni : `segments` (`showID = ?`) jointe à `opponents`, sans filtre sur `opponentSet`. Les participants qui ne combattent pas (`opponentSet = -1`, managers) sont donc inclus ; ils sont listés après les compétiteurs de leur segment : `ORDER BY s.segmentorder, s.segmentID, (o.opponentSet < 0), o.opponentSet, o.opponentID` (`opponentID` sert de départage stable, comme le `order by o.opponentSet, o.opponentID` du jeu) ;
   - sinon : le dernier show complet de la promotion à la date du show ou avant, `SELECT i.instanceID FROM eventinstance i JOIN events e ON e.eventID = i.eventID WHERE e.promotionID = ? AND i.complete = 1 AND i.airDate <= ? ORDER BY i.airDate DESC, i.instanceID DESC LIMIT 1` (`complete = 1` est écrit par `showSummaryPage` juste après les stats ; l'`instanceID` seul ne suffit pas, vérifié sur une sauvegarde réelle).
   - Résultat : la liste des segments dans l'ordre du card, avec pour chacun nom, type, note et lutteurs.
3. Il relit (`readWorkers(ids, promotionID)`, `readRelations(ids)`) les mêmes colonnes pour les participants (une requête `WHERE workerID IN (…)`) et les relations entre participants d'un même segment.
4. Il appelle `computeRecap(before, after, card, options)` du domaine, `options` étant lu dans `Settings`.
5. Si `showEndOfShowPanel` est actif, il appelle `RecapView.showInSummary(recap)`, **avant** l'archivage : un échec d'écriture de l'historique ne doit jamais masquer le panneau. L'adapter `GameRecapView` produit le HTML avec `presentation/recapHtml.js` et l'insère dans `#bookingResults .br-summary-side` par `api.ui.executeJS`, avec un élément marqué `data-plugin-id="match-impact"`. `widgets.inject` n'est pas utilisé : le guide ne dit pas s'il agit sur une page déjà affichée. Si la colonne est introuvable, le script renvoie `false` et l'adapter affiche le panneau flottant à la place.
6. Il archive : `HistoryStore.save(addToHistory(HistoryStore.load(), recap, historySize))`, dans son propre `try/catch` (erreur journalisée sous `archive`).

### 4. `show:ended` → filet de sécurité

- Si le récap de ce show existe déjà, le handler ne fait rien de plus. Sinon (détection ratée), il produit le récap à partir de `event.data.segments` et `event.data.showID`, appelle `RecapView.showFloating(recap)`, qui l'affiche dans un panneau flottant ouvrable et refermable (style `event-logger`), puis l'archive (même ordre : vue avant archivage).
- Dans tous les cas, la photo de départ est effacée.

## Stats suivies (`src/domain/stats.js`)

| Groupe (réglage) | Colonnes | Défaut |
|---|---|---|
| Popularité (`trackPopularity`) | `northAmericaPop`, `southAmericaPop`, `europePop`, `asiaPop`, `oceaniaPop`, `africaPop` | activé |
| Momentum et moral (`trackMomentumMorale`) | `contracts.momentum`, `contracts.morale` | activé |
| Forme (`trackCondition`) | `fatigue` (sens inversé), `stamina` | activé |
| Talent (`trackSkills`) | `wrestlingSkill`, `entertainment`, `starPower`, `psychology`, `charisma`, `brawling`, `technical`, `aerial`, `puroresu`, `acting`, `basics`, `consistency`, `athleticism`, `toughness`, `resilience` | activé |
| Relations (`trackRelationships`) | `relationships.relationship` entre lutteurs d'un même segment | activé |
| Blessures | `injuryType`, `injuryHealDate` : vides avant, renseignés après | toujours |

Chaque entrée du catalogue contient : `key`, `label` (libellé court affiché), `group`, `table` (`workers` ou `contracts`), `inverted` (true pour `fatigue`).

## Calcul des écarts (`src/domain/recap.js`)

`computeRecap(before, after, card, options)` renvoie un `Recap` :

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

## Affichage (`src/presentation/recapHtml.js`, `src/adapters/GameRecapView.js`, `src/adapters/historyPage.js`)

### Panneau de fin de show

- C'est un `div.panel` avec un titre « Match Impact » et un bouton pour replier ou déplier, puis un `div.panelContents` à hauteur maximale avec défilement.
- Une carte par lutteur : son nom, ses segments en sous-titre, puis une ligne par stat modifiée : `Entertainment   62.0 → 63.5   ▲ +1.5`.
- Une section « Relations » liste les paires modifiées : `A ↔ B   40 → 45   ▲ +5`. Dans le code actuel du jeu, les relations ne sont pas écrites pendant un show (seuls les événements aléatoires et les éditeurs les modifient) : cette section sera donc le plus souvent vide. Elle est conservée à la demande de l'utilisateur.
- La couleur suit l'effet sur le lutteur : `var(--positive-effect)` pour une bonne nouvelle, `var(--negative-effect)` pour une mauvaise. Pour `fatigue`, une hausse est une mauvaise nouvelle. Une blessure s'affiche en badge `var(--alert)`.
- Le CSS injecté (`api.ui.injectCSS`) ne contient que de la mise en page et des variables du thème, sans couleur codée en dur. Toutes les classes sont préfixées `mi-`.
- Tout le texte issu de la base (noms, types de blessure) est échappé.

### Page Historique

- Elle est créée par `api.ui.addPage({ id: 'matchImpactPage', title: 'Match Impact', backButton: 'mainOfficePage', initFunction: 'MatchImpactPage', html })` et `api.ui.addSideMenuItem({ pageId: 'matchImpactPage', label: 'Match Impact', section: 'bottom', svgIcon })`.
- `window.MatchImpactPage.init()` appelle `plugins.invoke('match-impact', 'history-list-html')` pour récupérer le HTML de la liste des récaps.
- La page utilise la mise en page `leftRightSplit` : à gauche la liste des shows (date, nom), à droite le récap du show choisi, avec le même rendu que le panneau. Pour éviter de dupliquer le rendu, le HTML est produit côté plugin : `plugins.invoke('match-impact', 'recap-html', index)` appelle `HistoryQueries.getRecap(index)` puis `recapHtml` ; une erreur de rendu renvoie « Récap illisible. » et est journalisée.

## Historique (`src/domain/history.js`, `src/adapters/StorageHistoryStore.js`)

- Fichier `data/history.json` : un tableau de récaps, du plus récent au plus ancien.
- Domaine : `addToHistory(list, recap, max)` renvoie une nouvelle liste avec le récap en tête, tronquée à `max` éléments (`historySize`). Aucune entrée/sortie.
- Adapter : `StorageHistoryStore.load()` lit le fichier et renvoie `[]` s'il est absent, corrompu ou n'est pas un tableau ; `save(list)` l'écrit avec `api.storage.writeJSON`.

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

- Chaque méthode publique de `ShowTracker` et `HistoryQueries`, et chaque handler branché dans `index.js`, est entièrement entouré d'un `try/catch` qui journalise avec `api.console.error`. Une erreur du plugin ne remonte jamais au jeu.
- Chaque champ d'événement est vérifié avant usage.
- Toutes les requêtes utilisent des paramètres `?`, jamais de concaténation de valeurs.
- Le code injecté par `executeJS` est enveloppé dans `try/catch` côté fenêtre du jeu.
- Sans photo de départ (plugin activé en plein show), aucun récap n'est produit.

## Nettoyage (`deactivate`)

- Le plugin déconnecte `window.__matchImpactObserver` et supprime cette variable et `window.MatchImpactPage` via `executeJS`.
- Il appelle `api.ui.widgets.removeAll()` et retire les éléments `[data-plugin-id="match-impact"]`.
- Les événements, handlers IPC et le CSS injecté sont nettoyés automatiquement par le jeu.

## Méthode de développement

### TDD : où et comment

Le cycle est **rouge → vert → refactor** : écrire un test qui échoue, vérifier qu'il échoue pour la bonne raison, écrire le code minimal qui le fait passer, puis nettoyer en gardant les tests verts. Dans les modules marqués « obligatoire », aucun code de production n'est écrit sans un test rouge qui le réclame.

| Module | TDD | Ce que couvrent les tests |
|---|---|---|
| `domain/stats.js` | obligatoire | groupes et colonnes du catalogue, `inverted` sur `fatigue` uniquement, colonnes conformes au schéma relevé |
| `domain/recap.js` | obligatoire | photos factices ; au moins un test par règle de la section « Calcul des écarts » |
| `domain/history.js` | obligatoire | ajout en tête, troncature, liste d'entrée non modifiée |
| `application/ShowTracker.js` | obligatoire | faux ports en mémoire : filtre de promotion, photo, récap à l'écran de fin, pas de doublon avec `show:ended`, filet de sécurité, remise à zéro, absence de photo, erreur d'un port attrapée et journalisée, réglage `showEndOfShowPanel` |
| `application/HistoryQueries.js` | obligatoire | faux `HistoryStore` : liste, index hors limites |
| `presentation/recapHtml.js` | obligatoire | échappement HTML, sens de couleur inversé pour la fatigue, badge blessure, mention « Aucun changement », section relations, aucune couleur codée en dur |
| `adapters/StorageHistoryStore.js` | obligatoire | faux `api.storage` : fichier absent, JSON invalide, valeur qui n'est pas un tableau |
| `adapters/SqlRosterReader.js` | obligatoire pour la construction des requêtes et le mapping | fausse fonction `query` qui enregistre SQL et paramètres : autant de `?` que d'ids, aucune valeur concaténée, une seule requête par lecture groupée, lignes converties en objets du domaine, liste d'ids vide sans requête. Le SQL est en plus exécuté sur une vraie sauvegarde via l'outil MCP `query` |
| `adapters/GameSettings.js`, `adapters/GameState.js` | tests simples après coup | faux `api` |
| `adapters/GameRecapView.js`, `summaryWatcher.js`, `historyPage.js` | non : code d'interface mince | test réel dans le jeu ; leur HTML vient de `presentation`, déjà testée |
| `index.js` | non : racine de composition | `validate_plugin` et test réel |
| règle de dépendance | test d'architecture | `test/architecture.test.js` |

Les faux ports (`test/fakes/`) suivent exactement les contrats de `application/ports.js`. `ports.js` exporte des fonctions d'assertion de forme, utilisées à la fois par les tests des fakes et par ceux des adapters, pour que faux et vrais adapters ne divergent pas.

### Outils et conventions

- Tests avec `node:test` et `node:assert/strict`, lancés par `npm test` (`node --test`). Aucune dépendance npm.
- CommonJS (`require` / `module.exports`), comme l'attend le chargeur de plugins du jeu.
- Un module, une responsabilité ; un fichier de test par module, nommé comme lui.
- Commits petits et fréquents : chaque cycle vert peut donner lieu à un commit.

### Vérifications hors tests automatiques

- **Validation** : `validate_plugin` via MCP.
- **SQL** : chaque requête de `SqlRosterReader` exécutée via l'outil MCP `query` sur une sauvegarde réelle.
- **Test réel** sur un show d'au moins trois segments, dont un angle :
  - le panneau apparaît dans l'écran récapitulatif ;
  - les variations de popularité concordent avec l'indicateur natif et avec les valeurs relevées en base via MCP après le show ;
  - désactiver le plugin retire son interface sans redémarrer ;
  - le rechargement à chaud recharge aussi les modules de `src/` ;
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
