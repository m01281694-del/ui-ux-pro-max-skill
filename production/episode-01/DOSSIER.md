# Épisode 01 — Comment atteindre 10 000 € par mois grâce au marketing digital ?

Format : 1080×1920, 30 i/s, H.264 + AAC, 88.7 s. Voix : ElevenLabs (eleven_v3, FR). Musique et sound design : synthétisés pour ce montage (aucun droit tiers).

## Découpage

### HOOK — 0.3 s → 9.7 s

**Voix off :** Dix mille euros par mois… grâce au marketing digital. Possible ? Oui. Facile ? Absolument pas. Voici ce que personne ne te montre.

**Image :** Vide sombre, sol miroir à grille violette. Caméra qui fonce à travers un tunnel de chiffres lumineux vers un personnage 3D (mannequin laqué, contre-jour violet). « 10 000 € » en or 3D s'assemble lettre par lettre. Glitch + secousse caméra sur « Absolument pas ». Orbite finale + titre d'épisode.

### LE PROBLÈME — 9.7 s → 18.4 s

**Voix off :** Tu travailles plus… sans gagner plus. Ton temps a une limite. Ton salaire aussi. Et en ligne, on te vend des raccourcis qui n'existent pas.

**Image :** Open space infini de bureaux identiques (aspect froid). Horloge géante chromée dont les aiguilles s'emballent, l'arc se remplit puis se verrouille sur « limite ». Barres de salaire violettes qui s'écrasent contre un plafond de verre (étincelles). Fausses pubs holographiques « 10K€ EN 7 JOURS / SANS EFFORT / ARGENT FACILE » barrées puis pulvérisées.

### LA RÉVÉLATION — 18.4 s → 31.0 s

**Voix off :** La vraie différence ? Un produit qui se vend sans toi. Une formation. Un produit numérique. De l'affiliation. Du contenu qui attire des clients, même pendant que tu dors. Et une marque personnelle qui crée la confiance.

**Image :** Smartphone 3D qui arrive en rotation devant un portail lumineux. L'écran affiche des commandes de démonstration. Six panneaux holographiques en hélice (Formation, Produit numérique, Affiliation, Contenu, Clients, Marque perso), chacun relié au téléphone par un faisceau de données, synchronisés sur la voix.

### LA DÉMONSTRATION — 31.0 s → 45.5 s

**Voix off :** Exemple simulé. Une vidéo fait dix mille vues. Deux pour cent cliquent : deux cents visiteurs. Trois pour cent achètent une formation à cent euros. Six ventes. Six cents euros. Ce n'est pas de la magie. C'est un tunnel. Et chaque étape se mesure.

**Image :** Entonnoir holographique à 4 niveaux, particules qui s'écoulent et sont filtrées à chaque étage. Étiquettes 10 000 vues → 2 % / 200 visiteurs → 3 % / 6 ventes → 600 €. Pièces d'or qui sortent en bas. Tableau de bord 3D avec compteurs et courbe en temps réel. Badge permanent « SIMULATION · CHIFFRES FICTIFS ».

### LA STRATÉGIE — 45.5 s → 59.0 s

**Voix off :** La méthode, en sept étapes. Choisis une niche. Trouve un vrai problème. Construis une offre utile. Crée du contenu pertinent. Attire ton audience. Installe un système de vente. Et améliore tout… grâce aux données.

**Image :** Ville futuriste nocturne sur sol miroir. Sept tours lumineuses émergent du sol, une par étape, avec onde de choc et faisceau. Grue caméra ascendante. Compteur « ÉTAPE n / 7 ». Sur « données », une ligne dorée relie le sommet de toutes les tours.

### L'OBJECTIF 10 000 € — 59.0 s → 75.7 s

**Voix off :** Alors, dix mille euros, concrètement ? Deux cents ventes à cinquante euros. Cent ventes à cent euros. Ou cinquante ventes à deux cents euros. Attention : c'est du chiffre d'affaires, avant frais, charges et impôts. Pas un revenu garanti. Il faut du temps, une vraie offre, et des clients.

**Image :** « 10 000 € » doré qui explose en étincelles, puis trois colonnes de pièces tombent et s'empilent jusqu'à la même ligne d'objectif : 200 × 50 €, 100 × 100 €, 50 × 200 €. Carte d'avertissement (chiffre d'affaires théorique, avant frais, charges et impôts, pas un revenu garanti), puis TEMPS · OFFRE · CLIENTS.

### CONCLUSION + CTA — 75.7 s → 88.7 s

**Voix off :** Le marketing digital ne garantit pas la réussite. Mais savoir créer de la valeur, communiquer… et vendre… c'est une compétence qui peut tout changer. Abonne-toi. La suite arrive.

**Image :** Cristal iridescent qui explose en éclats géométriques sur « Mais », puis se reconstruit sur « vendre » (onde de choc + rayons). Titre « CRÉER. COMMUNIQUER. VENDRE. », puis CTA « ABONNE-TOI » + @manu.digi0 + teasing de l'épisode 2.

## Textes de publication

**TikTok / Instagram Reels**

```
10 000 €/mois grâce au marketing digital ? Possible. Facile ? Absolument pas.

Le tunnel de vente expliqué, la méthode en 7 étapes et le vrai calcul derrière l'objectif.
⚠️ Chiffres illustratifs : chiffre d'affaires théorique, avant frais, charges et impôts. Aucun revenu garanti.

Abonne-toi : l'épisode 2 arrive (trouver une niche rentable).

#marketingdigital #entrepreneuriat #businessenligne #produitsnumeriques #personalbranding #formationenligne #venteenligne
```

**YouTube Shorts — titre :** Comment atteindre 10 000 € par mois grâce au marketing digital ? #shorts


## Fichiers

- `episode01_9x16.mp4` : master vertical 1080×1920, 30 i/s, 88,8 s, -14,5 LUFS (TikTok / Reels / Shorts)
- `episode01_16x9.mp4` : version horizontale 1920×1080 (vidéo centrée sur fond flouté)
- `cover.jpg` : image de couverture
- `source/` : moteur 3D (Three.js : `index.html` + `film.js`), timeline et sous-titres synchronisés, scripts voix/audio/rendu

## Refaire le rendu

Les sources ont été produites dans un dossier de travail avec `npm i three@0.170.0 @fontsource/sora @fontsource/inter @fontsource/jetbrains-mono`.
Servez le dossier en HTTP (`python3 -m http.server 8765`), puis lancez `node render.js <image_début> <image_fin> sortie.mp4` (Playwright + Chromium).
Les voix (`audio/vo/*_edit.wav`) ne sont pas versionnées ; `tts.py` + `vo_edit.py` les régénèrent avec une clé ElevenLabs.
