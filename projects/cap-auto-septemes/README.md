# CAP AUTO SEPTÈMES — site web

Site techniquement complet : design, animations, pages, catalogue, formulaires, consentement cookies, SEO et déploiement Vercel.
**Le contenu commercial est volontairement vide.** Aucun slogan, véhicule, photo, coordonnée ou information juridique n'a été inventé.

> Un site techniquement terminé n'est pas un site prêt à être présenté au public. Tant que `publication.ready` vaut `false`, le site reste en **prévisualisation** : repères « À PERSONNALISER » visibles, bandeau de prévisualisation, `noindex` partout, `robots.txt` qui bloque l'indexation.

---

## 1. Où modifier quoi

| Je veux modifier… | Fichier |
|---|---|
| Textes, coordonnées, horaires, réseaux sociaux, vidéo d'intro, SEO, infos juridiques, cookies, formulaires | `content/site.js` |
| Véhicules | `content/vehicles.js` (ou l'outil `/admin/`) |
| Photos | `assets/images/` (voir `assets/images/README.md`) |
| Vidéos | `assets/video/` (voir `assets/video/README.md`) |
| Couleurs, polices, espacements | `assets/css/main.css` → bloc `:root` en haut du fichier |
| Textes des pages juridiques | `mentions-legales.html`, `confidentialite.html`, `cookies.html` (paragraphes marqués « À RÉDIGER / À COMPLÉTER ») |

Aucune reconstruction n'est nécessaire : le site lit ces fichiers au chargement. Modifiez, enregistrez, rechargez la page.

## 2. Voir le site sur votre ordinateur

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent. Aucune installation de dépendance.

```bash
cd projects/cap-auto-septemes
npm run dev        # http://localhost:3000  — outil véhicules : http://localhost:3000/admin/
npm run check      # liste ce qu'il reste à compléter avant publication
npm run build      # génère dist/ (ce que Vercel publiera)
npm run preview    # build + http://localhost:4000
```

## 3. Gérer les véhicules

**Avec l'outil** : `npm run dev`, ouvrez `http://localhost:3000/admin/`, créez/modifiez les fiches, puis **Exporter vehicles.js** et remplacez `content/vehicles.js` par le fichier téléchargé. L'outil fonctionne uniquement en local et n'est jamais publié (exclu de `dist/`).

**À la main** : copiez le modèle de fiche décrit en tête de `content/vehicles.js`.

Statuts : `disponible`, `reserve` (badge « Réservé »), `vendu` (grisé, masqué par défaut du catalogue, non indexé). `featured: true` met un véhicule en avant sur l'accueil.
Les filtres du catalogue (marques, modèles, carrosseries, énergies, boîtes, prix, km, année) se construisent automatiquement à partir des fiches.

## 4. Fonctionnalités en place

- **Accueil** : vidéo d'introduction plein écran (passer / pause / son / progression, sortie en rideau, une fois par visite), héro vidéo ou photo avec contrôle pause, bandeau d'atouts défilant, sélection de véhicules, services, présentation, chiffres clés, avis, coordonnées + horaires (statut « ouvert / fermé » calculé à l'heure de Paris), carte, appel à l'action.
- **Catalogue** : recherche, filtres, tri, filtres actifs supprimables, pagination, filtres conservés dans l'adresse (partage / retour arrière), tiroir de filtres sur mobile.
- **Fiche véhicule** : galerie + visionneuse plein écran (clavier, glissement tactile), caractéristiques, équipements, vidéo, formulaire de demande pré-rempli, véhicules similaires, données structurées `Car`.
- **Animations** : apparitions au défilement, titres mot par mot, parallaxe, boutons magnétiques, cartes 3D, transitions de page, barre de progression. Toutes désactivées si le visiteur demande à réduire les animations.
- **Accessibilité** : lien d'évitement, navigation clavier, focus visible, fenêtres modales avec piège de focus, messages d'erreur reliés aux champs, contrastes AA.
- **Polices auto-hébergées** (aucun appel à Google Fonts — pas de transfert de données sans consentement).

## 5. Formulaires

Tant que `forms.endpoint` est vide, **aucun message n'est envoyé** et le visiteur voit : « Votre message n'a pas été envoyé. L'envoi en ligne n'est pas encore disponible » (avec téléphone/e-mail si renseignés). Aucun faux message de réussite.

Pour activer l'envoi, deux options :

1. **Fonction Vercel fournie** (`api/contact.js`, via le service e-mail Resend) : dans Vercel → *Settings → Environment Variables*, ajoutez `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (expéditeur vérifié chez Resend) et, facultatif, `ALLOWED_ORIGIN`. Puis `forms.endpoint: "/api/contact"`.
2. **Service tiers** acceptant du JSON (Formspree, Web3Forms…) : mettez son URL dans `forms.endpoint`.

Protection anti-spam incluse (champ piège, délai minimal, limitation par IP côté fonction). Pensez à mettre à jour la politique de confidentialité avec le prestataire choisi.

## 6. Cookies et consentement

Aucun traceur non essentiel n'est actif. Le bandeau n'apparaît **que** si un service soumis à consentement est déclaré (`cookies.services`) ou si une carte est intégrée (`dealer.map_embed_url`, chargée seulement après accord).
« Tout accepter », « Tout refuser » et « Personnaliser » ont le même poids visuel ; le choix est conservé 6 mois (réglable) ; « Gérer mes cookies » en pied de page permet de le modifier. Incrémentez `cookies.policy_version` pour redemander le consentement.

Exemple de déclaration (à adapter, ne rien ajouter sans besoin réel) :
```js
services: [
  { id: "mesure", name: "Nom de l'outil", category: "mesure", provider: "Éditeur", purpose: "Mesure d'audience", duration: "13 mois", script_src: "https://…" }
]
```

## 7. Référencement

- Titres/descriptions par page : `seo.pages`. Description par défaut : `seo.default_description`. Image de partage : `seo.og_image`.
- `npm run build` inscrit ces balises directement dans le HTML, génère `sitemap.xml` (pages + véhicules non vendus) et `robots.txt`.
- Données structurées `AutoDealer` et `Car` générées **uniquement** avec les champs réellement remplis, et seulement en mode publication.

## 8. Publier sur Vercel (quand vous le déciderez)

Rien n'a été publié et aucun domaine n'a été connecté.

1. Sur vercel.com : *Add New → Project*, importez ce dépôt GitHub.
2. **Root Directory** : `projects/cap-auto-septemes`. Le reste est lu depuis `vercel.json` (build `node scripts/build.mjs`, sortie `dist/`, URL sans `.html`, en-têtes de sécurité).
3. Tant que `publication.ready` est `false`, l'adresse Vercel affiche une prévisualisation non indexée — utile pour relire.
4. Pour passer en ligne : complétez tout, `npm run check` sans erreur, mettez `publication.ready: true` et `site.url`. **Le build refuse de compiler** si des informations obligatoires (coordonnées, horaires, mentions légales, formulaire, etc.) manquent.
5. Le domaine se connecte ensuite dans Vercel → *Settings → Domains*, sur votre décision.

## 9. Structure

```
content/          site.js (tout le contenu), vehicles.js (catalogue)
assets/css/       main.css (design system complet)
assets/js/        core (contenu, en-tête, pied, SEO) · intro · consent · forms
                  vehicles-lib · catalogue · vehicle · pages · animations
assets/fonts/     Syncopate + Manrope (licence OFL)
assets/images/    vos photos (+ favicon neutre)
assets/video/     vos vidéos
admin/            outil local de gestion des véhicules + contrôles (non publié)
api/contact.js    fonction Vercel d'envoi des formulaires
scripts/          dev server, check, build
*.html            accueil, véhicules, fiche, à propos, contact, mentions légales,
                  confidentialité, cookies, 404
```

## 10. À faire valider avant publication

Les pages juridiques fournissent une **structure**, pas un avis juridique. Faites vérifier par un professionnel : mentions légales, politique de confidentialité (finalités, bases légales, durées, destinataires, transferts hors UE), médiateur de la consommation, mentions d'affichage des prix et, le cas échéant, d'intermédiation en crédit (ORIAS). L'adresse de l'hébergeur Vercel pré-remplie est à vérifier.

## 11. Données remplies à partir de recherches en ligne (19/11/2026) — À VÉRIFIER

| Donnée | Valeur | Source |
|---|---|---|
| Société | CAP AUTO MARSEILLE, SARL au capital de 1 000 €, SIREN 108 879 529, TVA FR23 108 879 529 | annuaire-entreprises.data.gouv.fr (RNE/Insee) |
| Siège | Le Centre Automobile, Chemin de la Bédoule, 13240 Septèmes-les-Vallons | idem |
| Gérant (directeur de publication) | Mathias Ben Hamou | idem (RNE) |
| Téléphone | 07 80 87 59 41 | bio TikTok @capautomarseille |
| Adresse affichée | 16 Chemin de la Bédoule, 13240 Septèmes-les-Vallons | annonces L'argus + TikTok |
| Services | achat, vente, reprise, location, dépôt-vente, garantie 3 mois à 1 an (moteur, boîte, pont), financement | TikTok + annonces L'argus |
| 7 véhicules | marque, modèle, version, année, km, énergie, boîte, prix | occasion.largus.fr/auto/cap-auto-marseille/ |

**Points d'attention :** la société enregistrée s'appelle « CAP AUTO MARSEILLE » et non « CAP AUTO SEPTÈMES » — confirmez le nom à afficher (`site.name`). La carrosserie des véhicules a été déduite du modèle. Les stocks et prix changent : vérifiez avant publication.

**Introuvables en ligne (laissés vides) :** horaires, e-mail, médiateur de la consommation, mention RCS exacte, photos, logo, vidéos, avis clients.
