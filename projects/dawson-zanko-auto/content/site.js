/* =====================================================================
   CONTENU DU SITE — le seul fichier à modifier pour personnaliser.
   ---------------------------------------------------------------------
   Données légales vérifiées sur l'Annuaire des Entreprises (Insee / INPI),
   consulté le 27/11/2026 : annuaire-entreprises.data.gouv.fr/entreprise/912457900

   Règle : une valeur vide ("") = élément masqué. Rien n'est inventé.
   ===================================================================== */
window.SITE = {

  /* Mode démonstration : bandeau « maquette », véhicules d'exemple
     (marqués EXEMPLE), site non indexé. Passer à false pour la mise en ligne. */
  demo: true,

  brand: {
    name: "DZ AUTOMOBILES",          // ← proposition de nom commercial (ancienne enseigne : « DZ ENTREPRISE »)
    short: "DZ",
    tagline: "Automobiles d'occasion · Marseille",
    city: "Marseille"
  },

  url: "",                           // ex. "https://www.dz-automobiles.fr" (sans / final)

  /* Coordonnées — À FOURNIR par l'entreprise. Vide = bouton masqué. */
  contact: {
    phone: "",                       // format international, ex. "+33600000000"
    phone_display: "",               // ex. "06 00 00 00 00"
    whatsapp: "",                    // ex. "33600000000" (sans + ni espaces)
    email: "",
    showroom_address: "",            // adresse d'accueil du public (si différente du siège)
    district: "Marseille 11e",
    hours: []                        // ex. [{ days: "Lun. – Sam.", time: "9h – 19h" }]
  },

  /* Avis clients — UNIQUEMENT des avis réels, avec accord des auteurs. */
  reviews: {
    google_rating: "",               // ex. "4,8"
    google_count: "",                // ex. "32 avis"
    google_url: "",
    items: []                        // { author: "", text: "", rating: 5, date: "" }
  },

  /* Envoi des formulaires : "/api/lead" (fonction fournie, voir README). */
  forms: { endpoint: "" },

  /* Informations légales — source : Insee / INPI (RNE). */
  legal: {
    owner: "Dawson ZANKO",
    status: "Entrepreneur individuel (EI)",
    siren: "912 457 900",
    siret: "912 457 900 00021",
    naf: "45.11Z — Commerce de voitures et de véhicules automobiles légers",
    rne: "Immatriculé au Registre national des entreprises (RNE) le 08/06/2026",
    address: "Chemin du Mouton, 13011 Marseille",
    vat: "",                         // aucun n° de TVA intracommunautaire valide référencé à ce jour
    mediator: { name: "", url: "" }, // médiateur de la consommation — obligatoire avant mise en ligne
    host: { name: "Vercel Inc.", address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis", url: "https://vercel.com" },
    updated: "27 novembre 2026"
  }
};
