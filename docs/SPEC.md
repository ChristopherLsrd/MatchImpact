# Match Impact — cahier des charges du plugin

Plugin pour **Pro Wrestling Sim**. Après chaque segment (match ou angle), et à la fin de chaque show, il affiche un récapitulatif des stats qui ont augmenté ou baissé pour chaque lutteur concerné. Il reprend le principe de l'indicateur de popularité déjà affiché par le jeu, mais l'étend aux autres stats.

## Pour Claude Code : comment démarrer

1. Lis le **Plugin Developer Guide** du jeu avant d'écrire du code. Si le jeu est connecté à Claude Code (dans le jeu : *Settings > Connect an AI App*), utilise ses outils MCP :
   - `get_plugin_guide` pour le guide, section par section ;
   - `describe_schema` pour les colonnes exactes des tables ;
   - `validate_plugin` pour valider le plugin une fois écrit.
2. Inspire-toi de ces plugins d'exemple, livrés avec le jeu :

   | Plugin | Ce qu'il montre |
   |---|---|
   | `show-streak-tracker` | Notifications animées après un show |
   | `event-logger` | Panneau flottant |
   | `pop-dashboard` | Injection dans une page, réglages, snapshots |
   | `custom-page` | Page dédiée et entrée de menu |
   | `relationship-guardian` | Intercepteurs |

3. Dossier des plugins :
   - Windows : `%APPDATA%/Pro Wrestling Sim/plugins/`
   - macOS : `~/Library/Application Support/Pro Wrestling Sim/plugins/`
   - Linux : `~/.config/Pro Wrestling Sim/plugins/`
4. Le guide est la référence. Vérifie dedans tout point de ce document qui te semble incertain, et adapte-toi si le guide dit autre chose.

## Structure

```
match-impact/
  plugin.json
  index.js
  data/          (créé par api.storage)
```

`plugin.json` :

```json
{
  "id": "match-impact",
  "name": "Match Impact",
  "version": "1.0.0",
  "description": "Récap des stats en hausse et en baisse après chaque segment et chaque show.",
  "author": "",
  "main": "index.js",
  "permissions": ["events", "database"]
}
```

Aucune écriture en base n'est nécessaire : le plugin ne fait que lire. N'ajoute pas `database:write`.

## Fonctionnement

### 1. Photo avant le show (`show:started`)
- Charge depuis la base les stats suivies pour tous les lutteurs sous contrat actif avec la promotion du show (`event.data.promotionID`).
- Garde le résultat en mémoire, dans une table indexée par `workerID`.

### 2. Capture fine pendant le show (intercepteurs)
- `before:popularity-change` donne `workerID`, `workerName`, `region` (ex. `northAmericaPop`) et `popChange`. Accumule les variations par lutteur et par région dans un tampon du segment en cours.
- `before:relationship-change` donne `worker1`, `worker2` et `change`. Accumule les variations des relations entre participants.
- Les intercepteurs doivent être **synchrones** et **renvoyer `data` sans le modifier**. Le plugin observe seulement, il ne change jamais le jeu.

### 3. Récap par segment (`match:completed`)
- L'événement donne notamment :

  | Champ | Contenu |
  |---|---|
  | `segmentID`, `segmentType` | Identifiant et type (`Match` ou `Angle`) |
  | `rating`, `starRating` | Note du segment |
  | `workers` | Tableau d'équipes de `{ workerID, workerName }` |
  | `winner`, `winnerTeam` | Vainqueur |
  | `titlesOnLine`, `isMainEvent` | Titres en jeu, main event ou non |

- Construis le récap des participants à partir du tampon des intercepteurs, puis vide le tampon.
- **À vérifier en premier** : l'ordre réel des appels. Les changements de popularité tombent-ils avant le `match:completed` du même segment, ou seulement en fin de show ? Ajoute des logs temporaires et teste sur un show. Si les variations n'arrivent pas segment par segment, le récap par segment se limite à ce qui est disponible, et le détail complet passe dans le récap de fin de show.

### 4. Récap de fin de show (`show:ended`)
- Tout a alors été traité : notes, finances, titres, blessures.
- Relis les mêmes stats en base pour les lutteurs présents dans `event.data.segments[].workers`, puis compare avec la photo du `show:started`.
- Résultat : pour chaque lutteur, la liste des stats modifiées avec l'ancienne valeur, la nouvelle et l'écart.
- Ajoute les blessures survenues pendant le show : `workers.injuryType` et `injuryHealDate` vides avant, renseignés après.

## Stats suivies

À confirmer avec `describe_schema`. Colonnes relevées dans une sauvegarde actuelle :

**Table `workers` (clé `workerID`)**

