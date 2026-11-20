---
type: moc
tags:
  - moc
  - domaine/projets
cssclasses:
  - moc
cree: 2026-11-20
maj: 2026-11-20
---

> [!moc] 10 · Projets personnels
> **Mission** — Transformer mes connaissances en réalisations concrètes.
> **Périmètre** — [[ELM]] et mes futurs projets.

Retour : [[Accueil]] · [[Tableau de bord]]

> [!info] Système de suivi
> Un projet = une note dans `06 Projets`, créée avec le modèle **Projet**.
> `statut` : `idée` → `planifié` → `actif` → `en pause` → `terminé`
> `priorite` : `haute` · `moyenne` · `basse` — `progression` : 0 à 100 — `echeance` : date.
> Un projet terminé part dans `99 Archives`.

## Tous les projets
```base
filters:
  and:
    - file.inFolder("06 Projets")
    - 'type == "projet"'
views:
  - type: table
    name: Pipeline
    groupBy:
      property: statut
      direction: ASC
    order:
      - file.name
      - statut
      - priorite
      - progression
      - echeance
      - prochaine_action
  - type: cards
    name: Cartes
    order:
      - file.name
      - statut
      - progression
```

## Connaissances mobilisées
*Les projets sont l'endroit où tous les domaines se rencontrent :*
[[Entrepreneuriat]] · [[Marketing digital]] · [[E-commerce]] · [[Intelligence artificielle]] · [[Finances]] · [[Branding]] · [[Création de contenu]] · [[Développement personnel]] · [[Technologie]]

## Idées de futurs projets
*Les idées validées dans [[Idées]] deviennent des projets ici.*
-
