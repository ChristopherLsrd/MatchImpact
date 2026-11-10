# Match Impact

Plugin pour **Pro Wrestling Sim** : à la fin de chaque show, il affiche les stats en hausse et en baisse pour chaque lutteur qui a participé (popularité régionale, momentum, moral, fatigue, endurance, talent, relations).

Le récap porte sur l'ensemble du show : il compare l'état des lutteurs avant et après le show. Il n'y a pas de récap après chaque segment (match ou angle), car le jeu n'offre pas de point d'accroche fiable entre deux segments.

Le plugin est en lecture seule : il n'écrit jamais en base et ne modifie pas le jeu.

Le plugin s'affiche en français si le jeu est en français, et en anglais pour toutes les autres langues.

## Fonctionnement

- **Avant le show** (`show:started`) : le plugin prend une photo des stats de ton roster.
- **Écran de fin de show** : dès que l'écran récapitulatif s'ouvre, il relit les stats des participants et ajoute le panneau Match Impact dans la colonne de droite. Si cette colonne est introuvable, le récap s'affiche dans un panneau flottant que tu peux fermer.
- **Panneau** : une card par lutteur qui a au moins un changement ou une blessure. Chaque card montre l'avatar (photo du jeu, ou initiales), le nom, les segments du lutteur, puis une ligne par stat modifiée : pastille d'écart verte ou rouge, valeur avant → valeur après. Pour la fatigue, une hausse est une mauvaise nouvelle. Une card « Relations » liste les relations modifiées entre lutteurs d'un même segment.
- **Historique** : chaque récap est archivé dans `data/history.json`. La page « Match Impact » du menu latéral liste les derniers shows et réaffiche leur récap.

Seuls les shows que tu lances depuis ton écran de booking sont suivis : le jeu ne signale pas le début des shows des promotions IA.

## Réglages

Les réglages se modifient dans la page **Match Impact** du menu latéral, bouton **⚙ Réglages** en haut de la liste. Chaque changement est enregistré tout de suite et s'applique dès le show suivant.

| Réglage | Défaut | Rôle |
|---|---|---|
| Panneau de fin de show | activé | Affiche le récap dans l'écran de fin de show |
| Seulement ma promotion | activé | Ignore les shows des autres promotions |
| Popularité | activé | Popularité dans les six régions |
| Momentum et moral | activé | Momentum et moral du contrat |
| Fatigue et endurance | activé | Fatigue et endurance |
| Talent | activé | Stats de talent, simples ou détaillées selon le monde |
| Relations | activé | Relations entre lutteurs d'un même segment |
| Écart minimum | 0.5 | Les écarts plus petits sont masqués (0 à 10) |
| Shows conservés | 20 | Nombre de shows dans l'historique (1 à 100). Une valeur plus petite raccourcit l'historique au prochain show archivé. |

## Documentation

- Cahier des charges initial : [docs/SPEC.md](docs/SPEC.md) (il prévoyait aussi un récap par segment, abandonné pendant la conception)
- Design validé : [docs/superpowers/specs/2026-11-10-match-impact-design.md](docs/superpowers/specs/2026-11-10-match-impact-design.md)
- Logo pour le Steam Workshop : [assets/match-impact-logo.png](assets/match-impact-logo.png) (source SVG dans le même dossier)

## Développement

La racine du dépôt est le dossier du plugin. Le code suit la clean architecture : `src/domain` (règles métier pures), `src/application` (cas d'usage et ports), `src/presentation` (rendu HTML), `src/adapters` (jeu, base, stockage). Aucune dépendance externe.

Tests (Node 24) :

```powershell
npm test
```

Pour que le jeu charge le plugin directement depuis le dépôt (Windows) :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\ProWrestlingSimulator\plugins\match-impact" -Target "F:\Dev\MatchImpact"
```

## État

- [x] Cahier des charges, design et plan
- [x] Récap de fin de show, panneau en cards, photos des lutteurs
- [x] Page Historique et écran de réglages
- [x] Anglais et français selon la langue du jeu (1.1.0)
- [ ] Test complet en jeu : panneau, historique, désactivation, rechargement à chaud
