/* =====================================================================
   CAP AUTO SEPTÈMES — CONTENU DU SITE
   ---------------------------------------------------------------------
   C'est LE fichier à modifier pour personnaliser le site.
   Aucune donnée commerciale n'a été inventée : tout ce qui est vide ("")
   ou null reste à compléter par vous.

   Tant que publication.ready vaut false :
     - les zones vides affichent un repère « À PERSONNALISER » ;
     - le site est marqué « noindex » (non référencé par Google) ;
     - un bandeau « Prévisualisation » est affiché.

   Quand tout est rempli ET vérifié : passez publication.ready à true,
   puis lancez `npm run check` pour contrôler qu'il ne manque rien.
   Une fois publication.ready à true, les zones encore vides sont
   simplement masquées (aucun repère n'apparaît au public).

   Règles d'écriture :
     - Gardez les guillemets autour des textes : "Mon texte".
     - Une virgule sépare chaque élément d'une liste.
     - Chemins d'images : relatifs au site, ex. "assets/images/hero.jpg".
   ---------------------------------------------------------------------
   DONNÉES RECHERCHÉES EN LIGNE le 19/11/2026 — À VÉRIFIER AVANT PUBLICATION
   Sources :
     [RNE]    annuaire-entreprises.data.gouv.fr/entreprise/cap-auto-marseille-108879529
     [TIKTOK] tiktok.com/@capautomarseille (bio du profil)
     [ARGUS]  occasion.largus.fr/auto/cap-auto-marseille/ (annonces + fiche vendeur)
   ATTENTION : la société enregistrée à cette adresse s'appelle
   « CAP AUTO MARSEILLE » (et non « CAP AUTO SEPTÈMES »). Confirmez qu'il
   s'agit bien de votre entreprise et du nom commercial à afficher.
   Non trouvés en ligne : horaires, e-mail, médiateur de la consommation,
   photos, vidéo, avis clients → laissés vides.
   ===================================================================== */

