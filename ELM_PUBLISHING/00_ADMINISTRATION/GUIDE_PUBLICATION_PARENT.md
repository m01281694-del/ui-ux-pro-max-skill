# Guide de publication — pour le parent ou représentant légal titulaire du compte

L'auteur du projet est mineur. Le compte Amazon KDP doit être ouvert **au nom d'un adulte** (parent ou représentant légal), qui en est responsable. Cela inclut l'identité, les informations fiscales, le compte bancaire et les validations. Rien de tout cela n'a été fait automatiquement, et rien ne doit être contourné.

## Étape 1 — Créer le compte (≈ 30 min, une fois)
1. Aller sur **kdp.amazon.com** et se connecter avec un compte Amazon de l'adulte.
2. Remplir les **informations de compte** :
   - identité de l'adulte et adresse ;
   - **compte bancaire** pour recevoir les redevances ;
   - **questionnaire fiscal** (pour un résident français, Amazon guide le formulaire).
3. Vérifier son identité si KDP le demande.

## Étape 2 — Publier un livre broché (≈ 30 min par livre)
Tous les fichiers sont dans `ELM_PUBLISHING/08_FICHIERS_KDP/LIVRE_00X/` et les textes à copier dans `09_DESCRIPTIONS_AMAZON/LIVRE_00X_fiche_KDP.md`.
1. **+ Créer** → **Livre broché**.
2. **Détails** :
   - copier titre, sous-titre, auteur, description (HTML) et les 7 mots-clés ;
   - choisir les catégories proposées les plus proches ;
   - contenu pour adultes : NON.
3. **Contenu** :
   - ISBN gratuit KDP ;
   - impression noir et blanc, papier blanc ;
   - format indiqué sur la fiche ;
   - sans fond perdu ;
   - couverture brillante ;
   - téléverser `…_interieur_KDP.pdf` puis `…_couverture_brochee_KDP.pdf`.
4. Ouvrir le **Previewer** (aperçu en ligne) et parcourir toutes les pages. Corriger s'il signale un problème.
5. **Contenu généré par IA : répondre OUI** (texte et images), comme demandé par KDP.
6. **Tarification** : marketplace principale Amazon.fr, prix de la fiche (12,90 €).
7. Relire, puis **cliquer soi-même sur « Publier »**. Validation sous 72 h environ.

## Étape 3 — Publier la version Kindle
Même chose avec **+ Créer → eBook Kindle** : téléverser le `.epub` et la couverture `…_kindle.jpg`, choisir l'option 70 % et le prix de la fiche. Ne pas cocher KDP Select si l'on veut aussi vendre l'ebook ailleurs. Le cocher est possible, mais il engage à l'exclusivité pour 90 jours.

## Ensuite
- Chaque mois : **Rapports** → recopier ventes et redevances dans `13_TABLEAU_DE_BORD/ventes.csv`.
- Déclarer les revenus selon la situation fiscale (impots.gouv.fr, urssaf.fr).
- Toute dépense éventuelle doit être décidée par l'adulte titulaire.
