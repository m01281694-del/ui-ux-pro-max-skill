# Vendre RELANCEO — plan pour 10 000 € avant avril

## 1. Le calcul honnête

10 000 € **encaissés** d'ici fin mars, c'est-à-dire en ~4 mois de facturation (décembre → mars).
Un abonnement mensuel encaisse peu au début : il faut signer **tôt** et **beaucoup**.

| Scénario | Clients à signer (moyenne sur la période) | Encaissé sur 4 mois |
|---|---|---|
| 100 % Business (149,99 €) | ≈ 17 clients présents dès décembre | ≈ 10 200 € |
| Mix réaliste (50 % Pro, 50 % Business, ~125 €) | ≈ 20 dès décembre, ou 40 signés progressivement | ≈ 10 000 € |
| Accélérateur : paiement annuel (2 mois offerts = 10 × prix) | 7 clients Business annuels | ≈ 10 500 € encaissés immédiatement |

**Conclusion :** visez 40 à 60 entreprises signées d'ici février, en privilégiant Business, et proposez
le paiement annuel aux clients convaincus (à configurer dans Stripe : un prix annuel par offre).
Après Stripe (~2,2 % + 0,25 €), il vous reste ≈ 97 % du montant.

## 2. Qui cibler (par ordre de priorité)

Le meilleur client : **une PME de 2 à 15 personnes qui envoie des devis et perd des ventes faute de relance.**

1. **Artisans du bâtiment** (plombiers, électriciens, menuisiers, cuisinistes, couvreurs, paysagistes) :
   beaucoup de devis, peu de temps administratif. Argument : « 1 devis récupéré par mois rembourse l'abonnement. »
2. **Garages et carrosseries** : devis de réparation, clients qui ne rappellent pas.
3. **Agences immobilières et gestionnaires de biens** : demandes de visite, dossiers incomplets.
4. **Agences web / marketing, consultants, formateurs** : propositions commerciales sans réponse.
5. **Cabinets (expertise comptable, assurances, courtiers)** : pièces manquantes à relancer.

À éviter au début : grandes entreprises (cycle de vente long, exigences RGPD/achats lourdes), clients
qui veulent des SMS ou des intégrations (non développées).

## 3. Quelle offre recommander

- **Starter (49,99 €)** : indépendant seul, < 100 demandes/mois, veut juste ne plus rien perdre. Porte d'entrée.
- **Pro (99 €)** : 2-3 personnes, veut gagner du temps (modèles + IA). *À ne vendre avec l'IA qu'une fois la clé IA activée.*
- **Business (149,99 €)** : toute entreprise qui envoie des devis → **c'est l'offre à pousser**. La relance
  automatique est ce qui rapporte de l'argent au client, donc ce qui justifie le prix. *Nécessite l'envoi
  d'e-mails activé (Resend) avant de la vendre.*

Règle : présentez toujours les 3, recommandez Business, laissez Starter comme alternative « petit budget ».

## 4. Le message (30 secondes)

> « Combien de devis envoyez-vous par mois ? Et combien restent sans réponse parce que personne n'a eu le
> temps de relancer ? RELANCEO relance automatiquement vos clients après 2 ou 3 jours et s'arrête dès qu'ils
> répondent. Si ça vous fait signer un seul devis de plus par mois, l'abonnement est remboursé. On regarde
> ensemble 15 minutes ? »

Le chiffre qui parle : **« 1 devis récupéré par mois = abonnement remboursé »** (un devis d'artisan vaut
souvent 500 à 5 000 €).

## 5. Le plan d'action semaine par semaine

**Semaine 1 — être prêt à encaisser**
- Base de données, Stripe, Resend, nom de domaine, pages légales (voir README « Mettre en ligne »).
- Passer `commercial.ready` à `true` une fois prix/TVA/CGV validés (retire le bandeau « Prévisualisation »).
- Créer une page Google Business Profile + une page LinkedIn RELANCEO.

