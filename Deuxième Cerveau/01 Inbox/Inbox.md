---
type: hub
tags:
  - hub
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Tableau de bord]]

> [!info] Le sas d'entrée
> Toute nouvelle note atterrit ici par défaut. **Capture vite, trie plus tard.**
> Une fois par semaine (voir [[Journal]] → revue hebdomadaire), traite chaque note :
> 1. **Supprimer** si elle n'a plus d'intérêt.
> 2. **Transformer** en [[Idées|idée]], [[Stratégies|stratégie]], [[Apprentissages|apprentissage]], [[Lectures|lecture]] ou concept.
> 3. **Relier** à au moins un domaine (`domaine`) et une note existante.
> 4. **Déplacer** dans le bon dossier.

Modèle conseillé : **Capture rapide**.

## À traiter
```base
filters:
  and:
    - file.inFolder("01 Inbox")
    - 'file.name != "Inbox"'
views:
  - type: table
    name: Inbox
    order:
      - file.name
      - file.ctime
    sort:
      - property: file.ctime
        direction: ASC
```