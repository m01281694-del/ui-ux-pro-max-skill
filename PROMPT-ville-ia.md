# PROMPT — « AGENT CITY » : une ville vivante de centaines d'habitants IA qui gèrent tout mon business de contenu + un cerveau qui apprend en direct

> Copie tout ce qui suit (à partir de « RÔLE ») dans une nouvelle conversation Claude Code.

---

## RÔLE

Tu es à la fois architecte logiciel senior, game designer de simulation, ingénieur IA (agents, mémoire, RAG), monteur vidéo / motion designer 3D et growth marketer short-form (TikTok, Reels, Shorts). Tu construis pour moi, de A à Z, un système **réellement fonctionnel**, pas une maquette. Tu travailles en autonomie : tu planifies, tu codes, tu testes, tu corriges, tu relances, sans me demander de valider chaque étape. Tu ne t'arrêtes qu'aux points listés dans la section « Ce que tu dois me demander ».

Règle d'or : **tout ce qui s'affiche sur le site doit correspondre à du vrai travail qui s'est vraiment produit** (un vrai script écrit, une vraie voix générée, une vraie vidéo rendue, un vrai post programmé, une vraie stat récupérée). La partie « vie quotidienne » des habitants (dormir, manger, s'amuser) est une simulation, mais le **travail** est réel.

---

## LA VISION EN UNE PHRASE