**Semaines 2 à 4 — 10 premiers clients (contact direct)**
- Listez 200 entreprises cibles dans votre ville/région (Google Maps : « plombier + ville », Pages Jaunes).
- Appelez 20 entreprises par jour (matin 8h-10h pour les artisans). Objectif : 3 démos/jour.
- Proposez une **offre de lancement** : 1er mois à 1 € ou -30 % pendant 3 mois pour les 20 premiers
  (créer un coupon Stripe). Demandez en échange un avis Google et un témoignage.
- Faites la démo en direct sur leur cas, créez leur espace pendant l'appel, importez leur fichier clients (CSV).

**Mois 2 — accélérer**
- Messages LinkedIn aux gérants (modèle ci-dessous), 20/jour.
- Parrainage : 1 mois offert au client qui en amène un autre.
- Partenariats : comptables, réseaux d'artisans (CAPEB, chambres des métiers), fournisseurs de matériaux.
- Publiez 2 contenus/semaine : « J'ai calculé combien de devis un artisan perd par an faute de relance ».

**Mois 3-4 — consolider**
- Appelez chaque client au bout de 2 semaines (aide à configurer la 1re relance = clients qui restent).
- Proposez le passage annuel aux clients satisfaits.
- Suivez tout dans `/admin.html` (revenu mensuel, prospects, objectif 10 000 €).

## 6. Modèles prêts à l'emploi

**Appel (après le message de 30 s)**
« Je vous propose 15 minutes cette semaine pour vous montrer sur vos propres devis. Mardi 9 h ou jeudi 17 h ? »

**LinkedIn / e-mail**
> Bonjour {Prénom},
> Je travaille avec des {métier} qui envoient beaucoup de devis. Le constat est souvent le même : une partie
> reste sans réponse, faute de temps pour relancer.
> J'ai créé RELANCEO : vos demandes au même endroit, et des relances automatiques qui s'arrêtent dès que le
> client répond. Un devis récupéré par mois suffit à le rentabiliser.
> Je vous montre en 15 minutes ? {lien vers /#demo}

**Relance (J+4 sans réponse)**
> Bonjour {Prénom}, je me permets de revenir vers vous — c'est justement ce que RELANCEO fait à votre place 🙂
> Voulez-vous que je vous montre ?

## 7. Objections fréquentes

| Objection | Réponse |
|---|---|
| « J'ai déjà Excel / mon agenda » | « Excel ne vous prévient pas et ne relance pas. Ici, la relance part toute seule et s'arrête dès que le client répond. » |
| « C'est cher » | « Combien vaut un devis moyen chez vous ? Un seul signé en plus par mois paie l'abonnement. Et c'est sans engagement. » |
| « Pas le temps de m'y mettre » | « Je crée votre espace et j'importe vos clients pendant l'appel : 15 minutes. » |
| « Les relances automatiques, ça fait spam » | « C'est vous qui écrivez le message, il ne part qu'aux clients qui vous ont fait une demande, avec désinscription en un clic, et il s'arrête dès qu'ils répondent. » |
| « Et mes données ? » | « Hébergées en sécurité, isolées de celles des autres entreprises, exportables à tout moment. » |

## 8. Ce qu'il ne faut PAS promettre

SMS, intégrations (Gmail, Outlook, logiciels de devis), application mobile, support 24 h/24, « illimité »,
IA tant que la clé n'est pas activée, relances automatiques tant que l'envoi d'e-mails n'est pas activé.
Promettre ce qui n'existe pas = résiliations et mauvais avis.

## 9. Indicateurs à suivre chaque semaine (dans /admin.html)

Appels passés → démos réalisées → inscriptions → abonnés payants → revenu mensuel.
Repères réalistes en prospection téléphonique B2B : 10-15 % des appels donnent une démo,
25-40 % des démos donnent un client. Pour 40 clients : ≈ 130 démos ≈ 1 000 à 1 300 appels sur 3 mois
(≈ 20 appels par jour ouvré).
