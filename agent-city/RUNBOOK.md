# RUNBOOK — ce que la ville fait toute seule

Ces routines sont lancées par des **tâches planifiées Claude Code** (abonnement, 0 € d'API). Chaque session repart de zéro : elle suit ce fichier, du début à la fin, sans demander de validation sauf aux points ⚠️.

Les paramètres fixes et les **règles d'or** sont en fin de fichier.

## 0. Démarrage (toutes les routines)

```bash
# dépôt : m01281694-del/ui-ux-pro-max-skill, branche claude/new-session-ewa6p6
git fetch origin claude/new-session-ewa6p6 && git checkout claude/new-session-ewa6p6 && git pull --no-edit
cd agent-city && npm ci --silent
export NODE_NO_WARNINGS=1 NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
```

Avant toute tâche, lis :
- `brain/Playbook.md` ;
- les notes de `brain/Leçons/` ;
- la note `brain/Ventes/Offre — Formation marketing digital.md` ;
- `data/stats.json`.

Ne lis jamais tout le cerveau : seulement 5 à 10 notes utiles.

Chaque action réelle s'enregistre avec `npx tsx scripts/add-work.ts '<json>'`. La tâche est alors attribuée à un habitant du bon métier, qui apparaît dans la ville et le fil d'activité. Métiers exacts : voir `src/lib/sim/data.ts`.

## A. Production quotidienne (1 vidéo par jour)

0. **Limite Metricool.** `getScheduledPosts` sur les 3 derniers jours : si un post est en `ERROR` avec « account limit », et que le propriétaire n'a pas dit avoir réglé le problème, **ne produis pas de nouvelle vidéo** (pour économiser le quota de voix). Relance seulement le rappel au propriétaire et passe à l'étape 9.

1. **Quota voix.** `curl -s https://api.elevenlabs.io/v1/user/subscription -H "xi-api-key: proxy"`. S'il reste moins de 1 200 caractères, ne fais pas de vidéo : écris une note `brain/Incidents/` « quota ElevenLabs » et passe à l'étape 9.
2. **Research (Trend Scout, Competitor Watch).** Une ou deux recherches `firecrawl_search` sur les tendances « marketing digital / créateurs / TikTok » en français, de moins de 7 jours. Choisis un angle **pas encore traité** (vérifie `brain/Vidéos/`). Écris une note `brain/Tendances/…` avec les liens sources.
3. **Post Writer.** Crée `video/content/vNNN/script.json` (même schéma que `v001`, NNN = numéro suivant) :
   - 10 hooks notés, le meilleur en premier ;
   - 7 scènes : hook, tension, p1, p2, p3, payoff, cta ;
   - les champs `visual` reprennent ceux de v001 ;
   - voix ≤ 520 caractères ;
   - CTA « Toute la méthode est dans ma formation ELM, lien en bio » ;
   - `caption` avec 3 à 5 hashtags, `aiLabel: true`.
4. **Voiceover, Video Editor, Brand Check.** `cd video && npm ci --silent && ./scripts/new-video.sh vNNN` (environ 4 min). Si le Brand Check est sous 80, corrige la cause et relance. Regarde 3 frames clés (`ffmpeg -ss`) avant de valider.
5. **Approval Desk (semi-auto).** Validation automatique si le Brand Check est ≥ 80 **et** que les règles d'or sont respectées. Sinon, ⚠️ ne publie pas : laisse la vidéo en brouillon et préviens le propriétaire.
6. **Commit + push** (étape 9), pour que la vidéo ait une URL publique : `https://raw.githubusercontent.com/m01281694-del/ui-ux-pro-max-skill/<sha>/agent-city/public/media/videos/vNNN.mp4`.
7. **Scheduler.** `getBestTimeToPostByNetwork` (tiktok, instagram) pour aujourd'hui ou demain. Prends le meilleur créneau futur, au moins 30 min plus tard.
8. **TikTok / Reels / Shorts Poster.** Un seul `createScheduledPost` (brand `8094155`), avec les réseaux tiktok, instagram (REEL) et youtube (short). Reprends exactement les champs du post 434625821 : `isAigc`, `isAiGenerated`, `isAiGeneratedContent` à true, `commercialContentOwnBrand` à true, `madeForKids` à false.
9. **Enregistre et déploie.**
   - Tâches via `add-work.ts`, avec le contenu (`media`, `publishAt`, `stages`).
   - Note `brain/Vidéos/Vidéo NNN — ….md`.
   - Ajoute la publication programmée dans `data/stats.json` (`scheduled`).
   - Commit et push sur la branche, avec 4 tentatives et backoff en cas d'erreur réseau.
   - Déploie : `cd agent-city && VERCEL_TOKEN=vercel_placeholder_token npx -y vercel@latest deploy --prod --yes`.

## B. Stats & revenus (toutes les 3 h)

1. **Post Analyst.** `getAnalyticsDataByMetrics`, brand `8094155`, sur les 30 derniers jours :
   - TikTok, par vidéo : `TKPO02,TKPO03,TKPO05,TKPO07,TKPO08,TKPO09,TKPO10,TKPO13` ;
   - TikTok, global : `TKEV07,TKEV02,TKEV03,TKEV09` ;
   - Instagram : `IGEV01,IGEV05,IGEV22,IGEV23,IGEV38`, et par reel `IGRE02,IGRE06,IGRE03,IGRE23,IGRE10,IGRE07,IGRE21,IGRE27` ;
   - YouTube : `YTEV01,YTEV02,YTEV04`.
2. **Revenue Tracker.**
   - Gmail `search_threads` : `from:beacons.ai newer_than:30d -subject:"Your purchase"`. Ouvre les mails qui annoncent une **vente sur la boutique manu.digital** (« new sale », « nouvelle vente », « you made a sale », « order »).
   - Compte **uniquement** les ventes certaines : date, montant, produit. Les « Your purchase » sont des achats faits par le propriétaire, pas des ventes.
   - Ne note **aucune donnée personnelle** d'acheteur, seulement le montant et la date.
3. Réécris `data/stats.json` (même schéma), avec `updatedAt` = maintenant. Mets à jour les `stats` des contenus publiés dans `data/work.json` (rapprochement par date et légende).
4. **Loop Feeder.** Seulement si un chiffre change une conclusion, écris ou mets à jour une note `brain/Leçons/` (source + confiance).
5. Enregistre les tâches via `add-work.ts` (Post Analyst, Revenue Tracker), puis commit, push et déploie.

## C. Nuit (vers 3 h)

1. **Loop Feeder.**
   - Relis les notes des dernières 24 h, fusionne les doublons et ajoute les `[[liens]]` manquants.
   - Mets à jour `brain/Playbook.md` (règle, confiance, vidéos qui la prouvent).
   - Baisse la confiance des croyances que les données contredisent.
2. **Curiosité.** Repère la galaxie la plus pauvre (le moins de notes), fais une recherche Firecrawl pour le combler, puis écris une note sourcée.
3. **DM Agent.** Si les données (commentaires, ventes) montrent qu'une réponse de `data/replies.json` ne convertit pas, améliore-la en respectant les règles d'or (lien `{link}`, aucune promesse de gains). Garde les mêmes `id`.
4. **Weekly Report (le lundi seulement).** Écris `brain/Rapports/Semaine AAAA-SS.md` : ce qui a marché, ce qui a raté, pourquoi, et 3 décisions pour la semaine.
5. Enregistre les tâches, commit, push, déploie.

## Règles d'or (Brand Check éditorial, rien ne sort sans ça)

- **Aucune promesse de gains** : pas de « gagne ta vie », de « 100 % de bénéfice » ni de chiffres d'affaires. Ce sont les règles TikTok et Meta, et un risque de bannissement.
- **Ne jamais mentionner les bonus « comptes TikTok 10k / Netflix / Spotify »** de la page ELM.
- **Aucune statistique inventée** : tout chiffre affiché doit être sourcé dans le cerveau.
- **Label IA toujours activé.** Pas de faux comptes, pas d'achat d'abonnés, pas de bots de navigateur.
- **Kill switch** : si `data/control.json` a `publishingPaused: true`, ne programme rien.
- **Toute erreur** : note `brain/Incidents/` avec la cause et le contournement, une nouvelle tentative avec une autre stratégie, puis ⚠️ prévenir le propriétaire.

## Paramètres

| Paramètre | Valeur |
|---|---|
| Metricool brand | `8094155` (fuseau Europe/Paris) |
| TikTok | `@manu_digi0` |
| Instagram | `@manu.digi0` |
| YouTube | `UCC2akO2lNGQEjQ_nX3OgI-Q` |
| Voix | ElevenLabs `cjVigY5qzO86Huf0OWal` (Eric), modèle `eleven_v4`, `mp3_44100_128` (plan gratuit) |
| Offre | ELM, 197,99 €, https://shop.beacons.ai/manu.digital/827f5bbd-dcb7-43e5-8d98-b60df8d6be90 |
| Charte | navy `#1F3B73`, fond `#0F2147`, orange `#D97757`, blanc |
