---
type: moc
tags:
  - moc
  - domaine/ia
cssclasses:
  - moc
cree: 2026-11-20
maj: 2026-11-20
---

> [!moc] 04 · Intelligence artificielle
> **Mission** — Démultiplier mon efficacité avec l'IA.
> **Périmètre** — Claude, ChatGPT, automatisation, outils IA, agents intelligents.

Retour : [[Accueil]] · [[Tableau de bord]]

## Cartographie du domaine
*Clique sur un nœud pour ouvrir la note. Les flèches suivent le chemin logique « vient de → mène à ».*

```mermaid
flowchart LR
  n0["Outils IA"]
  n1["Claude"]
  n2["ChatGPT"]
  n3["Prompt engineering"]
  n4["Automatisation"]
  n5["Agents IA"]
  n6["IA appliquée au business"]
  n0 --> n1
  n0 --> n2
  n0 --> n4
  n1 --> n3
  n2 --> n3
  n3 --> n5
  n4 --> n5
  n5 --> n6
  class n0,n1,n2,n3,n4,n5,n6 internal-link;
```

## Concepts fondamentaux
- [[Outils IA]]
- [[Claude]]
- [[ChatGPT]]
- [[Prompt engineering]]
- [[Automatisation]]
- [[Agents IA]]
- [[IA appliquée au business]]
- *Nouveau concept ? Crée-le avec le modèle « Concept » et relie-le ici.*

## Ponts vers les autres domaines
- **[[Entrepreneuriat]]** — [[Automatisation]] ↔ [[Croissance et scaling]] · [[IA appliquée au business]] ↔ [[Croissance et scaling]] · [[IA appliquée au business]] ↔ [[Stratégie d'entreprise]]
- **[[Marketing digital]]** — [[Automatisation]] ↔ [[Email marketing]] · [[ChatGPT]] ↔ [[Copywriting]] · [[Prompt engineering]] ↔ [[Copywriting]]
- **[[E-commerce]]** — [[Automatisation]] ↔ [[Logistique et livraison]]
- **[[Création de contenu]]** — [[IA appliquée au business]] ↔ [[Stratégie de contenu]] · [[Outils IA]] ↔ [[Montage vidéo]] · [[Outils IA]] ↔ [[MotionLab]] · [[Prompt engineering]] ↔ [[Script vidéo]]
- **[[Développement personnel]]** — [[Automatisation]] ↔ [[Productivité]] · [[Outils IA]] ↔ [[Productivité]]
- **[[Technologie]]** — [[Agents IA]] ↔ [[Programmation]] · [[Agents IA]] ↔ [[Python]] · [[Automatisation]] ↔ [[No-code]] · [[Automatisation]] ↔ [[Python]]

## Mes notes dans ce domaine
*Idées, stratégies, apprentissages, lectures et projets qui citent ce domaine ou portent le tag `#domaine/ia`.*

```base
filters:
  and:
    - or:
        - file.hasLink(this.file)
        - file.hasTag("domaine/ia")
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
