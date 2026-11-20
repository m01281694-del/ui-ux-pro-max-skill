---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]]

> [!info] Rituels
> - **Chaque jour** — ouvre la note du jour (icône calendrier dans la barre latérale, ou `Ctrl/Cmd + P` → « Ouvrir la note quotidienne »). Elle est créée dans `07 Journal/Quotidien`.
> - **Chaque semaine** — crée une revue avec le modèle **Revue hebdomadaire** dans `07 Journal/Hebdomadaire` : vide l'[[Inbox]], mets à jour les [[Projets personnels|projets]], relie tes notes.

## Notes quotidiennes
```base
filters:
  and:
    - file.inFolder("07 Journal/Quotidien")
views:
  - type: table
    name: 14 derniers jours
    limit: 14
    order:
      - file.name
      - humeur
      - energie
    sort:
      - property: file.name
        direction: DESC
```

## Revues hebdomadaires
```base
filters:
  and:
    - file.inFolder("07 Journal/Hebdomadaire")
views:
  - type: table
    name: Revues
    order:
      - file.name
      - cree
    sort:
      - property: file.name
        direction: DESC
```