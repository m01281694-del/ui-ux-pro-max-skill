/* =====================================================================
   CAP AUTO SEPTÈMES — CATALOGUE DES VÉHICULES
   ---------------------------------------------------------------------
   Véhicules repris des annonces publiées par CAP AUTO MARSEILLE sur L'argus
   (https://occasion.largus.fr/auto/cap-auto-marseille/, consultées le 19/11/2026).
   À VÉRIFIER : disponibilité, prix, carrosserie ; ajoutez vos propres photos.
   Aucun véhicule fictif.

   Deux façons d'ajouter des véhicules :
     1. L'outil de gestion : ouvrez /admin/ en local (npm run dev),
        remplissez les fiches, puis « Exporter vehicles.js » et remplacez
        ce fichier par celui téléchargé.
     2. À la main : copiez le modèle ci-dessous dans la liste.

   Photos : déposez-les dans assets/images/vehicules/<id>/
   (voir assets/images/README.md pour les formats conseillés).

   ---------------------------------------------------------------------
   MODÈLE D'UNE FICHE (à copier entre les crochets de la liste) :

   {
     id: "",                 // identifiant unique, minuscules et tirets, ex. "marque-modele-2021-ab12"
     status: "disponible",   // "disponible" | "reserve" | "vendu"
     featured: false,        // true = mis en avant sur l'accueil
     date_added: "",         // "AAAA-MM-JJ" — sert au tri « plus récents »

     brand: "",              // marque
     model: "",              // modèle
     version: "",            // finition / motorisation
     body: "",               // "citadine" | "berline" | "break" | "suv" | "monospace" | "coupe" | "cabriolet" | "utilitaire" | "4x4" | "autre"
     year: null,             // année, ex. 2021
     first_registration: "", // date de 1re mise en circulation "AAAA-MM-JJ"
     mileage: null,          // kilométrage, nombre sans espace
     fuel: "",               // "essence" | "diesel" | "hybride" | "hybride-rechargeable" | "electrique" | "gpl" | "ethanol" | "autre"
     transmission: "",       // "manuelle" | "automatique"
     power_hp: null,         // puissance (ch)
     fiscal_hp: null,        // puissance fiscale (CV)
     doors: null,
     seats: null,
     color: "",
     critair: "",            // "0" à "5"
     co2: null,              // g/km
     owners: null,           // nombre de propriétaires
     warranty: "",           // texte de garantie (à valider)

     price: null,            // prix TTC en euros, nombre sans espace — null = « Prix sur demande »
     price_note: "",         // précision affichée sous le prix

     description: "",        // paragraphes séparés par une ligne vide (\n\n)
     equipment: [],          // ex. ["Équipement 1", "Équipement 2"]
     photos: [],             // ex. [{ src: "assets/images/vehicules/<id>/1.jpg", alt: "" }]
     video: ""               // optionnel, ex. "assets/video/vehicules/<id>.mp4"
   }
   ===================================================================== */

window.CAP_VEHICLES = [
  {
    "id": "renault-twingo-2002-quickshift",
    "status": "disponible",
    "featured": true,
    "date_added": "2026-11-13",
    "brand": "Renault",
    "model": "Twingo",
    "version": "1.2 16v 75ch Initiale Paris Quickshift",
    "body": "citadine",
    "year": 2002,
    "mileage": 152013,
    "fuel": "essence",
    "transmission": "automatique",
    "price": 3490,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "jeep-renegade-2017-multijet-120",
    "status": "disponible",
    "featured": true,
    "date_added": "2026-11-13",
    "brand": "Jeep",
    "model": "Renegade",
    "version": "1.6 MultiJet S&S 120ch Brooklyn Limited",
    "body": "suv",
    "year": 2017,
    "mileage": 146030,
    "fuel": "diesel",
    "transmission": "manuelle",
    "price": 9990,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "peugeot-206-2004-style",
    "status": "disponible",
    "featured": true,
    "date_added": "2026-11-11",
    "brand": "Peugeot",
    "model": "206",
    "version": "1.4i Style 3 portes",
    "body": "citadine",
    "year": 2004,
    "mileage": 110716,
    "fuel": "essence",
    "transmission": "manuelle",
    "price": 2990,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "renault-clio-2024-tce-90",
    "status": "disponible",
    "featured": false,
    "date_added": "2026-11-11",
    "brand": "Renault",
    "model": "Clio",
    "version": "V 1.0 TCe 90ch Evolution",
    "body": "citadine",
    "year": 2024,
    "mileage": 89395,
    "fuel": "essence",
    "transmission": "manuelle",
    "price": 11990,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "toyota-verso-s-2011-d4d",
    "status": "disponible",
    "featured": false,
    "date_added": "2026-10-18",
    "brand": "Toyota",
    "model": "Verso-S",
    "version": "90 D-4D Active",
    "body": "monospace",
    "year": 2011,
    "mileage": 238690,
    "fuel": "diesel",
    "transmission": "manuelle",
    "price": 3490,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "peugeot-5008-2014-hdi-150",
    "status": "disponible",
    "featured": false,
    "date_added": "2026-10-18",
    "brand": "Peugeot",
    "model": "5008",
    "version": "2.0 HDi 150ch FAP Allure",
    "body": "monospace",
    "year": 2014,
    "mileage": 220214,
    "fuel": "diesel",
    "transmission": "manuelle",
    "price": 4990,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  },
  {
    "id": "peugeot-207-2007-executive",
    "status": "disponible",
    "featured": false,
    "date_added": "2026-09-27",
    "brand": "Peugeot",
    "model": "207",
    "version": "1.4 16v Executive 5 portes",
    "body": "citadine",
    "year": 2007,
    "mileage": 193400,
    "fuel": "essence",
    "transmission": "manuelle",
    "price": 2990,
    "price_note": "",
    "description": "",
    "equipment": [],
    "photos": []
  }
];
