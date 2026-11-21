# Documentation — ELM Publishing

## Organisation des dossiers
| Dossier | Contenu |
|---|---|
| 00_ADMINISTRATION | État du projet, guide de publication pour le titulaire du compte |
| 01_ETUDE_DE_MARCHE | Choix des niches, règles KDP vérifiées, grille d'observation des concurrents |
| 03/04/05_LIVRE_00X | Sources de chaque livre : `livre.json`, `manuscrit/*.md`, `illustrations/`, `couverture/cover.html`, `exports/` |
| 06_COUVERTURES | Aperçus des couvertures Kindle |
| 08_FICHIERS_KDP | **Fichiers finaux à téléverser**, un dossier par livre |
| 09_DESCRIPTIONS_AMAZON | Fiches KDP : titre, sous-titre, description HTML, 7 mots-clés, catégories, prix |
| 10_CONTROLES_QUALITE | Rapports technique, rédactionnel et qualité (/100) |
| 11_AUTOMATISATIONS | Moteur : `elm.py`, `qualite.py`, `render.js`, polices libres (OFL) |
| 12_FINANCES | Prix et redevances par livre, stratégie financière |
| 13_TABLEAU_DE_BORD | Suivi des livres, ventes et dépenses (CSV) + `tableau.py` |
| 15_LANCEMENT | Plans de promotion organique (10 vidéos par livre, calendrier) |

## Outils nécessaires (gratuits)
Python 3, pandoc, Node.js avec Playwright/Chromium, poppler-utils (pdftoppm), ImageMagick, et les paquets Python pypdf, fonttools, pyspellchecker.

## Commandes
```bash
cd ELM_PUBLISHING
python3 11_AUTOMATISATIONS/elm.py build 05_LIVRE_003   # intérieur PDF + DOCX + EPUB
python3 11_AUTOMATISATIONS/elm.py cover 05_LIVRE_003   # couverture brochée (PDF) + Kindle (JPG)
python3 11_AUTOMATISATIONS/elm.py check 05_LIVRE_003   # contrôle technique -> rapport_technique.md
python3 11_AUTOMATISATIONS/elm.py prix  05_LIVRE_003   # prix et redevances -> prix.md
python3 11_AUTOMATISATIONS/elm.py all   05_LIVRE_003   # tout, dans l'ordre
python3 11_AUTOMATISATIONS/qualite.py   05_LIVRE_003   # contrôle rédactionnel -> rapport_redactionnel.md
python3 13_TABLEAU_DE_BORD/tableau.py                  # régénère le tableau de bord
```

## Créer un nouveau livre
1. Copier un dossier de livre (par ex. `05_LIVRE_003`) en `16_LIVRE_004` et vider `manuscrit/`, `exports/`.
2. Modifier `livre.json` :
   - `titre`, `sous_titre`, `slug` ;
   - `format` (largeur/hauteur en pouces) ;
   - police, `taille_police`, `interligne`, couleurs ;
   - prix et `mentions_html`.
3. Écrire les chapitres dans `manuscrit/` en Markdown, numérotés (`00-…`, `01-…`). Chaque `# Titre` devient une entrée du sommaire.
   - Blocs utiles :
     - `::: exercice` (encadré) ;
     - `::: lignes` (lignes d'écriture) ;
     - `::: pagebreak` (saut de page).
   - Images : `![](../illustrations/x.svg)`.
4. Adapter `couverture/cover.html` (garder les variables `{{W}}`, `{{SPINE}}`, `{{KSCALE}}`, etc.).
5. Lancer `elm.py all`, puis `qualite.py`. Corriger jusqu'à **0 défaut critique** et regarder les pages rendues.
6. Écrire la fiche KDP, le rapport qualité (≥ 90/100), copier les fichiers dans `08_FICHIERS_KDP`, ajouter une ligne dans `13_TABLEAU_DE_BORD/livres.csv`.

## Règles éditoriales du projet
- Aucune statistique, citation, étude, référence ou témoignage inventé. Chaque fait chiffré renvoie à une source réelle. Les exemples fictifs sont annoncés comme tels.
- Aucune promesse de résultat.
- Contenu IA déclaré à KDP.
- Typographie française automatique (espaces insécables) via `fr_typo` dans `elm.py`.
