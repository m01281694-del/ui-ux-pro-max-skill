---
type: hub
tags:
  - hub
cssclasses:
  - dashboard
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Journal]] · [[Inbox]]

> [!focus] Focus du moment
> - **Priorité n°1 :**
> - **Projet phare :** [[ELM]]
> - **Ce que j'apprends :**
> - **Prochaine revue :**

## Projets actifs
```base
filters:
  and:
    - file.inFolder("06 Projets")
    - 'type == "projet"'
    - 'statut == "actif"'
views:
  - type: table
    name: Projets actifs
    order:
      - file.name
      - priorite
      - progression
      - echeance
      - prochaine_action
    sort:
      - property: echeance
        direction: ASC
```

## Inbox à traiter
```base
filters:
  and:
    - file.inFolder("01 Inbox")
    - 'file.name != "Inbox"'
views:
  - type: table
    name: À trier
    order:
      - file.name
      - file.ctime
    sort:
      - property: file.ctime
        direction: DESC
```

## Idées récentes
```base
filters:
  and:
    - file.inFolder("02 Idées")
    - 'type == "idee"'
views:
  - type: table
    name: 8 dernières idées
    limit: 8
    order:
      - file.name
      - statut
      - potentiel
      - domaine
    sort:
      - property: file.ctime
        direction: DESC
```

## Stratégies en cours
```base
filters:
  and:
    - file.inFolder("03 Stratégies")
    - 'type == "strategie"'
    - 'statut != "abandonnée"'
views:
  - type: table
    name: En cours
    order:
      - file.name
      - statut
      - horizon
      - domaine
```

## Lectures en cours
```base
filters:
  and:
    - file.inFolder("05 Lectures")
    - 'type == "lecture"'
    - 'statut == "en cours"'
views:
  - type: cards
    name: En cours
    order:
      - file.name
      - auteur
      - format
```

## Derniers apprentissages
```base
filters:
  and:
    - file.inFolder("04 Apprentissages")
    - 'type == "apprentissage"'
views:
  - type: table
    name: Récents
    limit: 8
    order:
      - file.name
      - statut
      - domaine
    sort:
      - property: file.ctime
        direction: DESC
```

## Concepts à développer
*Les notes `#etat/graine` que tu as touchées récemment : enrichis-les, puis passe-les en `#etat/en-croissance`.*
```base
filters:
  and:
    - file.inFolder("10 Connaissances")
    - 'type == "concept"'
    - file.hasTag("etat/graine")
views:
  - type: table
    name: Graines récentes
    limit: 10
    order:
      - file.name
      - domaine
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
```