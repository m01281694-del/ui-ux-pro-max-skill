---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]]

> [!info] Mes plans d'action
> Une stratégie répond à : **quel objectif, par quel levier, avec quelles actions, mesuré comment ?**
> Modèle : **Stratégie**. `statut` : `brouillon` → `en test` → `validée` · ou `abandonnée`.
> Une stratégie s'appuie toujours sur des concepts (ex. [[Tunnel de vente]], [[Positionnement]]) : relie-les.

```base
filters:
  and:
    - file.inFolder("03 Stratégies")
    - 'type == "strategie"'
views:
  - type: table
    name: Toutes les stratégies
    groupBy:
      property: statut
      direction: ASC
    order:
      - file.name
      - statut
      - horizon
      - domaine
      - projet
```