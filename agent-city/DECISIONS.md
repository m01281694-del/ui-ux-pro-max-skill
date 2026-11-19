# DECISIONS — Agent City

Journal des choix faits sans te demander (cahier des charges : `PROMPT-ville-ia.md`). Chaque ligne : décision, raison, état.

## Phase 1 : MVP visible (livrée)

| # | Décision | Pourquoi | État |
|---|---|---|---|
| 1 | Le projet vit dans `agent-city/` du dépôt `ui-ux-pro-max-skill`, sur la branche `claude/new-session-ewa6p6`. | C'est le seul dépôt accessible à la session. Il pourra être déplacé dans un dépôt dédié (le code n'en dépend pas). | ✅ |
| 2 | Next.js 16 (App Router) + TypeScript + Tailwind v4. `proxy.ts` (ex-middleware) pour le mot de passe. | Stack demandée ; Next 16 a renommé `middleware` en `proxy`. | ✅ |
| 3 | **Couche vie 100 % déterministe** (`src/lib/sim/*`) : graine fixe `20261119`, 1 000 habitants, emplois du temps calculés à partir de (habitant, jour Paris). Elle tourne **dans le navigateur**, zéro appel IA, et tout le monde voit la même ville au même moment. | Contrainte de coût §1.5 : la simulation de 1 000 agents coûte 0 €. Tout le rendu (~1 000 positions) prend environ 4 ms par image. | ✅ |
| 4 | Carte : 10×10 blocs de 8 tuiles (81×81), routes sur les lignes multiples de 8. Bureaux : 3 à gauche (Research, Content, Publish) et 3 à droite (The loop, Sales, Community), comme dans l'organigramme. Mairie, parc, 8 commerces, école, clinique, atelier, dépôt, 312 maisons. | L'agencement reprend le schéma ; les trajets suivent les rues (chemins de Manhattan). | ✅ |
| 5 | Les bureaux sont des **open spaces sans toit**, avec des postes visibles : on voit les employés à leur bureau. Les maisons et les commerces cachent leurs occupants. | Exigence « postes de travail visibles ». | ✅ |
| 6 | Population : 305 employés de départements (36 équipes de 4 à 14 personnes, avec un chef d'équipe et un membre de l'équipe de nuit par métier), 90 commerçants, 234 métiers municipaux, 124 étudiants, 123 retraités, 124 indépendants. | Environ 300 dans le pipeline, le reste fait tourner l'économie. L'équipe de nuit garantit que chaque métier a toujours quelqu'un à qui assigner une tâche à 3 h. | ✅ |
| 7 | Besoins (faim, énergie, social, fun, humeur) calculés analytiquement en rejouant l'emploi du temps du jour. « Affamé mange plus tôt » : l'heure du déjeuner dépend d'un trait (névrosisme / appétit). | Déterministe, peu coûteux, explicable. Pas de boucle de rétroaction d'un jour à l'autre (simplification assumée). | ✅ |
| 8 | Économie : chaque achat vient d'une ligne d'emploi du temps. Le prix de chaque commerce suit la variation de la demande d'un jour à l'autre (J-1 contre J-2, bornée à ±15 %). Le PIB du jour est la somme des achats. Les soldes = solde initial + 12 % d'épargne mensuelle − dépenses du jour. | L'offre et la demande sont simulées sans état serveur. | ✅ |
| 9 | Rendu PixiJS v8, pan/zoom maison (souris, molette, pincement) plutôt que `pixi-viewport`. | `pixi-viewport` a un historique de compatibilité fragile avec Pixi v8 ; 80 lignes suffisent. | ✅ |
| 10 | Cycle jour/nuit sur l'heure Europe/Paris (`Intl`, heure d'été gérée), voile nocturne, fenêtres allumées selon l'occupation réelle des bâtiments, lampadaires. | §1.2 | ✅ |
| 11 | Bulles de dialogue **templatisées** (`dialogue.ts`). LLM uniquement dans « Parler à cet habitant » (`/api/chat`, `claude-haiku-5-5`, effort `low`, prompt système mis en cache). | §1.5 et règle n°7 sur les tokens. | ✅ (la clé Claude reste à ajouter) |
| 12 | **Couche travail** : file de tâches `Task` / `Content` validées par Zod. Phase 1 : générateur **DÉMO** déterministe (3 vidéos par jour qui traversent tout le pipeline, carrousels lun/mer/ven, newsletter le jeudi, plus les tâches récurrentes des 36 métiers). Chaque élément porte `demo: true` et un badge « DÉMO » à l'écran. `DEMO_MODE=off` les coupe. | Phase 1 demandée en mode démo, clairement marqué. Les vraies tâches (fichier, puis Postgres) passent par le même `store.ts`. | ✅ |
| 13 | Assignation : une tâche va à un membre de l'équipe du métier qui est **au bureau** à ce moment-là (sinon à l'équipe de nuit). Si l'habitant n'y est pas, sa position est forcée vers son bureau. | « l'habitant se rend à son bureau sur la carte ». | ✅ |
| 14 | Temps réel : SSE `/api/stream` (toutes les 3 s) plus `/api/work` (fenêtre de 10 h). Replay : l'horloge est simulée côté client (×1 à ×600, curseur d'heure, aujourd'hui ou hier). | SSE suffit (flux à sens unique) et passe sur Vercel. | ✅ |
| 15 | Cerveau : dossier `brain/` au format Obsidian (frontmatter YAML, `[[wikilinks]]`), lu par `gray-matter`. **73 notes réelles** semées par `scripts/seed-brain.ts` : structure de la ville, 36 métiers, formats plateformes, 12 templates de scènes. Les sources douteuses sont marquées « à vérifier » avec une confiance de 0,5 (aucune connaissance inventée). | §4 et §4.2 | ✅ |
| 16 | Galaxie **DÉMO** (≈ 3 900 points au 19/11, avec une nouvelle naissance toutes les ~5 min) générée côté client, désactivable (« Afficher les notes DÉMO »). | Montrer l'effet attendu avant que les agents écrivent de vraies notes. | ✅ |
| 17 | Rendu 3D : `3d-force-graph` + `UnrealBloomPass` + `OutputPass` (correction d'espace colorimétrique), hubs épinglés sur une sphère (un amas par thème), champ d'étoiles, rotation lente auto (en pause pendant 6 s quand on manipule), flash de naissance, particules sur les liens. | Référence visuelle §4.1. | ✅ |
| 18 | Performances du Cerveau : ~4 000 nœuds fluides. **Reporté en Phase 4** : layout en Web Worker et instancing pour 20 000 nœuds. | Inutile tant que le cerveau réel compte moins de 1 000 notes. | ⏳ |
| 19 | Kill switch + mode Approval Desk (`/api/control`) : fichier `data/control.json` en local, mémoire sur Vercel (FS en lecture seule). Démarrage en `semi-auto`. | Passera en Postgres en Phase 3 (avant toute publication réelle). | ✅ (persistance Vercel ⏳) |
| 20 | Coûts IA : plafond `AI_DAILY_CAP_EUR` (10 € par défaut), compteur par métier, dégradation Opus → Sonnet → Haiku à 70 % puis 90 % du plafond (`src/lib/ai/budget.ts`). | §1.5 | ✅ (en mémoire ; en base en Phase 2) |
| 21 | Mot de passe : HTTP Basic via `SITE_PASSWORD`. Tant qu'il n'est pas défini, le déploiement Vercel est un **déploiement preview protégé par l'authentification Vercel** (toi seul y accèdes, connecté à Vercel). | Ne jamais générer ni coller de mot de passe dans le chat. | ✅ |
| 23 | Déployé sur Vercel (projet `agent-city`). La protection Vercel Authentication est active sur tous les domaines *.vercel.app. | Accès réservé au propriétaire du compte Vercel tant que `SITE_PASSWORD` n'est pas défini. | ✅ |
| 22 | Tests : Vitest (10 tests : simulation, économie, horloge, schémas, cerveau) et Playwright (4 scénarios × desktop/mobile). | §6 Tests | ✅ 18/18 |

## Plan des phases suivantes (choix déjà arrêtés)

- **Phase 2** : worker Node (`workers/`) avec `pg-boss` sur Postgres (Neon) et `drizzle-orm`. Agents en Anthropic SDK : Opus 5.5 pour les scripts, hooks et le rapport hebdo ; Sonnet 5.5 pour le travail courant ; Haiku 5.5 pour le tri ; prompt caching et Batch API la nuit ; fallback serveur activé. Voix ElevenLabs : on liste d'abord les modèles via l'API, puis endpoint `with-timestamps`. Remotion + `@remotion/three` (12 templates). QA ffmpeg (`loudnorm`, `blackdetect`, `freezedetect`).
- **Phase 3** : Metricool (`createScheduledPostForReview` pour coller à l'Approval Desk).
- **Phase 4** : Windsor.ai / Metricool analytics → Post Analyst ; Loop Feeder écrit dans `brain/` puis commit git (synchro Obsidian).

## Où tourne quoi, et combien ça coûte (estimation à confirmer avec ton budget)

| Brique | Où | Coût / mois (estim.) |
|---|---|---|
| Site (ville, cerveau, API légères) | Vercel | 0 € (Hobby, usage perso) à 20 $ (Pro) |
| Workers (orchestrateur, rendus Remotion, crons) | VPS 4 vCPU / 8 Go (Hetzner, par ex.) ou Railway | ≈ 8 à 20 € |
| Base Postgres + file pg-boss | Neon (offre gratuite au départ) | 0 à 19 $ |
| Médias (MP4, audio, images) | Vercel Blob ou Cloudflare R2 | ≈ 0 à 5 € |
| IA Claude | API Anthropic, plafonnée à 10 €/jour | objectif ≈ 60 à 120 €, plafond dur 300 € |
| Voix / SFX | ElevenLabs (ton abonnement actuel) | selon ton plan |
| Remotion | licence gratuite pour les individus et petites structures (à vérifier selon ta situation) | 0 € |

## Tes réponses (19/11) et ce qu'elles changent

- **Niche** : marketing digital ; les vidéos font la promotion de **ta formation** (CTA « lien en bio »). Détails de l'offre encore inconnus (nom, prix, lien).
- **Comptes** (trouvés via Metricool) : Instagram `@manu.digi0`, TikTok `@manu_digi0`, YouTube (chaîne liée). Sur Windsor.ai, seul TikTok est branché.
- **Charte** : bleu foncé « un peu clair » `#1F3B73` (fond profond `#0F2147`), orange Claude `#D97757`, blanc `#FFFFFF`. Titres en Space Grotesk Bold, texte en Inter. Appliquée aux vidéos et au site.
- **Budget 0 €**, ce qui change l'architecture :
  - **Pas d'API Claude payante.** Le « cerveau » des agents, ce sont des sessions Claude Code (ton abonnement), lancées par des tâches planifiées. Elles utilisent les connecteurs (ElevenLabs, Metricool, Windsor, Firecrawl), rendent les vidéos dans le conteneur, puis commitent `data/` et `brain/` ; Vercel redéploie.
  - Hébergement : Vercel Hobby (gratuit). Pas de VPS ni de Postgres : la file de tâches reste dans le fichier `data/work.json`, versionné dans git.
  - ElevenLabs gratuit : 10 000 caractères par mois, soit environ 15 vidéos de 30 s. Pas de voix natives françaises (payantes), pas de musique, pas de licence commerciale. Voir `brain/Incidents/`.

## Phase 2 : premier vrai contenu (livrée, en attente de ta validation)

| # | Décision | État |
|---|---|---|
| 24 | Pipeline vidéo dans `video/` (paquet séparé pour ne pas alourdir le site) : `script.json` (scènes, 10 hooks notés), `scripts/voice.ts` (ElevenLabs `eleven_v4` + `with-timestamps`), Remotion 4 + `@remotion/three` (`src/Short.tsx`), `scripts/render.ts` (rendu, puis `loudnorm` à −14 LUFS), `scripts/brandcheck.py` (QA ffmpeg notée sur 100). | ✅ |
| 25 | Modèle de voix : `eleven_v4`, le plus récent qui gère le français d'après `GET /v1/models`. Voix provisoire : **Eric** (4 voix t'ont été proposées). | ⏳ ton choix |
| 26 | Musique synthétisée avec ffmpeg (libre de droits) et SFX ElevenLabs. Ducking automatique de la musique sous la voix. | ✅ |
| 27 | Rendu avec le Chromium préinstallé (`gl: swangle`), 3 onglets en parallèle : environ 3 min pour 32 s de vidéo. | ✅ |
| 28 | Vidéo #001 : 32 s, Brand Check 100/100, **non publiée** (Approval Desk : elle attend ta validation de la voix et du style). | ✅ |

## 19/11 (soir) : passage au réel

| # | Décision | État |
|---|---|---|
| 29 | **Plus de données DÉMO** : la couche travail et le cerveau n'affichent que du réel. La vie des habitants reste une simulation (§1.5 du cahier des charges). | ✅ |
| 30 | Stats réelles : Metricool → `data/stats.json` → `/api/stats` → tableau de bord et vues de chaque publication. | ✅ |
| 31 | **Beacons n'a ni connecteur ni API publique.** Les revenus viennent des mails de vente Beacons lus dans Gmail (montant et date seulement). Aucune vente trouvée au 19/11. | ✅ |
| 32 | Autonomie via des tâches planifiées Claude Code dans **cette** session (seule à avoir les connecteurs) : production à 06:47 chaque jour, stats toutes les 3 h. La nuit (03:17) tourne en session séparée, sans connecteurs ; elle consolide le cerveau. | ✅ |
| 33 | « En direct » = mise à jour toutes les 3 h (compromis avec l'usage de l'abonnement Claude). Les vues des plateformes ne sont de toute façon pas temps réel côté Metricool. | ✅ |
| 34 | Règles éditoriales sur ELM : aucune promesse de gains, jamais les bonus « comptes TikTok/Netflix/Spotify » (voir `RUNBOOK.md`). | ✅ |
