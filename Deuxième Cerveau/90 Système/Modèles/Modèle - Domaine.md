---
type: moc
tags:
  - moc
  - domaine/
cssclasses:
  - moc
cree: {{date}}
maj: {{date}}
---

> [!moc] {{title}}
> **Mission** —
> **Périmètre** —

Retour : [[Accueil]] · [[Tableau de bord]]

## Cartographie du domaine
```mermaid
flowchart LR
  a["Concept A"] --> b["Concept B"]
  class a,b internal-link;
```

## Concepts fondamentaux
-

## Ponts vers les autres domaines
-

## Mes notes dans ce domaine
```base
filters:
  and:
    - file.hasLink(this.file)
    - not:
        - file.inFolder("90 Système")
views:
  - type: table
    name: Notes liées
    order:
      - file.name
      - type
      - statut
      - maj
```

## Questions directrices
-
