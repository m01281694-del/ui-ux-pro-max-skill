---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]]

> [!info] Mon incubateur
> Une idée = une note. Modèle : **Idée**. Cycle de vie (`statut`) :
> `brute` → `à explorer` → `en test` → `validée` (→ devient un projet ou une stratégie) · ou `abandonnée`
> Évalue le `potentiel` de 1 à 5 et relie chaque idée à ses domaines.

```base
filters:
  and:
    - file.inFolder("02 Idées")
    - 'type == "idee"'
views:
  - type: table
    name: Toutes les idées
    order:
      - file.name
      - statut
      - potentiel
      - domaine
      - cree
    sort:
      - property: potentiel
        direction: DESC
  - type: table
    name: À explorer
    filters:
      and:
        - 'statut == "à explorer"'
    order:
      - file.name
      - potentiel
      - domaine
  - type: cards
    name: Galerie
    order:
      - file.name
      - statut
      - potentiel
```