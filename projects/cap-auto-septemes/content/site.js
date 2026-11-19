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
    phone: "",              // format international pour les liens, ex. "+33400000000"
    phone_display: "",      // format affiché, ex. "04 00 00 00 00"
    email: "",
    whatsapp: "",           // numéro international sans + ni espaces, ex. "33600000000" — vide = masqué
    address: {
      street: "",
      postal_code: "",
      city: "",
      country: "France"
    },
    map_link: "",           // lien « Itinéraire » (Google Maps, Apple Plans, Waze…)
    map_embed_url: "",      // URL d'intégration de carte (iframe). Chargée seulement après consentement.

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
    tiktok: "",
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
      eyebrow: "",
      title: "",
      subtitle: "",
      cta_primary:   { label: "", href: "vehicules.html" },
      cta_secondary: { label: "", href: "contact.html" },
      background_video_mp4: "",   // vidéo d'arrière-plan en boucle (muette)
      background_video_webm: "",
      background_image: "",       // utilisée si pas de vidéo, ou comme affiche
      background_alt: ""
    },

    /* Bandeau d'atouts défilant — ex. ["Atout 1", "Atout 2"] */
    highlights: [],

    featured: {
      eyebrow: "",
      title: "",
      subtitle: "",
      cta_label: ""            // bouton vers le catalogue
    },

    services: {
      eyebrow: "",
      title: "",
      subtitle: "",
      /* { icon: "car|key|shield|wrench|card|swap|truck|star|check|phone", title: "", text: "", href: "" } */
      items: []
    },

    about: {
      eyebrow: "",
      title: "",
      text: "",                // paragraphes séparés par une ligne vide (\n\n)
      image: "",
      image_alt: "",
      cta: { label: "", href: "a-propos.html" }
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
      title: "",
      text: "",
      button: { label: "", href: "contact.html" }
    }
  },

  /* ------------------------------------------------------------------
     PAGE « À PROPOS »
     ------------------------------------------------------------------ */
  about_page: {
    title: "",
    intro: "",
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
    title: "",
    intro: "",
    empty_message: "",          // vide = message neutre « Aucun véhicule n'est en ligne pour le moment. »
    price_on_request_label: "", // vide = « Prix sur demande »
    legal_note: ""              // mention sous les prix (ex. conditions), à faire valider
  },

  /* ------------------------------------------------------------------
     PAGE CONTACT
     ------------------------------------------------------------------ */
  contact_page: {
    title: "",
    intro: ""
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
    subjects: [],              // sujets proposés, ex. ["Achat", "Autre"] — vide = champ masqué
    success_message: "",       // vide = « Votre message a bien été transmis. »
    retention_notice: ""       // phrase d'information RGPD sous le formulaire (à faire valider)
  },

  /* ------------------------------------------------------------------
     INFORMATIONS JURIDIQUES — à compléter ET à faire vérifier
     ------------------------------------------------------------------ */
  legal: {
    company_name: "",          // dénomination sociale
    legal_form: "",            // SAS, SARL, EI…
    share_capital: "",
    head_office: "",           // adresse du siège
    siren: "",
    rcs: "",                   // ex. « RCS Ville 000 000 000 »
    vat_number: "",
    publication_director: "",
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
    default_description: "",
    og_image: "",              // image de partage 1200×630, ex. "assets/images/og.jpg"
    google_site_verification: "",
    pages: {
      home:      { title: "", description: "" },
      vehicles:  { title: "", description: "" },
      about:     { title: "", description: "" },
      contact:   { title: "", description: "" },
      legal:     { title: "Mentions légales", description: "" },
      privacy:   { title: "Politique de confidentialité", description: "" },
      cookies:   { title: "Gestion des cookies", description: "" },
      notfound:  { title: "Page introuvable", description: "" }
    }
  }
};
