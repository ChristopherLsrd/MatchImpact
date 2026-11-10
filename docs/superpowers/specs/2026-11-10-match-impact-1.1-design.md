# Match Impact 1.1.0 — langue du jeu et écran de réglages

Complète la spec 1.0 (`2026-11-10-match-impact-design.md`), qui reste valable pour tout ce qui n'est pas décrit ici.

## Objectifs

1. Le panneau, l'historique, les noms des stats, les messages et l'écran de réglages s'affichent en français si la langue du jeu est le français, sinon en anglais.
2. La page Match Impact propose un écran « Réglages » qui modifie les réglages du plugin sans toucher à aucun fichier.

## Constats (code du jeu)

1. La langue du jeu est `I18n.locale` dans la fenêtre du jeu (`scripts/i18n.js`) : un code BCP-47 court (`'en'`, `'fr'`, `'de'`…), `'en'` par défaut.
2. Le jeu n'a aucun écran pour les réglages des plugins : `plugins.getAllSettings` / `setSetting` existent dans `preload.js` mais ne sont appelés nulle part. Les valeurs sont stockées dans `<plugin>/data/_settings.json`.
3. `api.settings.register(schema)` garde les valeurs déjà enregistrées et ne complète que les clés absentes. `api.settings.set(key, value)` enregistre la valeur sur disque.
4. `ShowTracker` relit les réglages à chaque show : une modification s'applique au show suivant sans redémarrage.

## Langue

### Choix de la langue

`resolveLocale(code)` (dans `src/presentation/i18n.js`) renvoie `'fr'` si `code` est une chaîne qui commence par `fr` (insensible à la casse : `fr`, `fr-FR`, `FR`), sinon `'en'` (y compris pour `undefined`, `null`, `''`, `'de'`).

### Dictionnaires

`src/presentation/i18n.js` exporte :