Un site web où je regarde **en direct** une ville de **1 000 habitants** qui vivent leur vie (dorment, mangent, font les magasins, achètent, s'amusent, se croisent, travaillent), et dont une partie travaille dans **6 départements / 36 métiers** qui automatisent entièrement mon Instagram, mon TikTok, mon YouTube et mon business — plus une seconde page « **Cerveau** » : un graphe de connaissances vivant (style graphe Obsidian) qui grandit sous mes yeux à mesure que la ville apprend.

---

## PARTIE 1 — LA VILLE (page `/city`)

### 1.1 Les habitants
- **1 000 habitants** générés avec une graine aléatoire fixe (reproductible) : prénom, nom, âge, avatar (sprite généré, couleur de tenue = couleur de son département), personnalité (5 traits), compétences (0–100 par compétence), salaire, argent sur son compte, maison, humeur, énergie, faim, social, fun.
- Chaque habitant a un **emploi du temps** : dormir (≈23h–7h), petit-déj, trajet, travail, pause déjeuner, travail, loisirs (parc, café, salle de jeux, cinéma, sport), courses au magasin, dîner, retour maison. L'emploi du temps varie selon la personnalité et les besoins (quelqu'un d'affamé va manger plus tôt, quelqu'un d'épuisé rentre dormir).
- **Économie réelle de la ville** : les habitants touchent un salaire, achètent dans les magasins (supérette, boulangerie, boutique de vêtements, café, cinéma, salle de sport), les commerces ont des stocks et un chiffre d'affaires, les prix bougent légèrement selon l'offre/demande. Afficher le PIB de la ville, l'argent en circulation, le top des commerces.
- Les habitants se parlent : bulles de dialogue courtes générées (pré-écrites/templatisées pour la masse, LLM seulement quand je clique sur quelqu'un — voir §1.5 pour le budget).
- Événements de vie : anniversaires, promotions, embauche d'un nouvel habitant quand un département est surchargé, « employé du mois », fêtes de la ville quand une vidéo dépasse un cap de vues.

### 1.2 Les lieux
Ville en **vue isométrique** : quartiers résidentiels, rues, un parc, des commerces, un café, un cinéma, une salle de sport, une mairie (= orchestrateur), et **6 bâtiments de bureaux**, un par département, avec à l'intérieur des postes de travail visibles. Cycle **jour/nuit** calé sur l'heure réelle (Europe/Paris) : lumières des fenêtres la nuit, rues vides à 3h du matin, foule à midi.

### 1.3 Les 6 départements et les 36 métiers (texte EXACT à afficher sur le site)

| Département | Métiers (6 chacun) |
|---|---|
| **Research** | Trend Scout · Audience Listener · Comment Miner · Competitor Watch · Post Writer · Email Writer |
| **Content** | Visual Designer · Carousel Builder · Voiceover · Video Editor · Brand Check · Approval Desk |
| **Publish** | Scheduler · TikTok Poster · Reels Poster · Shorts Poster · X Poster · Newsletter |
| **Community** | Comment Replier · DM Agent · FAQ Builder · Review Asker · Lead Catcher · Escalation |
| **Sales** | Lead Scorer · Call Booker · Reminder · Follow-up · Payment Link · CRM Sync |
| **The loop** | Post Analyst · Revenue Tracker · Call Tracker · Email Analyst · Weekly Report · Loop Feeder |

- Chaque métier est tenu par une **équipe de plusieurs habitants** (ex : 4 à 12 personnes selon la charge) avec un chef d'équipe. Environ 300 habitants travaillent dans ces départements ; les autres ont des métiers « de la ville » (commerçants, serveurs, coachs, etc.) qui font tourner l'économie simulée.
- Au centre : **la Mairie « Claude Code »** (l'orchestrateur) et moi (« **You** »), comme sur le schéma : une boucle qui relie les 6 départements dans cet ordre : Research → Content → Publish → Community → Sales → The loop → retour à Research.
- Reproduire visuellement ce schéma dans un panneau « Organigramme » : 6 cartes (3 à gauche, 3 à droite), une piste ovale au centre avec des points lumineux qui circulent quand une tâche passe d'un département à l'autre.

### 1.4 Ce que je dois pouvoir VOIR (tout, littéralement)
- **Carte vivante** : je zoome, je me déplace, je vois chaque habitant bouger.
- **Clic sur un habitant** → fiche : identité, métier, besoins, argent, emploi du temps du jour, **tâche en cours** (ex : « Lina — Voiceover — génère la voix de la vidéo #142, 63 % »), historique de ses tâches, ses productions (lien vers le script, l'audio, la vidéo), ses relations, son humeur. Bouton « Suivre la caméra ».
- **Clic sur un bâtiment** → qui est dedans, ce qu'ils font, file d'attente des tâches du département, KPIs.
- **Fil d'activité en direct** (colonne droite) : chaque action réelle horodatée, filtrable par département / habitant / plateforme. Ex : « 14:02 — Hugo (Trend Scout) a détecté la tendance "…" (score 87) », « 14:09 — Sami (Video Editor) a fini le rendu de la vidéo #142 (52 s, 1080×1920) ».
- **Barre de recherche** : « qui fait quoi » — taper un métier, un nom, une vidéo, et voir immédiatement qui est dessus.
- **Tableau de bord** : vues, abonnés, engagement par plateforme, posts publiés aujourd'hui / programmés, leads, appels réservés, revenus, coût IA du jour, santé du système.
- **Galerie de production** : toutes les vidéos, carrousels, posts, avec statut (brouillon → validé → programmé → publié → analysé) et leurs stats.
- **Mode replay** : rejouer une journée en accéléré.

### 1.5 Contrainte de coût (obligatoire pour que ça tienne)
On ne fait PAS tourner 1 000 LLM en permanence. Architecture à deux couches :
1. **Couche vie (simulation)** : déterministe, calculée à partir de l'heure + d'une graine, en TypeScript pur, zéro appel IA. Tout le monde voit la même ville au même moment.
2. **Couche travail (réelle)** : une file de tâches. Quand une vraie tâche est exécutée par un agent IA, elle est **assignée à un habitant** du bon métier, qui se rend à son bureau sur la carte et affiche la tâche. Les appels LLM ne servent qu'au vrai travail + aux conversations quand je clique sur un habitant.
- Plafond de dépense IA journalier configurable (ex : 10 €/jour) ; affichage du compteur ; dégradation gracieuse (modèle plus petit) quand on approche du plafond.
- Choix des modèles : orchestrateur (Mairie) et tâches créatives clés (scripts, hooks, analyse hebdo) → `claude-opus-5-5` ; travail courant → `claude-sonnet-5-5` ; tri, classification, réponses courtes, bulles de dialogue → `claude-haiku-5-5`. Utiliser le prompt caching sur les gros prompts système.

---

## PARTIE 2 — LE VRAI TRAVAIL : LE PIPELINE AUTOMATISÉ

Chaque métier = un agent avec un prompt système dédié, des outils, une entrée et une sortie typées (schéma JSON validé avec Zod). Les sorties sont stockées en base et dans le Cerveau.

### Research
- **Trend Scout** : chaque jour, détecte les tendances de ma niche (recherche web, sons/formats tendance, hashtags montants). Sortie : liste de tendances avec score, preuve (liens), angle proposé.
- **Audience Listener** : analyse qui est mon audience (stats des plateformes), ce qu'elle aime, quand elle est en ligne.
- **Comment Miner** : extrait des commentaires (les miens et ceux des concurrents) les questions, douleurs, objections, idées de vidéos.
- **Competitor Watch** : suit une liste de comptes concurrents, repère leurs posts qui sur-performent et **pourquoi** (hook, format, durée, sujet).
- **Post Writer** : écrit les scripts (voir §3), légendes, hashtags, threads X.
- **Email Writer** : écrit la newsletter et les séquences email.

### Content
- **Visual Designer** : miniatures, visuels, covers (génération d'images + templates HTML → PNG).
- **Carousel Builder** : carrousels Instagram (8–10 slides, 1080×1350), cohérents avec la charte.
- **Voiceover** : génère la voix via **ElevenLabs** (voir §3.3).
- **Video Editor** : monte la vidéo finale (voir §3).
- **Brand Check** : contrôle qualité automatique (voir §3.6) — rejette et renvoie au métier fautif avec la raison.
- **Approval Desk** : file de validation. Trois modes réglables dans le site : `manuel` (je valide tout), `semi-auto` (je valide seulement ce que Brand Check signale comme risqué), `full-auto`. **Démarrer en `semi-auto` la première semaine**, puis passer en `full-auto` quand le taux de rejet est bas.

### Publish
- **Scheduler** : choisit les meilleurs créneaux (données d'audience) et programme.
- **TikTok Poster, Reels Poster, Shorts Poster, X Poster, Newsletter** : publient via les connecteurs/API (voir §5). Chaque publication enregistre l'URL du post, l'heure, la plateforme.

### Community
- **Comment Replier** : répond aux commentaires (ton de la marque, jamais de promesses fausses, pas de réponse aux sujets sensibles → Escalation).
- **DM Agent** : répond aux DM quand l'API le permet ; qualifie les prospects.
- **FAQ Builder** : transforme les questions récurrentes en FAQ + idées de vidéos (renvoyées à Research).
- **Review Asker** : demande des avis/témoignages aux clients satisfaits.
- **Lead Catcher** : détecte les intentions d'achat dans commentaires/DM → crée un lead.
- **Escalation** : tout ce qui est sensible, agressif, juridique, ou incertain → m'envoie une notification et met en pause l'action.

### Sales
- **Lead Scorer** : note chaque lead (0–100) selon des critères explicites.
- **Call Booker** : envoie un lien de prise de rendez-vous (Cal.com ou Calendly).
- **Reminder / Follow-up** : relances programmées, poli, jamais plus de N relances.
- **Payment Link** : crée des liens de paiement (Stripe) pour mes offres.
- **CRM Sync** : un mini-CRM intégré au site (pipeline : nouveau → qualifié → appel → client), exportable.

### The loop (l'apprentissage)
- **Post Analyst** : récupère les stats de chaque post à H+1, H+24, H+72, J+7 (vues, rétention, partages, saves, commentaires, abonnés gagnés).
- **Revenue Tracker, Call Tracker, Email Analyst** : revenus, taux de conversion des appels, ouvertures/clics.
- **Weekly Report** : rapport chaque lundi (page dans le site + notification) : ce qui a marché, ce qui a raté, pourquoi, décisions pour la semaine.
- **Loop Feeder** : transforme les résultats en **leçons** écrites dans le Cerveau et met à jour le « Playbook » (règles de hook, durées, sujets, horaires) que lisent Research et Content. C'est ça qui fait que la ville **apprend de ses erreurs**.

### Orchestration (la Mairie)
- Boucle principale (cron) : planifie la production de la journée (objectif par défaut : 1–3 vidéos courtes/jour publiées sur TikTok + Reels + Shorts, 3 carrousels/semaine, 1 newsletter/semaine — réglable).
- Machine à états par contenu : `idée → script → voix → visuels → montage → brand_check → approbation → programmé → publié → analysé → leçon`.
- **Auto-réparation** : chaque tâche a des retries avec backoff, un timeout, et en cas d'échec : log, note « Incident » dans le Cerveau, nouvelle tentative avec une autre stratégie, puis Escalation si ça échoue encore. Un healthcheck tourne toutes les 5 min et s'affiche dans le site.
- **Kill switch** : un gros bouton « Pause toute publication » dans le site.

---

## PARTIE 3 — VIDÉOS PHÉNOMÉNALES (le cœur du projet)

Le niveau attendu : des vidéos qui donnent envie de rester jusqu'à la fin et de partager. Pas des diaporamas.

### 3.1 Format
9:16, 1080×1920, 30 fps (60 si possible), 20–60 s, son normalisé à −14 LUFS, sous-titres incrustés.

### 3.2 Script (Post Writer)
- **Hook dans les 1,5 premières secondes** (visuel + texte + voix) ; générer 10 hooks, les noter, garder le meilleur ; utiliser les patterns qui ont marché dans le Playbook.
- Structure : hook → tension/promesse → 3 temps forts rapides → payoff → boucle (la fin renvoie au début pour le rewatch) ou CTA court.
- Rythme : changement visuel toutes les 1–2 s, pas de temps mort, phrases courtes.
- Sortie : script découpé en scènes avec, pour chaque scène, texte voix, texte à l'écran, description visuelle 3D, durée, effet sonore.

### 3.3 Voix — ElevenLabs (très, très haute qualité)
- L'API ElevenLabs est déjà connectée dans mon environnement (`api.elevenlabs.io`, authentification gérée par le proxy : pas de clé à mettre dans le code).
- Lister mes voix disponibles, en tester plusieurs sur un même script, me proposer les 3 meilleures (fichiers audio) puis garder ma préférée comme voix de marque.
- Utiliser le modèle le plus qualitatif disponible pour le français (vérifier la liste des modèles via l'API au lieu de supposer), réglages stability/similarity/style ajustés, endpoint **avec timestamps** pour synchroniser les sous-titres mot à mot.
- Effets sonores (whoosh, impacts) et musique : générer via ElevenLabs (sound effects / music) si disponible sur mon compte, sinon bibliothèque libre de droits. Ducking automatique de la musique sous la voix.

### 3.4 Visuels 3D et montage
- Moteur de rendu programmatique : **Remotion** (React) + **@remotion/three** / **React Three Fiber** pour les scènes 3D (caméras en mouvement, objets 3D, typographie 3D, particules, lumières, profondeur de champ), rendu côté serveur en MP4.
- Bibliothèque de **templates de scènes 3D réutilisables** (au moins 12) : titre 3D qui explose, graphique 3D qui monte, téléphone 3D qui affiche un écran, globe, objets qui tombent avec physique, transition « portail », zoom à travers un texte, comparaison avant/après, compte à rebours, liste animée, citation, révélation finale.
- Si j'ajoute une clé d'API de génération vidéo (Veo, Runway, Kling, etc.), l'utiliser pour des plans b-roll réalistes ; sinon tout faire en 3D programmatique.
- Sous-titres **karaoké** animés (mot actif surligné, pop), placement hors des zones d'interface TikTok/Reels.
- Couverture/miniature générée pour chaque vidéo.

### 3.5 Tendances
Chaque vidéo référence la tendance ou le format qui l'a inspirée (lien vers la note du Cerveau), et les formats qui marchent sont réutilisés et variés, jamais copiés.

### 3.6 Brand Check (contrôle qualité automatique, rien ne sort sans ça)
Un script de QA vérifie : durée, résolution, présence et sync des sous-titres, niveau sonore, pas d'écran noir ni de frame figée > 1 s (ffmpeg), hook présent < 1,5 s, orthographe, cohérence de charte, aucune affirmation fausse ou non vérifiable, aucune musique/œuvre protégée, conformité aux règles de la plateforme. L'agent **regarde** la vidéo (extraire des frames clés et les analyser) avant de valider. Score /100 ; < 80 → retour au métier fautif avec la correction demandée.

---

## PARTIE 4 — LE CERVEAU (page `/brain`)

Inspiré du graphe d'Obsidian : une toile de connaissances que je vois grandir **en direct**.

- **Stockage** : un dossier de notes Markdown compatible Obsidian (`brain/`), avec liens `[[wikilinks]]`, tags et frontmatter (type, source, date, confiance, liens). Je dois pouvoir ouvrir ce dossier dans Obsidian sur mon ordinateur.
- **Types de notes** : Tendance, Concurrent, Format, Hook, Leçon, Incident, Persona d'audience, Sujet, Vidéo (avec ses stats), Offre, Lead (anonymisé), Rapport hebdo, Playbook.
- **Visualisation** : graphe force-directed (2D avec `sigma.js` + `graphology`, ou 3D avec `3d-force-graph`), nœuds colorés par type, taille = importance, liens qui apparaissent en animation quand une note est créée. Zoom, recherche, filtres par type, clic sur un nœud → panneau avec la note rendue, ses liens, son image, et « qui l'a écrite » (l'habitant).
- **Images** : chaque note importante a une image générée (illustration ou visuel de la vidéo), affichée dans le nœud au zoom.
- **Apprentissage autonome** :
  - Chaque tâche réelle produit ou met à jour des notes.
  - **Cycle « nuit »** (vers 3h, quand la ville dort) : les agents relisent les notes du jour, fusionnent les doublons, créent des liens, tirent des conclusions (« les hooks en question font +38 % de rétention sur nos 20 dernières vidéos »), mettent à jour le Playbook avec un niveau de confiance, et marquent les anciennes croyances contredites par les données.
  - **Curiosité** : chaque jour, l'orchestrateur choisit les zones faibles du graphe (peu de notes, faible confiance) et lance des recherches pour les combler.
  - **Expériences** : la ville teste des hypothèses (A/B sur les hooks, durées, horaires) et note les résultats. Les leçons alimentent directement les prompts des agents (RAG sur le Cerveau avant chaque tâche).
- Timeline : un curseur pour voir le graphe à n'importe quelle date (« comment le cerveau a grandi »).
- Compteurs : nombre de notes, liens, leçons validées, expériences en cours.

---

## PARTIE 5 — CONNEXIONS AUX PLATEFORMES (sois honnête et pragmatique)

- Utilise en priorité les connecteurs déjà présents dans mon environnement Claude ; vérifie d'abord lesquels sont disponibles. J'ai normalement : **ElevenLabs** (voix), **Metricool** (programmation de posts sur Instagram, TikTok, YouTube, X + meilleurs horaires + analytics), **Windsor.ai** (stats Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads), **TikTok for Business**, **Canva**, **Gmail**, **Vercel** (déploiement), **Stripe/Shopify** si besoin.
- Pour la publication, préférer **Metricool** (une seule intégration pour toutes les plateformes, avec un mode « à valider » qui colle à l'Approval Desk). Sinon, API officielles : Instagram Graph API (compte pro), TikTok Content Posting API, YouTube Data API v3.
- **Pas de bots de navigateur qui se connectent à mes comptes**, pas de faux comptes, pas d'achat d'abonnés, pas de spam : ça fait bannir les comptes. Respecter les limites des API (quotas, rythme).
- Les commentaires/DM : uniquement là où l'API officielle le permet ; sinon, préparer les réponses dans le site pour que je les colle.
- Les contenus générés par IA doivent porter le label « contenu IA » quand la plateforme l'exige.
- Toutes les clés/tokens : dans les variables d'environnement / secrets, **jamais dans le code ni dans git**.

---

## PARTIE 6 — STACK TECHNIQUE ET ARCHITECTURE

- **Front** : Next.js (App Router) + TypeScript + Tailwind ; ville en **PixiJS** (isométrique 2D, sprites, ~1 000 agents à 60 fps grâce au batching ; viewport culling) ; graphe avec sigma.js ou 3d-force-graph ; temps réel via **Server-Sent Events** ou WebSocket.
- **Back** : workers Node/TypeScript ; file de tâches persistante ; base **Postgres** (Neon/Supabase) ou SQLite pour le dev ; stockage des médias (S3/R2 ou Vercel Blob).
- **Rendu vidéo** : Remotion rendu sur un worker (Remotion Lambda ou machine dédiée), ffmpeg pour la QA.
- **Hébergement** : front sur Vercel ; les workers longue durée (rendu vidéo, boucle d'orchestration) sur un service qui tourne en continu (Railway, Fly.io, ou un petit VPS) + crons. Explique-moi clairement où tourne quoi et combien ça coûte par mois.
- **SDK Claude** : Anthropic SDK (tool use, prompt caching, sorties JSON validées). Avant d'écrire du code qui appelle l'API, lis la doc à jour (modèles, prix, paramètres) au lieu de te fier à ta mémoire.
- **Design** : interface sombre élégante, typographie soignée, couleurs par département, animations fluides, responsive (je regarde aussi sur mon téléphone). Le panneau « Organigramme » reprend l'esthétique du schéma fourni : cartes blanches arrondies, piste centrale, accents orange.
- **Observabilité** : logs structurés, page `/system` (santé des workers, files, erreurs, coûts, quotas API).
- **Tests** : tests unitaires de la simulation et des schémas, tests end-to-end Playwright du site, test de bout en bout du pipeline vidéo en mode « dry-run » (rien publié).
- **Sécurité** : le site est protégé par mot de passe (c'est mon tableau de bord privé), pas de données personnelles de mes abonnés exposées publiquement.

---

## PARTIE 7 — PLAN DE TRAVAIL (livrer vite, puis enrichir)

Travaille par phases. À la fin de chaque phase : ça tourne, c'est testé, c'est commité, et tu me fais un résumé court + ce qui reste.

1. **Phase 1 (≈2 h) — MVP visible** : site déployé avec la ville de 1 000 habitants qui vivent (jour/nuit, besoins, magasins, économie), les 6 départements / 36 métiers affichés, fiches habitants, fil d'activité, organigramme, page Cerveau avec le graphe qui s'anime. Le pipeline tourne en **mode démo** (données d'exemple clairement marquées « DÉMO »).
2. **Phase 2 — Premier vrai contenu** : Research + Post Writer + Voiceover ElevenLabs + Video Editor 3D + Brand Check → une vraie vidéo de qualité rendue, visible dans la galerie, assignée aux bons habitants. Je valide la voix et le style.
3. **Phase 3 — Publication** : connexion Metricool / API, Approval Desk, Scheduler, publication réelle en `semi-auto`.
4. **Phase 4 — The loop + Cerveau réel** : récupération des stats, leçons, Playbook, cycle de nuit, expériences A/B.
5. **Phase 5 — Community + Sales** : commentaires, leads, CRM, liens de paiement, prise de RDV.
6. **Phase 6 — Autonomie totale** : auto-réparation, full-auto, rapport hebdo, optimisation des coûts.

Après chaque phase : lance tout, teste tout, corrige ce qui casse, relance. Ne déclare jamais quelque chose « fini » sans l'avoir vérifié (capture d'écran du site, vidéo rendue regardée, test passé).

---

## CE QUE TU DOIS ME DEMANDER (et seulement ça), au tout début, en une seule fois

1. Ma niche / mon sujet, mon public cible, ma langue de publication.
2. Mes offres (produit, service, prix) et le lien de prise de RDV.
3. Mes comptes (@ TikTok, Instagram, YouTube, X) et 3–10 comptes concurrents/inspirations.
4. Ma charte (couleurs, logo, polices) — sinon tu en proposes une.
5. Mon budget mensuel max (IA + hébergement + rendus).
6. Les clés ou connexions qui manquent, une par une, au moment où tu en as besoin (via les outils sécurisés de l'environnement, jamais collées dans le chat).

Tout le reste, tu décides toi-même avec de bons choix par défaut, et tu le notes dans un fichier `DECISIONS.md`.

---

## CRITÈRES DE RÉUSSITE

- J'ouvre le site et je vois immédiatement une ville vivante de 1 000 habitants, je comprends qui fait quoi en 5 secondes.
- Je clique sur n'importe quel habitant qui travaille et je vois la vraie tâche qu'il exécute et son résultat.
- Les vidéos produites sont du niveau d'un bon créateur : hook fort, 3D fluide, voix ElevenLabs naturelle, sous-titres synchronisés, rythme rapide.
- Les posts sont réellement programmés/publiés sur mes comptes, et leurs stats reviennent dans le site.
- Le Cerveau grandit chaque jour de façon visible, et les vidéos s'améliorent semaine après semaine grâce aux leçons.
- Je n'ai rien à faire au quotidien, à part (si je le veux) valider dans l'Approval Desk et lire le rapport du lundi.

Commence maintenant : pose-moi les questions de la section ci-dessus en un seul message, puis attaque la Phase 1 sans attendre mes réponses pour tout ce qui n'en dépend pas.
