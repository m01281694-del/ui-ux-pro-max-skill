# ELM PUBLISHING — Étude de marché (v1)

*Date : 20 novembre 2026. Marché principal visé : Amazon.fr (livres en français), puis Amazon.be, .ca et .ch.*

## 1. Méthode et limites (à lire en premier)

**Ce que j'ai pu vérifier.** Les règles officielles de KDP (prix, redevances, coûts d'impression, marges, dos, déclaration IA). Elles ont été consultées le 20/11/2026 sur les pages d'aide KDP listées en section 5.

**Ce que je n'ai PAS pu vérifier.** Amazon bloque la lecture automatique de ses pages de recherche : 5 requêtes testées sur Amazon.fr ont toutes renvoyé une erreur HTTP 503. Je n'ai donc **aucune donnée** sur :
- les ventes ;
- le classement (BSR) ;
- le nombre d'avis ;
- les prix exacts des concurrents.

Je n'invente rien. Les choix ci-dessous reposent donc sur des **critères qualitatifs explicites**. Ils doivent être confirmés par l'observation manuelle de la section 4 (environ 10 minutes, voir `grille_observation_concurrents.csv`).

**Critères de notation**, chacun de 1 à 5 :
- **D** : demande probable (besoin récurrent, public large, recherches naturelles) ;
- **C** : concurrence (5 = faible ou datée) ;
- **V** : valeur que nous pouvons réellement apporter ;
- **P** : coût de production à 0 € (5 = tout réalisable avec nos outils gratuits) ;
- **R** : risque (5 = faible : peu de faits datés, peu de risques juridiques ou de santé) ;
- **S** : possibilité d'en faire une série.

## 2. Niches évaluées

