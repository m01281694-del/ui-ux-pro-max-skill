---
type: guide
tags:
  - systeme
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Mode d'emploi]]

> [!info] Règle d'or
> **Propriétés** = ce qu'est la note (type, statut, dates). **Liens** = avec quoi elle est en relation. **Tags** = deux familles seulement, pour filtrer et colorer.
> Moins de tags, mieux choisis : c'est ce qui garde le système lisible pendant des années.

## 1. Domaine — `#domaine/…`
Chaque note porte **au moins un** tag de domaine. Il pilote la couleur dans la vue graphe et les listes des cartes de domaine.

| Tag | Domaine |
|---|---|
| `#domaine/entrepreneuriat` | [[Entrepreneuriat]] |
| `#domaine/marketing` | [[Marketing digital]] |
| `#domaine/ecommerce` | [[E-commerce]] |
| `#domaine/ia` | [[Intelligence artificielle]] |
| `#domaine/finances` | [[Finances]] |
| `#domaine/branding` | [[Branding]] |
| `#domaine/contenu` | [[Création de contenu]] |
| `#domaine/dev-perso` | [[Développement personnel]] |
| `#domaine/tech` | [[Technologie]] |
| `#domaine/projets` | [[Projets personnels]] |

## 2. Maturité — `#etat/…`
Inspiré du « digital garden » : une note grandit avec toi.

| Tag | Signification |
|---|---|
| `#etat/graine` | Note créée, peu ou pas remplie. |
| `#etat/en-croissance` | Contenu personnel, quelques liens, encore à affiner. |
| `#etat/persistante` | Note mûre, claire, reliée : une brique de référence. |

## 3. Tags libres — `#sujet/…` (optionnel)
Pour un thème transversal qui n'est pas un domaine (ex. `#sujet/psychologie`, `#sujet/negociation`). Avant d'en créer un, vérifie qu'il n'existe pas déjà (volet **Tags**).

## Tags structurels (posés par les modèles)
`#hub` (espaces) · `#moc` (cartes de domaine) · `#systeme` (guides) · `#journal` · `#revue`

## Propriétés standard

| Propriété | Valeurs | Utilisée par |
|---|---|---|
| `type` | `concept` · `idee` · `strategie` · `apprentissage` · `lecture` · `projet` · `journal` · `revue` · `moc` · `hub` | toutes |
| `domaine` | liens vers les cartes, ex. `"[[Marketing digital]]"` | toutes |
| `statut` | dépend du type (voir chaque espace) | idée, stratégie, apprentissage, lecture, projet |
| `cree` / `maj` | date `AAAA-MM-JJ` | toutes |
| `potentiel` | 1 à 5 | idée |
| `horizon` | `court` · `moyen` · `long` | stratégie |
| `source` | lien ou texte | apprentissage |
| `auteur`, `format`, `note`, `debut`, `fin` | — | lecture |
| `priorite`, `progression`, `echeance`, `prochaine_action` | — | projet |