window.CAP_CONTENT = {

  /* ------------------------------------------------------------------
     PUBLICATION
     ------------------------------------------------------------------ */
  publication: {
    ready: false            // ← passer à true UNIQUEMENT quand tout est vérifié
  },

  /* ------------------------------------------------------------------
     IDENTITÉ DU SITE
     ------------------------------------------------------------------ */
  site: {
    name: "CAP AUTO SEPTÈMES",   // nom fourni dans la consigne — vérifier l'orthographe officielle
    url: "",                     // adresse définitive, ex. "https://www.exemple.fr" (sans / final)
    logo: "",                    // ex. "assets/images/logo.svg" — vide = nom affiché en texte
    logo_alt: "",
    favicon: "",                 // ex. "assets/images/favicon.png" — vide = icône neutre fournie
    theme_color: "#0B0D10"
  },

  /* ------------------------------------------------------------------
     COORDONNÉES DU CONCESSIONNAIRE
     ------------------------------------------------------------------ */
  dealer: {
    phone: "+33780875941",  // [TIKTOK] — format international pour les liens, ex. "+33400000000"
    phone_display: "07 80 87 59 41", // [TIKTOK] — format affiché, ex. "04 00 00 00 00"
    email: "",
    whatsapp: "",           // numéro international sans + ni espaces, ex. "33600000000" — vide = masqué
    address: {
      street: "16 Chemin de la Bédoule",   // [ARGUS]/[TIKTOK] ; le RNE indique « Le Centre Automobile, Chemin de la Bédoule »
      postal_code: "13240",
      city: "Septèmes-les-Vallons",
      country: "France"
    },
    map_link: "https://www.google.com/maps/search/?api=1&query=16+Chemin+de+la+B%C3%A9doule+13240+Sept%C3%A8mes-les-Vallons",           // lien « Itinéraire » (Google Maps, Apple Plans, Waze…)
    map_embed_url: "https://maps.google.com/maps?q=16%20Chemin%20de%20la%20B%C3%A9doule%2C%2013240%20Sept%C3%A8mes-les-Vallons&output=embed",      // URL d'intégration de carte (iframe). Chargée seulement après consentement.

    /* Horaires : null = à compléter ; [] = fermé ; sinon créneaux ["HH:MM","HH:MM"] */
    hours: [
      { day: "Lundi",    slots: null },
      { day: "Mardi",    slots: null },
      { day: "Mercredi", slots: null },
      { day: "Jeudi",    slots: null },
      { day: "Vendredi", slots: null },
      { day: "Samedi",   slots: null },
      { day: "Dimanche", slots: null }
    ],
    hours_note: ""          // ex. information sur les jours fériés
  },

  /* Réseaux sociaux — vide = icône masquée */
  social: {
    facebook: "",
    instagram: "",
    tiktok: "https://www.tiktok.com/@capautomarseille",   // [TIKTOK]
    youtube: "",
    linkedin: "",
    google_business: ""
  },

  /* ------------------------------------------------------------------
     VIDÉO D'INTRODUCTION (page d'accueil)
     Déposez vos fichiers dans assets/video/ — voir assets/video/README.md
     ------------------------------------------------------------------ */
  intro: {
    enabled: true,          // false = pas d'introduction
    video_mp4: "",          // ex. "assets/video/intro.mp4"
    video_webm: "",         // optionnel, ex. "assets/video/intro.webm"
    poster: "",             // image affichée pendant le chargement
    once_per_session: true, // ne la rejouer qu'une fois par visite
    skip_label: "",         // vide = « Passer l'intro »
    logo_reveal: true       // affiche le nom / logo à la fin de la vidéo
  },

  /* ------------------------------------------------------------------
     PAGE D'ACCUEIL
     ------------------------------------------------------------------ */
  home: {
    hero: {
      eyebrow: "Septèmes-les-Vallons · Marseille",
      title: "Voitures d'occasion à Septèmes-les-Vallons",
      subtitle: "Achat, vente, reprise, location et dépôt-vente. Véhicules révisés et contrôlés, garantie et financement possibles.",
      cta_primary:   { label: "Voir les véhicules", href: "vehicules.html" },
      cta_secondary: { label: "Nous contacter", href: "contact.html" },
      background_video_mp4: "",   // vidéo d'arrière-plan en boucle (muette)
      background_video_webm: "",
      background_image: "",       // utilisée si pas de vidéo, ou comme affiche
      background_alt: ""
    },

    /* Bandeau d'atouts défilant — ex. ["Atout 1", "Atout 2"] */
    highlights: ["Achat", "Vente", "Reprise", "Location", "Dépôt-vente", "Garantie jusqu'à 12 mois", "Financement"],   // [TIKTOK]/[ARGUS]

    featured: {
      eyebrow: "En stock",
      title: "Nos véhicules",
      subtitle: "Une sélection de véhicules actuellement disponibles.",
      cta_label: "Tout le catalogue"            // bouton vers le catalogue
    },

    services: {
      eyebrow: "Nos services",
      title: "Ce que nous proposons",
      subtitle: "",
      /* { icon: "car|key|shield|wrench|card|swap|truck|star|check|phone", title: "", text: "", href: "" } */
      items: [   // services annoncés par l'entreprise [TIKTOK]/[ARGUS] — textes à valider
        { icon: "car",    title: "Vente", text: "Véhicules d'occasion sélectionnés, révisés et contrôlés.", href: "vehicules.html" },
        { icon: "swap",   title: "Reprise", text: "Reprise de votre ancien véhicule.", href: "contact.html" },
        { icon: "card",   title: "Financement", text: "Solutions de financement possibles.", href: "contact.html" },
        { icon: "shield", title: "Garantie", text: "Garantie de 3 mois jusqu'à 1 an : moteur, boîte et pont.", href: "" },
        { icon: "key",    title: "Achat & location", text: "Achat de votre véhicule et location.", href: "contact.html" },
        { icon: "check",  title: "Dépôt-vente", text: "Confiez-nous la vente de votre véhicule.", href: "contact.html" }
      ]
    },

    about: {
      eyebrow: "Qui sommes-nous",
      title: "Votre garage à Septèmes-les-Vallons",
      text: "Installés chemin de la Bédoule à Septèmes-les-Vallons, aux portes de Marseille, nous proposons des voitures d'occasion pour tous les budgets.\n\nAchat, vente, reprise, location et dépôt-vente : contactez-nous pour toute demande.",                // paragraphes séparés par une ligne vide (\n\n)
      image: "",
      image_alt: "",
      cta: { label: "En savoir plus", href: "a-propos.html" }
    },

    /* Chiffres clés RÉELS uniquement — { value: "", label: "" } */
    figures: [],

    /* Avis clients RÉELS uniquement, avec accord de leurs auteurs
       { author: "", text: "", rating: 5, source: "", date: "" } */
    testimonials: {
      eyebrow: "",
      title: "",
      items: []
    },

    cta_band: {
      title: "Un véhicule vous intéresse ?",
      text: "Appelez-nous ou passez nous voir chemin de la Bédoule à Septèmes-les-Vallons.",
      button: { label: "Nous contacter", href: "contact.html" }
    }
  },

  /* ------------------------------------------------------------------
     PAGE « À PROPOS »
     ------------------------------------------------------------------ */
  about_page: {
    title: "À propos",
    intro: "CAP AUTO, commerce de voitures d'occasion à Septèmes-les-Vallons (Bouches-du-Rhône).",
    image: "",
    image_alt: "",
    /* { title: "", text: "", image: "", image_alt: "" } */
    sections: [],
    /* Galerie de photos du concessionnaire : { src: "", alt: "" } */
    gallery: []
  },

  /* ------------------------------------------------------------------
     CATALOGUE
     ------------------------------------------------------------------ */
  catalogue: {
    title: "Nos véhicules",
    intro: "Véhicules d'occasion disponibles à Septèmes-les-Vallons. Disponibilités et prix à confirmer par téléphone.",
    empty_message: "",          // vide = message neutre « Aucun véhicule n'est en ligne pour le moment. »
    price_on_request_label: "", // vide = « Prix sur demande »
    legal_note: ""              // mention sous les prix (ex. conditions), à faire valider
  },

  /* ------------------------------------------------------------------
     PAGE CONTACT
     ------------------------------------------------------------------ */
  contact_page: {
    title: "Contact",
    intro: "Une question sur un véhicule, une reprise ou un financement ? Appelez-nous ou écrivez-nous."
  },

  /* ------------------------------------------------------------------
     FORMULAIRES
     Tant que endpoint est vide, AUCUN message n'est envoyé :
     le visiteur en est clairement informé.
     Options :
       - "/api/contact"  → fonction Vercel fournie (api/contact.js),
                           à configurer avec les variables d'environnement
                           décrites dans le README ;
       - URL d'un service tiers (Formspree, Web3Forms, Getform…).
     ------------------------------------------------------------------ */
  forms: {
    endpoint: "",
    subjects: ["Achat d'un véhicule", "Reprise", "Financement", "Location", "Dépôt-vente", "Autre"],              // sujets proposés, ex. ["Achat", "Autre"] — vide = champ masqué
    success_message: "",       // vide = « Votre message a bien été transmis. »
    retention_notice: ""       // phrase d'information RGPD sous le formulaire (à faire valider)
  },

  /* ------------------------------------------------------------------
     INFORMATIONS JURIDIQUES — à compléter ET à faire vérifier
     ------------------------------------------------------------------ */
  legal: {
    company_name: "CAP AUTO MARSEILLE",  // [RNE]        // dénomination sociale
    legal_form: "SARL (société à responsabilité limitée)",  // [RNE]          // SAS, SARL, EI…
    share_capital: "1 000 €",   // [RNE]
    head_office: "Le Centre Automobile, Chemin de la Bédoule, 13240 Septèmes-les-Vallons",  // [RNE]         // adresse du siège
    siren: "108 879 529",   // [RNE] — SIRET 108 879 529 00015
    rcs: "",  // immatriculée au RNE le 26/08/2026 — mention RCS exacte (greffe) À VÉRIFIER sur votre Kbis                 // ex. « RCS Ville 000 000 000 »
    vat_number: "FR23 108 879 529",   // [RNE]
    publication_director: "Mathias Ben Hamou, gérant",   // [RNE] — à confirmer
    contact_email: "",         // e-mail pour les demandes juridiques / RGPD
    dpo: "",                   // délégué à la protection des données (si désigné)
    mediator: {                // médiateur de la consommation (obligatoire en B2C)
      name: "",
      url: "",
      address: ""
    },
    orias: "",                 // n° ORIAS si intermédiaire en crédit / assurance
    host: {                    // hébergeur — pré-rempli pour Vercel, À VÉRIFIER
      name: "Vercel Inc.",
      address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
      url: "https://vercel.com"
    },
    last_update: ""            // date de dernière mise à jour des pages juridiques
  },

  /* ------------------------------------------------------------------
     COOKIES ET TRACEURS
     Aucun traceur non essentiel n'est actif. Pour en ajouter un, déclarez-le
     ci-dessous : il ne sera chargé QU'APRÈS consentement de sa catégorie.
     Catégories : "mesure" (audience), "medias" (contenus tiers), "marketing".
     { id: "", name: "", category: "mesure", provider: "", purpose: "",
       duration: "", script_src: "", privacy_url: "" }
     ------------------------------------------------------------------ */
  cookies: {
    consent_duration_days: 180,
    policy_version: 1,         // incrémenter pour redemander le consentement
    services: []
  },

  /* ------------------------------------------------------------------
     RÉFÉRENCEMENT (SEO)
     ------------------------------------------------------------------ */
  seo: {
    title_separator: " | ",
    default_description: "Voitures d'occasion à Septèmes-les-Vallons, près de Marseille : achat, vente, reprise, location, dépôt-vente. Garantie et financement possibles.",
    og_image: "",              // image de partage 1200×630, ex. "assets/images/og.jpg"
    google_site_verification: "",
    pages: {
      home:      { title: "Voitures d'occasion à Septèmes-les-Vallons", description: "" },
      vehicles:  { title: "Véhicules d'occasion en stock", description: "Les voitures d'occasion disponibles à Septèmes-les-Vallons : prix, kilométrage, année, énergie." },
      about:     { title: "À propos", description: "" },
      contact:   { title: "Contact et accès", description: "Téléphone, adresse et formulaire de contact — 16 chemin de la Bédoule, 13240 Septèmes-les-Vallons." },
      legal:     { title: "Mentions légales", description: "" },
      privacy:   { title: "Politique de confidentialité", description: "" },
      cookies:   { title: "Gestion des cookies", description: "" },
      notfound:  { title: "Page introuvable", description: "" }
    }
  }
};
