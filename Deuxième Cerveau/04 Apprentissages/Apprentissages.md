---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]] · [[Méthodes d'apprentissage]]

> [!info] Ce que j'ai compris
> Une note d'apprentissage = **une leçon formulée avec mes mots**, issue d'une lecture, d'une expérience, d'un échec ou d'une formation.
> Modèle : **Apprentissage**. `statut` : `nouveau` → `à consolider` → `maîtrisé`.
> Le meilleur apprentissage finit intégré dans une note concept de `10 Connaissances`.

```base
filters:
  and:
    - file.inFolder("04 Apprentissages")
    - 'type == "apprentissage"'
views:
  - type: table
    name: Tous
    order:
      - file.name
      - statut
      - source
      - domaine
      - cree
    sort:
      - property: file.ctime
        direction: DESC
  - type: table
    name: À consolider
    filters:
      and:
        - 'statut == "à consolider"'
    order:
      - file.name
      - domaine
```