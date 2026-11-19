/* =====================================================================
   CAP AUTO SEPTÈMES — CATALOGUE DES VÉHICULES
   ---------------------------------------------------------------------
   La liste est volontairement VIDE : aucun véhicule fictif.

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

window.CAP_VEHICLES = [];