| Domaine | Niche | D | C | V | P | R | S | Total /30 | Commentaire |
|---|---|---|---|---|---|---|---|---|---|
| Éducation | Méthodes de révision fondées sur la recherche (collège/lycée) | 5 | 4 | 5 | 5 | 5 | 4 | **28** | Besoin récurrent chaque année (brevet, bac, partiels). La recherche en psychologie cognitive est solide et vérifiable. Les parents achètent. |
| Sport | Cahier d'entraînement de basket en solo (10–18 ans) | 4 | 4 | 4 | 5 | 5 | 5 | **27** | Le basket est très populaire chez les jeunes en France. Un cahier pratique (exercices et suivi) est un format peu couvert en français. La série se déploie facilement : football, tennis… |
| Business / IA | Utiliser l'IA pour lancer et développer une petite activité | 5 | 3 | 4 | 5 | 3 | 4 | **24** | Forte demande, mais une concurrence qui grandit vite et un risque d'obsolescence : il faut dater et mettre à jour. S'aligne avec la formation VIP. |
| Business | Dropshipping | 4 | 2 | 3 | 5 | 2 | 3 | 18 | Marché saturé, promesses de revenus fréquentes (risque d'image), sujet très daté. |
| Business | Google Ads | 3 | 3 | 3 | 4 | 2 | 3 | 18 | L'interface change souvent et le sujet devient vite obsolète. |
| Business | TikTok / Instagram pour commerçants | 4 | 3 | 4 | 5 | 3 | 4 | 23 | Bonne option, mais intégrée au livre IA (chapitre contenu). |
| Sport | Football — tactique | 5 | 2 | 3 | 5 | 4 | 4 | 23 | Très concurrentiel en français, beaucoup d'ouvrages d'éditeurs. |
| Sport | Course à pied — plans | 4 | 2 | 3 | 5 | 3 | 4 | 21 | Très concurrentiel, et touche à la santé (prudence). |
| Dév. perso | Habitudes / discipline | 5 | 1 | 3 | 5 | 4 | 3 | 21 | Saturé : nombreux best-sellers traduits. |
| Dév. perso | Concentration (téléphone, écrans) pour ados | 4 | 3 | 4 | 5 | 4 | 3 | 23 | Intégré au livre 1 (chapitre attention). |
| Loisirs | Cuisine étudiante petit budget | 4 | 2 | 3 | 3 | 4 | 4 | 20 | Concurrence forte, les photos de qualité sont difficiles à 0 €. |
| Loisirs | Jardinage en balcon | 3 | 3 | 3 | 3 | 3 | 4 | 19 | Les photos et la précision botanique demandent des vérifications de terrain. |
| Éducation | Mathématiques (exercices) | 4 | 2 | 3 | 4 | 4 | 4 | 21 | Concurrence forte (éditeurs scolaires). |

## 3. Les trois niches retenues

### Livre 001 — Éducation : « Réviser moins, retenir plus »
- **Pourquoi :** c'est la meilleure note. Le besoin est universel et renouvelé chaque année. Le contenu repose sur des études réelles et citables (pratique de récupération, répétition espacée, entrelacement), souvent mal connues des élèves.
- **Problème résolu :** l'élève relit et surligne, passe des heures à réviser et oublie tout au contrôle.
- **Différence :**
  - méthodes **sourcées** (références réelles en fin de livre) ;
  - ton direct pour les 13–18 ans ;
  - un **plan de 30 jours** et des fiches à remplir ;
  - un chapitre pour les parents.
- **Prix envisagé :** broché 12,90 € ; Kindle 4,99 €.
- **Risques :** concurrence d'éditeurs scolaires. Atténuation : angle « science + plan d'action » et titre orienté résultat.

### Livre 002 — Sport : « Basket : le cahier d'entraînement solo »
- **Pourquoi :** sport très pratiqué par les jeunes. Le format « cahier » (exercices, schémas, suivi) se distingue des livres théoriques. Le contenu est intemporel.
- **Problème résolu :** le joueur veut progresser entre les entraînements du club, mais ne sait pas quoi faire seul.
- **Différence :**
  - 60 exercices réalisables avec un ballon et un panier ;
  - des schémas clairs ;
  - un programme de 8 semaines ;
  - des pages de suivi.
- **Prix envisagé :** broché 14,90 € (grand format) ; Kindle 4,99 €. Le format papier est le cœur du produit, car on écrit dedans.
- **Risques :** blessures. Atténuation : échauffement, progressivité et avertissement. Les pages de suivi conviennent mal au Kindle.

### Livre 003 — Business : « L'IA, ton assistant business »
- **Pourquoi :** forte demande et cohérence avec ta marque (marketing digital, formation VIP). Le livre peut devenir une porte d'entrée vers la formation.
- **Problème résolu :** l'indépendant ou le débutant a entendu parler de l'IA, mais ne sait pas quoi lui demander concrètement pour trouver des clients, créer du contenu et gagner du temps.
- **Différence :**
  - méthode pas à pas ;
  - **100 prompts prêts à l'emploi** classés par tâche ;
  - limites et vérification des réponses expliquées honnêtement ;
  - **aucune promesse de revenus** ;
  - informations datées (novembre 2026).
- **Prix envisagé :** broché 14,90 € ; Kindle 6,99 €.
- **Risques :** les outils évoluent vite (mise à jour annuelle prévue) et la concurrence augmente. Les noms de marques (ChatGPT, Claude, Gemini) sont cités seulement pour désigner les outils, sans logo.

## 4. Observation manuelle à faire (10 minutes)
Remplir `grille_observation_concurrents.csv` en recherchant sur Amazon.fr les 3 requêtes indiquées. Pour chaque requête, relever les 10 premiers livres :
- titre ;
- prix ;
- nombre d'avis ;
- date de publication ;
- éditeur ;
- défauts cités dans les avis négatifs.

Si une requête montre plus de 5 livres récents avec plus de 500 avis chacun, me le signaler : j'ajusterai l'angle du livre.

## 5. Règles KDP vérifiées (pages officielles consultées le 20/11/2026)
- **Redevance broché** (G201834330) :
  - 60 % du prix si le prix est ≥ 9,99 € ;
  - 50 % si le prix est ≤ 9,98 € ;
  - on retire ensuite le coût d'impression ;
  - Distribution étendue : 40 %.
- **Coût d'impression** (G201834340), noir et blanc, marchés en euros :
  - 24–110 pages : 2,05 € (format standard) ou 2,48 € (grand format) ;
  - 110–828 pages : 0,75 € + 0,012 €/page (standard) ou 0,75 € + 0,016 €/page (grand format, plus de 6,12" de large ou plus de 9" de haut).
- **Redevance ebook** (G200644210, G200634560, G200634500) :
  - 70 % entre 2,69 € et 12,99 €, moins les frais de livraison de 0,12 €/Mo (Amazon.fr) ;
  - sinon 35 %.
- **Marges intérieures** (GVBQ3CMEQW3W2VL6) :
  - petit fond (côté reliure) : 0,375" pour 24–150 pages et 0,5" pour 151–300 pages ;
  - extérieur : au moins 0,25" sans fond perdu ;
  - fond perdu : 0,125".
- **Dos** (G201953020) : 0,002252"/page en papier blanc et 0,0025"/page en papier crème. Le texte sur le dos est possible au-delà de 79 pages, avec 0,0625" de marge de chaque côté.
- **IA** (G200672390) :
  - un contenu **généré par IA** (texte, images, traductions) **doit être déclaré** à la publication ;
  - un contenu seulement **assisté** par IA (écrit par l'auteur, puis amélioré par l'IA) n'a pas à l'être ;
  - nos livres sont rédigés et illustrés par IA : **ils doivent être déclarés « générés par IA » (texte et images)**.
- **Âge minimum :** il n'apparaît pas sur les pages lues. Le compte doit être ouvert par un parent ou un représentant légal majeur (vérifier les Conditions générales KDP, page G200627430).
