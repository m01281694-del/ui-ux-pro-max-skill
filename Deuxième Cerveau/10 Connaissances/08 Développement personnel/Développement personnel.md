---
type: moc
tags:
  - moc
  - domaine/dev-perso
cssclasses:
  - moc
cree: 2026-11-20
maj: 2026-11-20
---

> [!moc] 08 · Développement personnel
> **Mission** — Devenir la meilleure version de moi-même, durablement.
> **Périmètre** — discipline, organisation, lecture, apprentissage, productivité.

Retour : [[Accueil]] · [[Tableau de bord]]

## Cartographie du domaine
*Clique sur un nœud pour ouvrir la note. Les flèches suivent le chemin logique « vient de → mène à ».*

```mermaid
flowchart LR
  n0["Objectifs"]
  n1["Discipline"]
  n2["Habitudes"]
  n3["Gestion du temps"]
  n4["Productivité"]
  n5["Organisation personnelle"]
  n6["Habitude de lecture"]
  n7["Méthodes d'apprentissage"]
  n8["Méthode du second cerveau"]
  n0 --> n2
  n0 --> n3
  n1 --> n2
  n2 --> n4
  n2 --> n6
  n3 --> n4
  n4 --> n5
  n5 --> n8
  n6 --> n7
  n7 --> n8
  class n0,n1,n2,n3,n4,n5,n6,n7,n8 internal-link;
```

## Concepts fondamentaux
- [[Objectifs]]
- [[Discipline]]
- [[Habitudes]]
- [[Gestion du temps]]
- [[Productivité]]
- [[Organisation personnelle]]
- [[Habitude de lecture]]
- [[Méthodes d'apprentissage]]
- [[Méthode du second cerveau]]
- *Nouveau concept ? Crée-le avec le modèle « Concept » et relie-le ici.*

## Ponts vers les autres domaines
- **[[Entrepreneuriat]]** — [[Objectifs]] ↔ [[Stratégie d'entreprise]]
- **[[Intelligence artificielle]]** — [[Productivité]] ↔ [[Automatisation]] · [[Productivité]] ↔ [[Outils IA]]
- **[[Finances]]** — [[Objectifs]] ↔ [[Gestion de budget]] · [[Objectifs]] ↔ [[Investissements]]
- **[[Technologie]]** — [[Méthodes d'apprentissage]] ↔ [[Programmation]]
- **[[Projets personnels]]** — [[Organisation personnelle]] ↔ [[Projets personnels]]

## Mes notes dans ce domaine
*Idées, stratégies, apprentissages, lectures et projets qui citent ce domaine ou portent le tag `#domaine/dev-perso`.*

```base
filters:
  and:
    - or:
        - file.hasLink(this.file)
        - file.hasTag("domaine/dev-perso")
    - not:
        - file.inFolder("90 Système")
views:
  - type: table
    name: Mes notes liées
    filters:
      and:
        - 'type != "concept"'
        - 'type != "moc"'
    groupBy:
      property: type
      direction: ASC
    order:
      - file.name
      - type
      - statut
      - maj
    sort:
      - property: file.mtime
        direction: DESC
  - type: table
    name: Concepts du domaine
    filters:
      and:
        - 'type == "concept"'
    order:
      - file.name
      - tags
      - maj
    sort:
      - property: file.name
        direction: ASC
```

## Questions directrices
*Les grandes questions que je veux résoudre dans ce domaine.*
-
