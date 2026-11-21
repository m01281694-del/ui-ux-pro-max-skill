# Rapport qualité — Livre 001 · Réviser moins, retenir plus

*Date : 20/11/2026. Deux passes de contrôle : (1) automatique (`elm.py check` + `qualite.py`), (2) relecture humaine-simulée par l'IA, avec vérification des sources et des pages rendues.*

## Passe 1 — contrôles automatiques
- **Technique** (`rapport_technique.md`) : 0 défaut critique.
  - Pages 6×9 po, 82 pages paires, petit fond 0,375 po (≥ minimum KDP).
  - Polices TrueType incorporées.
  - Sommaire de 17 entrées numérotées.
  - Couverture 12,435 × 9,25 po exacte, Kindle 1600×2560 px.
  - DOCX et EPUB générés.
- **Rédactionnel** (`rapport_redactionnel.md`) : aucune faute d'orthographe détectée. Les mots signalés sont des termes anglais des références, des mots en « œ » non reconnus par le dictionnaire, ou des termes techniques valides. « faire faire » est correct.

## Passe 2 — relecture et corrections apportées
| Problème trouvé | Correction |
|---|---|
| Taille de l'étude de Cepeda imprécise (« plus de 250 comparaisons ») | Remplacée par les chiffres exacts de l'article : 317 expériences, 184 articles |
| Recommandation de sommeil sans source | Sourcée : consensus AASM 2016 (Paruthi et al.), ajouté aux références |
| Affirmation sur les « styles d'apprentissage » sans source | Sourcée : Pashler et al. (2008), ajouté aux références |
| Étude « Brain drain » (Ward 2017) présentée sans nuance | Nuance ajoutée : réplications mitigées |
| Étude Mueller & Oppenheimer (2014) | Nuancée par la réplication de Morehead et al. (2019) |
| Libellés « J0, J1… » mal rendus dans la courbe de l'oubli | SVG intégré dans la page (police correcte) |
| Guillemets français séparés de leur mot en fin de ligne | Espaces insécables automatiques (« », : ; ! ?) |
| Livre trop court (64 p.) | Ajout de contenu utile : exemple de semaine, FAQ, fiches de suivi → 82 p. |
| Polices variables converties en glyphes Type 3 | Instances statiques générées (texte réel, impression sûre) |
| Couverture sur 2 pages et largeur arrondie | Corrigées, dimension exacte vérifiée |

## Notation interne
| Critère | Note | Commentaire |
|---|---|---|
| Rédactionnel (orthographe, fluidité, structure) | 18/20 | Style clair et cohérent. Pourrait gagner en exemples par matière (édition 2). |
| Documentaire (exactitude, sources) | 19/20 | 23 références réelles. Chaque chiffre est sourcé, avec des nuances quand c'est nécessaire. |
| Pédagogique (progression, exercices) | 18/20 | Un exercice par chapitre, un plan de 30 jours et 10 fiches. |
| Graphique (couverture, illustrations) | 17/20 | Couverture lisible et cohérente, 6 schémas vectoriels. Pas de photo. |
| Technique (PDF, EPUB, dimensions) | 19/20 | Conforme aux règles KDP vérifiées. L'EPUB reste à valider dans Kindle Previewer (outil gratuit d'Amazon). |
| **Total** | **91/100** | **Validé** (objectif ≥ 90, aucun défaut critique) |

## Points de vigilance restants (non bloquants)
- Valider le rendu final dans le **Previewer KDP** (vérification humaine indispensable, elle se fait au moment du téléversement).
- Le texte du dos n'est pas imprimé (dos de 0,185 po, trop étroit pour un texte lisible). C'est un choix volontaire.
- Faire l'observation manuelle des concurrents (01_ETUDE_DE_MARCHE) pour confirmer le prix de 12,90 €.
