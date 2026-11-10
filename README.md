# Match Impact

Plugin pour **Pro Wrestling Sim** : après chaque segment (match ou angle) et à la fin de chaque show, il affiche les stats en hausse et en baisse pour chaque lutteur concerné (popularité régionale, momentum, moral, fatigue, endurance, talent, relations).

Le plugin est en lecture seule : il n'écrit jamais en base et ne modifie pas le jeu.

## Cahier des charges

Voir [docs/SPEC.md](docs/SPEC.md).

## Installation en développement (Windows)

La racine du dépôt est le dossier du plugin. Pour que le jeu le charge directement depuis le dépôt :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\Pro Wrestling Sim\plugins\match-impact" -Target "F:\Dev\MatchImpact"
```

## État

- [x] Cahier des charges, `plugin.json`
- [ ] Lecture du Plugin Developer Guide (`get_plugin_guide`) et du schéma (`describe_schema`)
- [ ] `index.js` : photo avant show, intercepteurs, récap par segment, récap de fin de show
- [ ] Page historique et réglages
- [ ] Validation (`validate_plugin`) et test sur un show d'au moins trois segments
