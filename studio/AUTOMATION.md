# Studio — routine automatique (toutes les 5 heures)

Cette routine est exécutée toutes les 5 heures par une tâche planifiée. Elle fabrique **une vidéo de marketing digital
nouvelle** et la publie sur TikTok, Instagram (Reel visible dans le fil) et Facebook (Reel, si connecté).
**Jamais sur YouTube** : la chaîne YouTube est réservée aux comptines (voir studio/comptines/).

## 0. Préparer la session
```bash
pip install -q piper-tts soundfile numpy 2>/dev/null
git fetch origin claude/tiktok-video-link-reading-tb3u57 && git checkout claude/tiktok-video-link-reading-tb3u57 && git pull
```

## 1. Choisir le sujet
- Lire `studio/cerveau.json` (marque, offre, règles, banque de sujets, accroches, styles, CTA, hashtags).
- Lire `studio/historique.json`. **Ne jamais reprendre un sujet déjà présent.**
- Choisir un sujet de la banque (ou un sujet marketing nouveau, utile et concret, si la banque est épuisée).
- Choisir une **approche** (liste `approches`), un **style**, un **univers 3D** (`scene3d`) et un **personnage** (`host`)
  différents des 3 dernières vidéos, un type d'accroche différent, des phrases neuves et des types de scènes variés.
- **Fin obligatoire de CHAQUE vidéo** : « J'explique tout, étape par étape, dans ma formation de marketing digital. Écris VIP en commentaire, et je t'envoie tout. » (gros « VIP » à l'écran, `cta_at` = moment où « VIP » est prononcé). Même phrase dans la légende et `firstCommentText` = « Écris VIP en commentaire 👇 ».

## 2. Écrire le script
Créer `studio/scripts/AAAA-MM-JJ-<slug>.json` au format de `studio/scripts/2026-11-17-benefice.json` :
- **45 secondes** (environ 125 à 140 mots), 5 à 7 segments, phrases courtes, tutoiement, rythme dynamique.
- Premier segment = accroche (moins de 2 secondes à dire).
- Chaque segment a une `scene` parmi : `bigword`, `cards`, `tiles`, `versus`, `stat`, `steps`, `quote`, `arrow`, `save`, `cta`.
  Les champs `at` désignent le mot prononcé qui déclenche l'apparition (un mot présent dans `say`).
- Icônes disponibles : voir `cerveau.json > icones`.
- `caption` : 2 à 4 lignes qui résument la valeur + appel à l'action ; `hashtags` : 5 à 6 (base + rotation).
- Respecter toutes les `regles` du cerveau (aucune promesse de revenus, aucun chiffre inventé).


## 2 bis. Format (important pour la qualité)
- **Format principal : `sketch`** (2 vidéos sur 3, voir `studio/scripts/2026-11-17-sketch-automatise.json`) :
  sketch 3D (moteur `studio/engine/chambre.html` : chambre tamisée, bureau très détaillé, Léo low-poly + assistant voxel original Bip,
  voix Léo = Liam, voix Bip = Jessica, modèle eleven_multilingual_v2, plans : large, leo, leo2, leobas, bip, deux, ecran ;
  couleurs `couleur_sweat`, `couleur_bip`, `couleur_chaise` à varier), dans une chambre de nuit, le créateur Léo (personnage original) et son assistant robot Bip qui
  dialoguent (champ `who` : `leo` ou `bip`, 2 voix différentes), réactions (`emotion` : surpris, fache), `regard`, `geste`,
  écran du bureau (`ecran` {tag, title, items}), plans (`plan` : large, leo, leo2, bip, deux, ecran, bas).
  Ton drôle et rythmé, répliques courtes, une idée de marketing digital concrète, ~45 s. Dernière réplique (Léo) =
  la fin VIP obligatoire. Varier `couleur_sweat` à chaque fois.
- **Format secondaire : `film`** (1 vidéo sur 3) (court-métrage 3D, voir `studio/scripts/2026-11-16-pilote-automatique.json`) :
  plateau 3D de nuit, robot original « Bip » qui parle (visage lumineux), hologramme qui affiche le contenu,
  écran de bureau, plans de cinéma, carton d'ouverture, chapitres, sous-titres, grain.
  - champs : `film_titre` (un mot en *italique*), `presente`, `look` (nuit, aube, neon — alterner),
    `plans` (optionnel), et par segment : `chapitre`, `plan` (large, moyen, visage, epaule, orbite, ecran), `holo` {tag, title, items[≤3]} ;
  - ton posé et clair, 100 à 130 mots, structure en chapitres (prologue, 2 à 4 chapitres, épilogue = question).
- Formats `calme` et présentateur : seulement de temps en temps, pour varier.
- Sujets prioritaires : automatisation, IA pour créateurs, créer son site, outils no-code, marketing digital.
- **Engagement (commentaires)** : le dernier segment est toujours une question simple et précise à laquelle on répond
  en 1 mot ou 1 chiffre. Mettre la même question dans la légende et dans `firstCommentText` du post Metricool.
- Hashtags : 3 à 5, précis.

## 3. Fabriquer et vérifier
```bash
python3 studio/make_video.py studio/scripts/<id>.json --stills   # images de contrôle
```
Regarder les images (texte qui déborde, éléments qui se chevauchent, scène vide). Corriger le script si besoin, puis :
```bash
python3 studio/make_video.py studio/scripts/<id>.json
```

## 4. Publier
1. `git add studio && git commit && git push` sur la branche `claude/tiktok-video-link-reading-tb3u57`.
2. Utiliser l'URL **figée sur le commit** (`git rev-parse HEAD` à la place du nom de branche, évite le cache) et attendre qu'elle réponde 200 :
   `https://raw.githubusercontent.com/m01281694-del/ui-ux-pro-max-skill/claude/tiktok-video-link-reading-tb3u57/studio/videos/<id>/<id>.mp4`
3. Vérifier les réseaux connectés avec `getBrandSettings` (networksData), puis Metricool `createScheduledPost`
   (blogId `8094155`, fuseau `Europe/Paris`) environ 20 minutes après maintenant :
   - providers : `tiktok`, `instagram`, et `facebook` seulement si `facebookData` apparaît dans networksData (jamais `youtube`)
   - media : [URL publique] ; text : caption + hashtags ; firstCommentText : la question finale
   - `tiktokData` : `{"privacyOption":"PUBLIC_TO_EVERYONE","isAigc":true,"title":"<titre court>"}`
   - `instagramData` : `{"type":"REEL","showReelOnFeed":true,"isAiGenerated":true}`
   - `facebookData` : `{"type":"REEL","title":"<titre>"}`
4. Ajouter l'entrée dans `studio/historique.json` (date, id, sujet, style, cta, fichier, publie: true, plannerUrl), commit + push.

## 5. Compte rendu
Terminer par un résumé court : sujet, style, horaire programmé, lien Metricool, et tout problème rencontré
(quota ElevenLabs épuisé → la voix Piper a pris le relais, etc.).
