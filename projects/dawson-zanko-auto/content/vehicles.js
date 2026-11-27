/* =====================================================================
   STOCK RÉEL — ajoutez ici les véhicules de l'entreprise.
   Tant que cette liste est vide ET que SITE.demo vaut true, le site
   affiche les véhicules d'EXEMPLE de content/vehicles.example.js
   (badge « Exemple », non indexés, non vendables).

   Modèle d'une fiche :
   {
     id: "peugeot-3008-2021-ab123",   // unique, minuscules et tirets
     status: "disponible",            // "disponible" | "reserve" | "vendu"
     featured: true,                  // mis en avant sur l'accueil
     brand: "Peugeot", model: "3008", version: "1.5 BlueHDi 130 EAT8 Allure",
     body: "suv",                     // citadine | compacte | berline | break | suv | monospace | coupe | cabriolet | utilitaire
     year: 2021, first_registration: "2021-03-15",
     mileage: 48000,                  // km
     fuel: "diesel",                  // essence | diesel | hybride | hybride-rechargeable | electrique | gpl
     transmission: "automatique",     // manuelle | automatique
     power_hp: 130, fiscal_hp: 7, doors: 5, seats: 5,
     color: "Gris Platinium", critair: "2", co2: 120, owners: 1,
     price: 21990,                    // € TTC — null = « Prix sur demande »
     description: "Texte libre.\n\nParagraphe suivant.",
     equipment: ["Caméra de recul", "GPS"],
     photos: ["assets/img/stock/peugeot-3008/1.webp"]
   }
   ===================================================================== */
window.VEHICLES = [];
