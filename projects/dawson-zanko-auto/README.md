# DZ AUTOMOBILES — site officiel (maquette de démonstration)

Site premium pour l'entreprise de **M. Dawson Zanko**, commerce de voitures d'occasion à Marseille 11e.
Projet indépendant, sans aucun lien avec les autres projets du dépôt.

## Données de l'entreprise (vérifiées le 27/11/2026)

Source : Annuaire des Entreprises (Insee / INPI), annuaire-entreprises.data.gouv.fr/entreprise/912457900

| Donnée | Valeur |
|---|---|
| Entreprise | Dawson ZANKO, entrepreneur individuel (EI) |
| SIREN / SIRET actif | 912 457 900 / 912 457 900 00021 (établissement créé le 20/04/2026, **en activité**) |
| Activité | 45.11Z, commerce de voitures et de véhicules automobiles légers |
| Immatriculation | RNE, le 08/06/2026 |
| Adresse du siège | Chemin du Mouton, 13011 Marseille |
| Ancien établissement | SIRET …00013 « DZ ENTREPRISE », fermé le 31/12/2024 (c'est lui que concerne l'attestation de radiation URSSAF) |

**Nom commercial « DZ AUTOMOBILES » = proposition** (dans la continuité de l'ancienne enseigne DZ ENTREPRISE). Il se change en une ligne dans `content/site.js` (`brand.name`), et le titre s'ajuste automatiquement.

## Lancer

```bash
cd projects/dawson-zanko-auto
npm run dev       # http://localhost:3000
npm test          # tests de la recherche intelligente
npm run build     # génère dist/ (déploiement Vercel)
```
Aucune dépendance à installer (Node 18 ou plus).

## Ce qui est livré

- **Intro cinématique** : ligne de lumière, nom de marque lettre par lettre, ouverture en rideau. Elle se joue une fois par visite et peut être passée (bouton, Échap, molette, glissement).
- **Héro piloté au défilement** : travelling avant sur la voiture, balayage lumineux, brouillard, grain film, et trois énoncés synchronisés au défilement.
- **Recherche intelligente** en langage naturel (« SUV diesel auto moins de 20k », « peugeot après 2019 < 80 000 km »). Les critères compris s'affichent sous forme d'étiquettes et deviennent de vrais filtres.
- **Catalogue** : filtres par marque, modèle, prix, kilométrage, année, énergie, boîte et carrosserie, plus le tri. L'URL est partageable. Sur mobile, les filtres s'ouvrent en tiroir.
- **Fiche véhicule** : galerie et visionneuse (clavier et glissement), caractéristiques complètes, équipements, onglets **Renseignements / Demande d'essai** (date, créneau, permis), bouton d'appel, WhatsApp pré-rempli, véhicules similaires et données structurées `Car`.
- **Formulaires** de contact (achat, vente de son véhicule, recherche personnalisée), avec validation accessible et anti-spam. La fonction `api/lead.js` envoie les demandes par e-mail (Resend).
- **Conversion** : appels à l'action à chaque section, barre d'actions fixe sur mobile (Appeler, WhatsApp, Écrire), boutons d'appel et WhatsApp affichés automatiquement dès qu'un numéro est renseigné.
- **SEO local** : titres et descriptions par page, géolocalisation Marseille, JSON-LD `AutoDealer`, sitemap et robots générés.
- **Performance** : images AVIF/WebP responsives (héro de 12 à 29 Ko), police variable auto-hébergée, zéro framework, zéro traceur.
- **Sécurité** : CSP stricte, HSTS, anti-clickjacking. Toutes les données sont échappées avant affichage. La fonction serveur filtre, tronque et limite les envois.
- **Accessibilité** : navigation clavier, focus visible, erreurs reliées aux champs, respect du réglage « réduire les animations ».

## Mode démonstration (`demo: true`)

- Un bandeau « Maquette de démonstration » est affiché et le site n'est pas indexé.
- 9 véhicules **fictifs** badgés « Exemple » montrent le catalogue. Ils disparaissent dès qu'un vrai véhicule est ajouté dans `content/vehicles.js`.
- Les formulaires valident la saisie mais n'envoient rien, et ils le disent clairement.

## À fournir par l'entreprise avant la mise en ligne

1. Téléphone, WhatsApp, e-mail, adresse d'accueil et horaires (`content/site.js` → `contact`)
2. Les véhicules réels et leurs photos (`content/vehicles.js`, avec le modèle de fiche en tête du fichier)
3. Le médiateur de la consommation (obligatoire en vente aux particuliers)
4. Les avis Google **réels**, s'il y en a
5. La validation des textes de présentation
6. Le domaine, puis `url` et `demo: false`. **Le build refuse la mise en ligne s'il manque une information obligatoire.**

Pour activer l'envoi des formulaires sur Vercel : renseigner `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL` et `ALLOWED_ORIGIN`, puis `forms.endpoint: "/api/lead"`.

## Crédits

Photo d'illustration du héro : Unsplash (licence Unsplash). Elle ne représente pas un véhicule à vendre et elle est légendée « Photo d'illustration ». Police : Archivo (SIL OFL).