- `resolveLocale(code)` ;
- `t(locale, key, params?)` : renvoie le texte de la clé dans la langue résolue, avec remplacement des `{param}`. Une clé absente renvoie la clé elle-même (jamais d'exception) ;
- `statLabel(locale, statKey)` : libellé d'une stat ; une stat inconnue renvoie sa clé ;
- `MESSAGES` : `{ en: {…}, fr: {…} }`, mêmes clés dans les deux langues.

Libellés des stats :

| Clé | en | fr |
|---|---|---|
| northAmericaPop | Pop N. America | Pop Am. Nord |
| southAmericaPop | Pop S. America | Pop Am. Sud |
| europePop | Pop Europe | Pop Europe |
| asiaPop | Pop Asia | Pop Asie |
| oceaniaPop | Pop Oceania | Pop Océanie |
| africaPop | Pop Africa | Pop Afrique |
| momentum | Momentum | Momentum |
| morale | Morale | Moral |
| fatigue | Fatigue | Fatigue |
| stamina | Stamina | Endurance |
| wrestlingSkill | Wrestling | Wrestling |
| entertainment | Entertainment | Divertissement |
| starPower | Star power | Star power |
| psychology | Psychology | Psychologie |
| charisma | Charisma | Charisme |
| brawling | Brawling | Bagarre |
| technical | Technical | Technique |
| aerial | Aerial | Aérien |
| puroresu | Puroresu | Puroresu |
| acting | Acting | Jeu d'acteur |
| basics | Basics | Bases |
| consistency | Consistency | Régularité |
| athleticism | Athleticism | Athlétisme |
| toughness | Toughness | Robustesse |
| resilience | Resilience | Résilience |

Messages (clé : en / fr) :

| Clé | en | fr |
|---|---|---|
| wrestlers.one | {n} wrestler | {n} catcheur |
| wrestlers.many | {n} wrestlers | {n} catcheurs |
| collapse | Collapse | Replier |
| close | Close | Fermer |
| photoOf | Photo of {name} | Photo de {name} |
| injury | Injury | Blessure |
| injuryReturn | {type} (back {date}) | {type} (retour {date}) |
| relations | Relationships | Relations |
| noChange | No notable change during this show. | Aucun changement notable pendant ce show. |
| historyEmpty | No show recorded yet. | Aucun show enregistré pour l'instant. |
| historyPick | Pick a show from the list. | Choisis un show dans la liste. |
| loading | Loading… | Chargement… |
| recapMissing | Recap not found. | Récap introuvable. |
| recapUnreadable | Recap could not be read. | Récap illisible. |
| settings | Settings | Réglages |
| settings.tracked | Tracked stats | Stats suivies |
| settings.display | Display | Affichage |
| settings.saved | Saved | Enregistré |
| settings.error | Could not save | Échec de l'enregistrement |
| settings.nextShow | Changes apply from the next show. | Les changements s'appliquent dès le show suivant. |

Plus, pour chaque réglage de `SETTINGS_SCHEMA`, `setting.<key>.label` et `setting.<key>.help` :

| Réglage | label en / fr | help en / fr |
|---|---|---|
| trackPopularity | Popularity / Popularité | Popularity in the six regions / Popularité dans les six régions |
| trackMomentumMorale | Momentum and morale / Momentum et moral | Contract momentum and morale / Momentum et moral du contrat |
| trackCondition | Fatigue and stamina / Fatigue et endurance | — / — (texte vide) |
| trackSkills | Skills / Talent | Simple or detailed, depending on the world / Simples ou détaillées selon le monde |
| trackRelationships | Relationships / Relations | Between wrestlers of the same segment / Entre lutteurs d'un même segment |
| showEndOfShowPanel | End-of-show panel / Panneau de fin de show | Show the recap on the results screen / Affiche le récap dans l'écran de fin de show |
| onlyMyPromotion | Only my promotion / Seulement ma promotion | Ignore other promotions' shows / Ignore les shows des autres promotions |
| minDelta | Minimum change / Écart minimum | Smaller changes are hidden (0–10) / Les écarts plus petits sont masqués (0 à 10) |
| historySize | Shows kept / Shows conservés | Number of shows in the history (1–100) / Nombre de shows dans l'historique (1 à 100) |

### Domaine

- `STATS` (`src/domain/stats.js`) perd le champ `label` : le domaine ne connaît que les clés.
- `computeRecap` ne produit plus `label` dans `changes` : `{ key, before, after, delta, inverted }`.
- Les récaps déjà archivés gardent leur `label` français ; le rendu l'ignore et utilise `statLabel(locale, key)`. Les anciens shows suivent donc la langue du jeu.

### Rendu

Toutes les fonctions de rendu prennent la langue en dernier paramètre, résolue par `resolveLocale` (une valeur absente donne l'anglais) :

- `renderRecapBody(recap, locale)`, `renderPanel(recap, locale)`, `renderFloating(recap, locale)` ;
- `renderHistoryList(items, locale)` ;
- `renderHistoryPageShell()` : coquille sans texte, le texte est rempli par le script de page (voir plus bas) ;
- `renderSettingsForm(schema, values, locale)` (nouveau).

Le `lang` de la section (`<section class="mi-panel" lang="fr">`, `<div class="mi-recap" lang="fr">`) indique la langue du rendu.

### Transmission de la langue

- **Écran de fin de show** : le script de surveillance ajoute `locale: I18n.locale` (ou `null` si `I18n` est absent) au message `summary-shown`. `ShowTracker.onSummaryShown(payload)` passe `payload.locale` à `view.showInSummary(recap, locale)`.
- **Panneau flottant** (`show:ended`, processus principal) : `view.showFloating(recap)` utilise la dernière langue connue de la vue. La vue la met à jour à chaque `showInSummary(recap, locale)` avec une langue non vide, et par `view.setLocale(locale)`.
- **Démarrage** : `index.js` lit `I18n.locale` par `api.ui.executeJS` à l'activation et dans `onRendererLoad`, puis appelle `view.setLocale`. En cas d'échec, la vue reste en anglais.
- **Page Match Impact** : le script de page lit `I18n.locale` à chaque appel et l'envoie avec chaque `plugins.invoke` (`history-list-html`, `recap-html`, `settings-form-html`, `settings-set`, `page-texts`).

Le port `RecapView` devient `showInSummary(recap, locale)`, `showFloating(recap)`, `setLocale(locale)`.

### Manifeste

La description de `plugin.json` passe en anglais : « End-of-show recap of each wrestler's stat changes, with history. » La version passe à `1.1.0` (aussi dans `package.json`). Les `label` / `description` de `SETTINGS_SCHEMA` (enregistrés auprès du jeu, qui ne les affiche nulle part) passent en anglais.

## Écran de réglages

### Page

La colonne de gauche de la page Match Impact commence par un bouton `⚙ Réglages` (`button.mi-settings-button`, libellé traduit), suivi de la liste des shows. Un clic :

1. retire la sélection de la liste des shows et marque le bouton actif ;
2. appelle `plugins.invoke('match-impact', 'settings-form-html', locale)` et place le HTML renvoyé dans la zone de droite.

Cliquer sur un show réaffiche son récap, comme aujourd'hui, et retire l'état actif du bouton.

Les textes de la coquille (bouton, message « Choisis un show », « Chargement… ») viennent de `plugins.invoke('match-impact', 'page-texts', locale)`, qui renvoie `{ settings, historyPick, loading }`. Le script de page les applique à l'ouverture de la page.

### Formulaire

`renderSettingsForm(schema, values, locale)` renvoie `<form class="mi-settings" lang="…">` avec :

- un bloc « Stats suivies » : une case à cocher par réglage `trackPopularity`, `trackMomentumMorale`, `trackCondition`, `trackSkills`, `trackRelationships` ;
- un bloc « Affichage » : cases `showEndOfShowPanel`, `onlyMyPromotion`, puis champs nombre `minDelta` (`step=0.1`) et `historySize` (`step=1`) ;
- sous chaque champ, son texte d'aide s'il n'est pas vide ;
- en bas, la mention « Les changements s'appliquent dès le show suivant. » et une zone d'état `.mi-settings-status` (vide au départ, `aria-live="polite"`).

Chaque champ porte `name="<clé>"` et `data-mi-setting="<clé>"`. `schema` est `SETTINGS_SCHEMA`, passé par l'adapter. Les valeurs affichées sont celles de `values` ; une valeur absente prend le `default` du schéma. Les bornes `min` / `max` des champs nombre viennent aussi du schéma. Tout le texte est échappé. Le style reprend les tokens `--mi-*` (fond `--mi-card`, bordure `--mi-border`, texte `--mi-text-2`, aide `--mi-muted`), sans style en ligne.

### Enregistrement

- Le script de page écoute `change` sur le formulaire. Pour une case : valeur `checked` ; pour un nombre : `Number(value)`, ignoré si le champ est vide ou non numérique.
- Il appelle `plugins.invoke('match-impact', 'settings-set', key, value, locale)`, qui renvoie `{ ok: true, value }` ou `{ ok: false }`.
- Si `ok`, le champ reprend `value` (valeur éventuellement ramenée dans les bornes) et la zone d'état affiche « Enregistré » pendant 2 secondes. Sinon elle affiche « Échec de l'enregistrement ».

### Cas d'usage `SettingsEditor` (`src/application/SettingsEditor.js`)

`createSettingsEditor({ settings, logger })` :

- `getAll()` → `{ clé: valeur }` pour toutes les clés de `SETTINGS_SCHEMA` (via `settings.get`, qui applique déjà les défauts) ;
- `set(key, value)` → `{ ok: true, value }` ou `{ ok: false }` :
  - clé absente de `SETTINGS_SCHEMA` : `{ ok: false }` ;
  - `boolean` : la valeur doit être `true` ou `false`, sinon `{ ok: false }` ;
  - `number` : la valeur doit être un nombre fini, sinon `{ ok: false }` ; elle est ramenée dans `[min, max]` ; `historySize` est arrondi à l'entier ;
  - une exception de `settings.set` est journalisée et donne `{ ok: false }`.

Le port `Settings` devient `get(key)`, `set(key, value)` ; `GameSettings.set` appelle `api.settings.set`.

### Effets

- Les réglages sont relus à chaque show : un changement s'applique au show suivant.
- Réduire `historySize` ne supprime rien sur le moment : l'historique est raccourci au prochain archivage (comportement actuel de `addToHistory`).
- Décocher « Panneau de fin de show » n'efface pas l'historique : les récaps continuent d'être archivés.

## Architecture

- `src/presentation/i18n.js` : dictionnaires et choix de la langue. Ne dépend de rien.
- `src/presentation/recapHtml.js` : utilise `i18n.js` ; nouvelle fonction `renderSettingsForm`. La règle de dépendance interdit à la présentation d'importer `application/ports` : le schéma des réglages lui est passé en paramètre par `historyPage`.
- `src/application/SettingsEditor.js` : nouveau cas d'usage.
- `src/adapters/historyPage.js` : nouveaux handlers `settings-form-html`, `settings-set`, `page-texts` ; reçoit `settingsEditor` en dépendance.
- `src/adapters/GameRecapView.js` : mémorise la langue, `setLocale`.
- `src/adapters/summaryWatcher.js` : ajoute `locale` au message.
- `index.js` : crée `SettingsEditor`, lit la langue au démarrage et dans `onRendererLoad`.

La règle de dépendance (`test/support/dependencyRule.js`) est inchangée et doit continuer de passer.

## Tests

| Module | Cas |
|---|---|
| `presentation/i18n.js` | `resolveLocale` (`fr`, `fr-FR`, `FR`, `de`, `en`, `''`, `null`, `undefined`) ; mêmes clés en `en` et `fr` ; chaque clé de `STATS` a un libellé dans les deux langues ; chaque clé de `SETTINGS_SCHEMA` a `label` et `help` dans les deux langues ; `t` remplace les paramètres ; clé inconnue renvoie la clé |
| `presentation/recapHtml.js` | rendu anglais et français (compteur, blessure, relations, message vide, libellés des stats depuis la clé en ignorant un `label` archivé, `lang`) ; langue absente = anglais ; formulaire : champs, valeurs, défauts, bornes, échappement, aucun style en ligne |
| `application/SettingsEditor.js` | `getAll` ; booléen valide / invalide ; nombre ramené dans les bornes ; `historySize` arrondi ; clé inconnue ; nombre non fini ; exception de `settings.set` |
| `application/ShowTracker.js` | `onSummaryShown` passe `payload.locale` à la vue |
| `domain/recap.js`, `domain/stats.js` | plus de `label` |
| `adapters/GameRecapView.js` | langue mémorisée pour le panneau flottant ; `setLocale` ; scripts valides |
| `adapters/historyPage.js` | script de page valide ; handlers `settings-form-html`, `settings-set`, `page-texts`, langue transmise aux rendus |
| `adapters/summaryWatcher.js` | le script envoie `locale` et reste du JavaScript valide |
| `adapters/GameSettings.js` | `set` appelle `api.settings.set` |

## Vérification en jeu

1. Jeu en français : panneau, historique et réglages en français. Jeu en anglais (ou autre langue) : tout en anglais, y compris les anciens shows de l'historique.
2. Réglages : décocher « Talent », jouer un show : aucune stat de talent. Mettre l'écart minimum à 5 : seuls les écarts d'au moins 5 apparaissent. Les valeurs sont conservées après redémarrage du jeu.
