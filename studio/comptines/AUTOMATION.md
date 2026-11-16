# Comptines — routine automatique (chaîne YouTube enfants)

Toutes les 5 heures, une comptine est fabriquée et publiée en **Short YouTube « conçu pour les enfants »**.
La chaîne YouTube ne reçoit **que** des comptines (jamais de marketing).

## Droits : ce qu'on publie
- **Comptines traditionnelles du domaine public** (paroles anciennes, sans auteur moderne) : liste
  `youtube_comptines.comptines_domaine_public` dans `studio/cerveau.json`. Uniquement des mélodies traditionnelles
  connues avec certitude ; en cas de doute sur la mélodie, écrire une comptine originale à la place.
- **Comptines originales** écrites pour la chaîne (thèmes : couleurs, chiffres, animaux, saisons, émotions, routines
  du quotidien, politesse…), avec une mélodie originale simple.
- **Jamais** : chansons modernes protégées, personnages, musiques, scripts ou visuels d'autres chaînes.

## 1. Choisir
- **D'abord** : s'il existe dans `studio/comptines/videos/` une comptine déjà fabriquée qui n'est pas dans l'historique, la publier (étape 4) au lieu d'en fabriquer une nouvelle.
- Lire `studio/comptines/historique.json` (ne pas republier une même chanson avant 30 publications).
- Alterner : 1 traditionnelle, puis 2 originales.
- Changer à chaque fois : `theme` (matin, nuit, etoiles, ferme, mer), `animal` (ours, chat, lapin, souris, poussin, grenouille), `bpm`, `transpose` (-3 à +3).

## 2. Écrire la chanson
Créer `studio/comptines/chansons/<id>.json` au format de `frere-jacques.json` :
- paroles : syllabes séparées par `|`, mots par des espaces, **une note par syllabe** `[nom, temps]` ;
- mélodie originale : tonalité de do, notes entre A3 et A4, surtout des pas conjoints, phrases de 4 ou 8 temps qui finissent sur do (C4) ou sol (G3/G4), refrain répété ;
- 30 à 55 secondes au total (ajuster `repetitions`) ;
- vocabulaire simple, phrases courtes, ton joyeux et bienveillant, aucun contenu effrayant ni commercial ;
- bloc `youtube` : titre (emoji + « Comptine pour enfants avec paroles »), description (paroles + hashtags #comptine #chansonpourenfant), tags.

## 3. Fabriquer et vérifier
```bash
python3 studio/comptines/make_comptine.py studio/comptines/chansons/<id>.json --stills
python3 studio/comptines/make_comptine.py studio/comptines/chansons/<id>.json
```
Regarder les images (paroles lisibles, rien de coupé, animal visible).

## 4. Publier
1. `git add studio && git commit && git push` (branche `claude/tiktok-video-link-reading-tb3u57`), vérifier que
   `https://raw.githubusercontent.com/m01281694-del/ui-ux-pro-max-skill/claude/tiktok-video-link-reading-tb3u57/studio/comptines/videos/<id>/<id>.mp4` répond 200.
2. Metricool `createScheduledPost` (blogId `8094155`, fuseau `Europe/Paris`) environ 20 minutes plus tard :
   - providers : `youtube` **uniquement** ; media : [URL] ; text : description
   - `youtubeData` : `{"title":"<titre>","type":"short","privacy":"public","category":"EDUCATION","madeForKids":true,"isAiGeneratedContent":false,"tags":[...]}`
3. Ajouter l'entrée dans `studio/comptines/historique.json`, commit + push.
