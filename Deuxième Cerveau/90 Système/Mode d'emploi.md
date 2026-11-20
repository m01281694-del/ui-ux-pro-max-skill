---
type: guide
tags:
  - systeme
cree: 2026-11-20
---

Retour : [[Accueil]] · [[Système de tags]] · [[Méthode du second cerveau]]

> [!info] En une phrase
> **Tout entre par l'[[Inbox]], tout se relie à un domaine, tout ce qui compte finit dans une note concept.**

## 1. Installation
1. Copie le dossier `Deuxième Cerveau` où tu veux (Documents, iCloud, Dropbox…).
2. Dans Obsidian : **Ouvrir un dossier comme coffre** → sélectionne ce dossier.
3. Si Obsidian demande d'activer les réglages du coffre, accepte : thème sombre, couleur d'accent, snippet CSS `deuxieme-cerveau`, couleurs du graphe, modèles et notes quotidiennes sont déjà configurés.
4. Vérifie dans **Réglages → Apparence → Extraits CSS** que `deuxieme-cerveau` est activé.
5. Épingle [[Accueil]] (déjà dans les **Signets**). Optionnel : le plugin communautaire *Homepage* pour l'ouvrir au démarrage.

Requis : Obsidian **1.9 ou plus récent** (pour les tableaux « Bases » intégrés). Aucun plugin communautaire n'est nécessaire.

## 2. Architecture
| Dossier | Rôle |
|---|---|
| `00 Accueil` | [[Accueil]], [[Tableau de bord]], cartes visuelles (`.canvas`) |
| `01 Inbox` | Capture brute — tout nouveau fichier arrive ici |
| `02 Idées` | Idées de business, de contenu, de projets |
| `03 Stratégies` | Plans d'action |
| `04 Apprentissages` | Leçons retenues |
| `05 Lectures` | Fiches de lecture et résumés |
| `06 Projets` | Suivi de projets ([[ELM]]…) |
| `07 Journal` | Notes quotidiennes et revues hebdomadaires |
| `10 Connaissances` | Le cœur : 9 domaines, chacun avec sa **carte** (MOC) et ses **concepts** |
| `90 Système` | Modèles, guides, pièces jointes |
| `99 Archives` | Ce qui est terminé ou inactif — on n'efface rien |

**Les dossiers rangent, les liens connectent.** Une note n'a qu'un dossier, mais autant de liens que nécessaire.

## 3. Le cycle de vie d'une connaissance
1. **Capturer** — une pensée, un lien, une citation → nouvelle note (elle tombe dans l'[[Inbox]]) ou ligne dans la note du jour.
2. **Organiser** — à la revue hebdo, applique un modèle, remplis `type`, `domaine`, tags, et déplace la note.
3. **Distiller** — reformule avec tes mots. Ajoute « Vient de / Mène à / Voir aussi ».
4. **Exprimer** — utilise la note dans un projet, une stratégie, un contenu.

## 4. Créer une note
- `Ctrl/Cmd + N` → nouvelle note (dans l'Inbox).
- `Ctrl/Cmd + P` → **Modèles : insérer un modèle** → choisis : Concept, Idée, Stratégie, Apprentissage, Lecture, Projet, Domaine, Capture rapide, Journal quotidien, Revue hebdomadaire.
- Tape `[[` pour lier une note existante. Lier vers une note qui n'existe pas encore est **normal** : c'est une graine que tu créeras plus tard (clic sur le lien).

## 5. Les règles qui font un vrai deuxième cerveau
1. **Une idée par note** (notes atomiques), avec un titre explicite.
2. **Jamais de note orpheline** : au moins un lien vers un domaine et une autre note.
3. **Tes mots, pas du copier-coller** : la reformulation, c'est la compréhension.
4. **Noms de notes** : en français, au singulier quand c'est un concept (« Tunnel de vente »), sans date sauf journal (`AAAA-MM-JJ`).
5. **Les concepts s'enrichissent** : `#etat/graine` → `#etat/en-croissance` → `#etat/persistante`.
6. **Mets à jour `maj`** quand tu enrichis une note importante.

## 6. Naviguer dans la cartographie
- **Vue graphe** (`Ctrl/Cmd + G`) : une couleur par domaine, les modèles et guides sont masqués.
- **Graphe local** d'une note : `Ctrl/Cmd + P` → « Ouvrir le graphe local » — idéal pour voir le voisinage d'un concept.
- **Cartes de domaine** : chaque domaine a un schéma cliquable et la liste de tes notes liées.
- **Canvas** : [[Cartographie.canvas|Carte des domaines]] et [[Chaîne de valeur.canvas|Chaîne de valeur]] — ajoute-y tes propres cartes.
- **Rétroliens** (panneau de droite) : qui cite la note ouverte. C'est là que naissent les connexions inattendues.

## 7. Rituels
| Quand | Quoi | Durée |
|---|---|---|
| Chaque jour | Note quotidienne : focus, captures, 1 apprentissage | 5 min |
| Chaque semaine | Revue hebdomadaire : vider l'Inbox, projets, 3 nouveaux liens | 30 min |
| Chaque mois | Relire une carte de domaine, promouvoir des graines, archiver | 45 min |

## 8. Ajouter un domaine
1. Crée un dossier `10 Connaissances/NN Nom du domaine`.
2. Crée la carte avec le modèle **Domaine** et ajoute-la à l'[[Accueil]].
3. Choisis un tag `#domaine/nom`, ajoute-le à [[Système de tags]] et un groupe de couleur dans la vue graphe (Réglages du graphe → Groupes).

## 9. Plugins communautaires (facultatifs)
- **Homepage** — ouvre l'Accueil au démarrage.
- **Calendar** — calendrier pour les notes quotidiennes.
- **Templater** — modèles plus puissants (si un jour tu en as besoin).
- **Excalidraw** — schémas dessinés à la main dans tes notes.