| Groupe | Colonnes | Réglage |
|---|---|---|
| Popularité régionale | `northAmericaPop`, `southAmericaPop`, `europePop`, `asiaPop`, `oceaniaPop`, `africaPop` | Actif par défaut |
| Forme | `fatigue`, `stamina` | Actif par défaut |
| Talent | `wrestlingSkill`, `entertainment`, `starPower`, `psychology`, `charisma` | Désactivé par défaut |
| Talent détaillé | `brawling`, `technical`, `aerial`, `puroresu`, `acting`, `basics`, `consistency`, `athleticism`, `toughness`, `resilience` | Désactivé par défaut |

**Table `contracts` (contrat actif du lutteur avec la promotion du show)**
- `momentum`
- `morale`

**Relations** : variations captées par `before:relationship-change`, uniquement entre lutteurs du même segment.

Ignore les écarts sous un seuil réglable, pour éviter le bruit des arrondis sur les colonnes de type `real`.

## Affichage

### Après chaque segment
- Une notification compacte, dans le style de `show-streak-tracker`.
- Contenu : nom du segment et note, puis pour chaque participant ses principales variations, par exemple `▲ Pop NA +2 · ▲ Momentum +5 · ▼ Fatigue −8`.
- Vert pour une hausse, rouge pour une baisse. Le sens de lecture s'inverse pour la fatigue, où une hausse est une mauvaise nouvelle.

### En fin de show
- Un panneau récapitulatif, avec une section par segment dans l'ordre du card et un tableau par lutteur.
- Placement idéal : injecté avec `api.ui.widgets.inject` dans l'écran de résultats du show, à côté de l'indicateur de popularité existant. Le `pageId` et le sélecteur de cet écran sont inconnus pour l'instant. Trouve-les en inspectant le DOM du jeu (via `api.ui.executeJS` en développement, ou les fichiers du jeu). Si c'est impossible, utilise un panneau flottant ouvrable et refermable, comme dans `event-logger`.

### Historique
- Une page « Match Impact » dans le menu latéral (`api.ui.addPage` et `api.ui.addSideMenuItem`).
- Elle liste les N derniers shows avec leur récap, consultables a posteriori.
- Stockage dans `data/history.json` via `api.storage.writeJSON`, en ne gardant que les N derniers shows.

### Style
Suis le **UI Style Guide** du guide : variables CSS du thème, boutons, panneaux. N'utilise pas de couleurs codées en dur qui casseraient les skins du jeu.

## Réglages (`api.settings`)

| Clé | Type | Défaut | Rôle |
|---|---|---|---|
| `showSegmentToasts` | boolean | true | Notification après chaque segment |
| `showEndOfShowPanel` | boolean | true | Panneau de fin de show |
| `onlyMyPromotion` | boolean | true | Ignorer les shows des promotions IA (voir `api.game` pour identifier la promotion du joueur) |
| `trackPopularity` | boolean | true | Popularité régionale |
| `trackMomentumMorale` | boolean | true | Momentum et moral |
| `trackCondition` | boolean | true | Fatigue et endurance |
| `trackSkills` | boolean | false | Stats de talent |
| `trackRelationships` | boolean | false | Relations entre participants |
| `minDelta` | number | 0.5 | Écart minimum affiché |
| `historySize` | number | 20 | Nombre de shows conservés dans l'historique |

## Contraintes et bonnes pratiques

- Code défensif : vérifie que chaque champ d'événement existe, et entoure les requêtes SQL de `try/catch`. Une erreur du plugin ne doit jamais bloquer un show.
- Requêtes SQL avec des paramètres `?`, jamais par concaténation.
- Une requête groupée par show (`WHERE workerID IN (...)`), pas une requête par lutteur.
- Dans `deactivate()`, retire les intercepteurs, les écouteurs et tout ce qui a été créé via `executeJS` (ou marque ces éléments avec `data-plugin-id="match-impact"`).
- Aucune modification du jeu : les intercepteurs renvoient toujours `data` tel quel.

## Critères de réussite

1. Le plugin se charge sans erreur et passe `validate_plugin`.
2. Sur un show avec au moins trois segments :
   - une notification apparaît après chaque segment ;
   - le panneau de fin de show liste les bonnes variations.
3. Les variations de popularité affichées correspondent à celles de l'indicateur natif du jeu.
4. Désactiver le plugin retire toute son interface sans redémarrer le jeu.
5. L'historique survit à un redémarrage du jeu.

## Questions ouvertes à trancher pendant le développement

- Ordre réel entre `before:popularity-change` et `match:completed` (voir l'étape 3).
- `pageId` et sélecteur de l'écran de résultats du show, pour y injecter le panneau.
- Moyen fiable d'identifier la promotion du joueur (`api.game`).
