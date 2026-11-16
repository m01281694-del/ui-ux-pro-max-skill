# Studio — routine quotidienne automatique

Cette routine est exécutée chaque jour par une tâche planifiée. Elle fabrique **une vidéo marketing
nouvelle** (TikTok + Reel Instagram) et la programme via Metricool.

## 0. Préparer la session
```bash
pip install -q piper-tts soundfile numpy 2>/dev/null
git fetch origin claude/tiktok-video-link-reading-tb3u57 && git checkout claude/tiktok-video-link-reading-tb3u57 && git pull
```

## 1. Choisir le sujet
- Lire `studio/cerveau.json` (marque, offre, règles, banque de sujets, accroches, styles, CTA, hashtags).
- Lire `studio/historique.json`. **Ne jamais reprendre un sujet déjà présent.**
- Choisir un sujet de la banque (ou un sujet marketing nouveau, utile et concret, si la banque est épuisée).
- Choisir un **style différent** des 2 dernières vidéos, un **type d'accroche différent** de la dernière,
  et des types de scènes variés.
- CTA : au plus 1 vidéo sur 3 vend VIP (`dm`) ; sinon `save`, `follow` ou `comment`.

## 2. Écrire le script
Créer `studio/scripts/AAAA-MM-JJ-<slug>.json` au format de `studio/scripts/2026-11-17-benefice.json` :
- 5 à 8 segments, 120 à 160 mots au total, phrases courtes, tutoiement.
- Premier segment = accroche (moins de 2 secondes à dire).
- Chaque segment a une `scene` parmi : `bigword`, `cards`, `tiles`, `versus`, `stat`, `steps`, `quote`, `arrow`, `save`, `cta`.
  Les champs `at` désignent le mot prononcé qui déclenche l'apparition (un mot présent dans `say`).
- Icônes disponibles : voir `cerveau.json > icones`.
- `caption` : 2 à 4 lignes qui résument la valeur + appel à l'action ; `hashtags` : 5 à 6 (base + rotation).
- Respecter toutes les `regles` du cerveau (aucune promesse de revenus, aucun chiffre inventé).

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
2. Attendre que l'URL publique réponde 200 :
   `https://raw.githubusercontent.com/m01281694-del/ui-ux-pro-max-skill/claude/tiktok-video-link-reading-tb3u57/studio/videos/<id>/<id>.mp4`
3. Metricool `createScheduledPost` (blogId `8094155`, fuseau `Europe/Paris`) à l'horaire libre suivant parmi
   `cerveau.json > publication > horaires_par_defaut` (vérifier `getScheduledPosts` pour ne pas doubler) :
   - providers : `tiktok`, `instagram`
   - media : [URL publique] ; text : caption + hashtags
   - `tiktokData` : `{"privacyOption":"PUBLIC_TO_EVERYONE","isAigc":true,"title":"<titre court>"}`
   - `instagramData` : `{"type":"REEL","showReelOnFeed":true,"isAiGenerated":true}`
4. Ajouter l'entrée dans `studio/historique.json` (date, id, sujet, style, cta, fichier, publie: true, plannerUrl), commit + push.

## 5. Compte rendu
Terminer par un résumé court : sujet, style, horaire programmé, lien Metricool, et tout problème rencontré
(quota ElevenLabs épuisé → la voix Piper a pris le relais, etc.).
