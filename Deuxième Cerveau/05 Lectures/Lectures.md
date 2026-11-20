---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]] · [[Habitude de lecture]]

> [!info] Ma bibliothèque
> Livres, articles, vidéos, podcasts, formations. Modèle : **Lecture**.
> `statut` : `à lire` → `en cours` → `terminé`. `note` de 1 à 5.
> Après chaque lecture : **3 idées clés**, **1 action**, et des liens vers les concepts concernés.

```base
filters:
  and:
    - file.inFolder("05 Lectures")
    - 'type == "lecture"'
views:
  - type: cards
    name: Bibliothèque
    order:
      - file.name
      - auteur
      - statut
      - note
  - type: table
    name: En cours
    filters:
      and:
        - 'statut == "en cours"'
    order:
      - file.name
      - auteur
      - format
  - type: table
    name: À lire
    filters:
      and:
        - 'statut == "à lire"'
    order:
      - file.name
      - auteur
      - format
      - domaine
  - type: table
    name: Terminées
    filters:
      and:
        - 'statut == "terminé"'
    order:
      - file.name
      - auteur
      - note
      - fin
    sort:
      - property: note
        direction: DESC
```