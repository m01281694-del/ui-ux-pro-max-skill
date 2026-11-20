---
type: moc
tags:
  - moc
  - domaine/marketing
cssclasses:
  - moc
cree: 2026-11-20
maj: 2026-11-20
---

> [!moc] 02 · Marketing digital
> **Mission** — Attirer, convaincre et convertir des clients.
> **Périmètre** — acquisition, publicité, copywriting, tunnels de vente, psychologie du consommateur.

Retour : [[Accueil]] · [[Tableau de bord]]

## Cartographie du domaine
*Clique sur un nœud pour ouvrir la note. Les flèches suivent le chemin logique « vient de → mène à ».*

```mermaid
flowchart LR
  n0["Persona client"]
  n1["Psychologie du consommateur"]
  n2["Copywriting"]
  n3["Acquisition"]
  n4["Publicité"]
  n5["SEO"]
  n6["Email marketing"]
  n7["Tunnel de vente"]
  n8["Conversion"]
  n0 --> n1
  n1 --> n2
  n2 --> n4
  n2 --> n7
  n3 --> n4
  n3 --> n5
  n3 --> n6
  n4 --> n7
  n5 --> n8
  n6 --> n8
  n7 --> n8
  class n0,n1,n2,n3,n4,n5,n6,n7,n8 internal-link;
```

## Concepts fondamentaux
- [[Persona client]]
- [[Psychologie du consommateur]]
- [[Copywriting]]
- [[Acquisition]]
- [[Publicité]]
- [[SEO]]
- [[Email marketing]]
- [[Tunnel de vente]]
- [[Conversion]]
- *Nouveau concept ? Crée-le avec le modèle « Concept » et relie-le ici.*

## Ponts vers les autres domaines
- **[[Entrepreneuriat]]** — [[Acquisition]] ↔ [[Croissance et scaling]] · [[Copywriting]] ↔ [[Proposition de valeur]] · [[Persona client]] ↔ [[Proposition de valeur]] · [[Persona client]] ↔ [[Étude de marché]]
- **[[E-commerce]]** — [[Conversion]] ↔ [[Expérience client]] · [[Conversion]] ↔ [[Optimisation de boutique]] · [[Copywriting]] ↔ [[Fiche produit]] · [[Email marketing]] ↔ [[Fidélisation client]]
- **[[Intelligence artificielle]]** — [[Copywriting]] ↔ [[ChatGPT]] · [[Copywriting]] ↔ [[Prompt engineering]] · [[Email marketing]] ↔ [[Automatisation]]
- **[[Finances]]** — [[Conversion]] ↔ [[Chiffre d'affaires]] · [[Publicité]] ↔ [[Gestion de budget]]
- **[[Branding]]** — [[Copywriting]] ↔ [[Storytelling]] · [[Copywriting]] ↔ [[Ton de marque]] · [[Persona client]] ↔ [[Positionnement]] · [[Psychologie du consommateur]] ↔ [[Storytelling]]
- **[[Création de contenu]]** — [[Acquisition]] ↔ [[Instagram]] · [[Acquisition]] ↔ [[Stratégie de contenu]] · [[Acquisition]] ↔ [[TikTok]] · [[Acquisition]] ↔ [[YouTube]]
- **[[Technologie]]** — [[SEO]] ↔ [[Création de sites internet]] · [[Tunnel de vente]] ↔ [[Création de sites internet]]

## Mes notes dans ce domaine
*Idées, stratégies, apprentissages, lectures et projets qui citent ce domaine ou portent le tag `#domaine/marketing`.*

```base
filters:
  and:
    - or:
        - file.hasLink(this.file)
        - file.hasTag("domaine/marketing")
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
