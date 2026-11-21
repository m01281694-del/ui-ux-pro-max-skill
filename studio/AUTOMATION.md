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


## 2 bis. Format (important pour la qualité) — DEMANDE DU CRÉATEUR (17/11)
- **PLUS DE ROBOT, plus de sketch Léo/Bip, plus de film robot** sur TikTok/Instagram.
- **Format principal (2 fois sur 3) : 3D dynamique avec le grand chat pixel** (voir `studio/scripts/2026-11-17-idees-videos.json` :
  pas de champ `format`, `"chat": true`, `"voix": "piper"`, scènes bigword/tiles/arrow/steps/stat/versus/cards + `cta` VIP en dernier ;
  varier `style` (electric, ocean, candy, cherry, navy, forest, sunset) et `scene3d` (orbit, phone, grid, bars, knots) et `couleur_chat`).
- **Format secondaire (1 fois sur 3) : `calme`** (voir `studio/scripts/2026-11-17-page-qui-vend.json`) : fond crème à pois + halo,
  gros titre avec un mot en *italique*, petit personnage pixel original en haut à droite, cartes qui se remplissent,
  mot parlé au centre. Mettre `"voix": "piper"` (voix française de France, jamais d'accent canadien) et `"beat": true`.
  Scènes : `texte`, `grille` (2 colonnes de tuiles, 4 à 8 items avec `at`), `liste`, `versus`, `chiffre`, `question`,
  et **toujours** `vip` en dernier segment (gros « VIP »). Titres type liste/chiffre accrocheur (« 8 outils… », « 5 erreurs… »).
  Varier la `palette` (peche, menthe, lilas, ciel, beurre) à chaque vidéo.
- Si le créateur fournit plus tard un identifiant de voix ElevenLabs française (STUDIO_VOICE_*), retirer `"voix": "piper"`.
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
