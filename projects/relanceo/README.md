# RELANCEO — Système d'abonnements, droits, quotas et automatisations

> **État : développé et testé localement, NON prêt à être commercialisé.**
> Le paiement, l'envoi d'e-mails et l'IA sont **désactivés par défaut** et n'ont jamais été appelés
> en conditions réelles. Prix et quotas sont des **hypothèses commerciales** non validées
> (`commercial.ready = false` dans `config/plans.json` : la page tarifs affiche un bandeau « Prévisualisation »).

Le dépôt ne contenait aucun code RELANCEO avant ce travail : ce dossier contient donc le socle
nécessaire pour faire réellement fonctionner et tester le système d'abonnements (demandes, clients,
équipe, IA, automatisations), et pas seulement la couche facturation.

```bash
cd projects/relanceo
npm install
npm test            # 63 tests (Postgres embarqué PGlite, aucun service externe)
npm run dev         # http://localhost:3000/pricing.html — affiche 3 jetons de démo (Starter/Pro/Business)
npm run economics   # coûts et marges par offre (HT et hypothèse TTC)
```

Prérequis : Node.js 22+. Dépendances : `@electric-sql/pglite` (Postgres en WebAssembly) et
`@anthropic-ai/sdk` (uniquement si l'IA est activée).

---

## 1. Fonctionnalités Starter (49 €/mois)

| Fonctionnalité | Permission | Où c'est contrôlé |
|---|---|---|
| Centralisation des demandes clients (création, liste, détail) | `requests.create`, `requests.view` | route + `app.create_request` (quota) + RLS |
| Historique de chaque demande (création, statut, priorité, échanges) | `requests.view` | `request_events` |
| Gestion des statuts (nouvelle, en cours, en attente client, clôturée) | `requests.manage` | route + RLS |
| Suivi manuel : journaliser un appel, un e-mail envoyé ou une réponse reçue | `requests.manage` | RLS (`origin = 'manual'` seulement) |
| Rappels manuels (pour l'équipe, **aucun envoi au client**) | `reminders.manual` | route + RLS |
| Fiches clients | `customers.manage` | route + RLS |
| Statistiques essentielles (répartition par statut, créées/clôturées sur la période, rappels échus) | `statistics.basic` | route |
| Priorités « normale » et « haute » | — | `priorities.advanced` requis pour les autres |
| Consultation de l'abonnement, consommation, export des données | `billing.*`, `data.export` | route |
| 1 collaborateur, 100 demandes / mois | quotas | base |

Exclu (vérifié par les tests) : IA, modèles, priorités avancées, invitations, **toute automatisation**.

## 2. Fonctionnalités Pro (99 €/mois)

Tout Starter, plus :

| Fonctionnalité | Permission |
|---|---|
| 500 demandes / mois, jusqu'à 3 collaborateurs (invitation, rôles admin/membre, retrait, réactivation) | `team.invite`, `team.manage` |
| Modèles de réponses personnalisables (création, modification, validation par un admin) | `templates.manage` |
| Résumé d'une demande par IA | `ai.summary` |
| Classification et priorité **proposées** par IA (jamais appliquées automatiquement) | `ai.classification` |
| Brouillon de réponse par IA (renvoyé à l'utilisateur, **jamais envoyé**) | `ai.suggestions` |
| 1 000 opérations IA / mois | quota |
| Statistiques avancées : délai moyen de 1re réponse, taux de clôture, répartition par priorité / catégorie, tendance 8 semaines | `statistics.advanced` |
| Gestion avancée des priorités : 4 niveaux, échéance de traitement, file triée par urgence | `priorities.advanced` |

Exclu : automatisations de relance (y compris via l'API ou la base — testé).
L'IA est **développée mais non activée** : sans `AI_PROVIDER=anthropic` + clé, les appels renvoient
« L'assistance IA n'est pas encore configurée » et la page tarifs affiche « activation en cours ».

## 3. Fonctionnalités Business (149 €/mois)

Tout Pro, plus :

| Fonctionnalité | Détail |
|---|---|
| Automatisations de relance configurables | déclencheur « pas de réponse du client », délai 24 h → 30 jours, 1 à 5 tentatives, conditions sur le statut et la priorité, modèle de message |
| Activation encadrée | modèle **validé par un admin** + **autorisation explicite** horodatée (`authorized_by`, `authorized_at`) ; toute modification d'une règle active la remet en pause |
| Arrêt automatique | réponse du client (webhook entrant signé ou réponse journalisée), demande clôturée, client désinscrit, pause d'urgence de l'entreprise, interrupteur global, abonnement inactif |
| Anti-doublon | contrainte unique (règle, demande, tentative), une seule relance en attente par demande, réservation atomique du job, clé d'idempotence transmise au prestataire e-mail, job interrompu → « revue humaine » (jamais renvoyé automatiquement) |
| Limitation de fréquence | 1 relance automatique par client et par 24 h, 50 envois / heure / entreprise (réglable) |
| Erreurs d'envoi | 3 essais avec délai croissant, puis échec journalisé + notification ; un envoi en échec n'est pas décompté |
| Historique | jobs (statut, raison, tentatives, erreur) + statut du message envoyé ; événements dans l'historique de la demande |
| Désinscription | lien dans chaque relance + en-têtes `List-Unsubscribe` (désinscription en un clic) |
| 10 collaborateurs, 3 000 demandes, 3 000 opérations IA, 6 000 relances, 20 règles actives / mois | quotas |
| Support prioritaire | **permission présente, processus de support NON organisé** (affiché « activation en cours ») |
| Offre personnalisée au-delà | dérogation par entreprise (`tenant_limit_overrides`), posée par un opérateur, sans changement de code |

L'envoi réel exige `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` **et**
`AUTOMATIONS_ENABLED=true`. Par défaut, aucune relance ne peut partir.

## 4. Quotas effectivement configurés (`config/plans.json`)

| Métrique | Starter | Pro | Business | Comportement au dépassement |
|---|---|---|---|---|
| Demandes / période | 100 | 500 | 3 000 | blocage + proposition d'offre supérieure (offre personnalisée au-delà de Business) |
| Collaborateurs (actifs + invitations en attente) | 1 | 3 | 10 | idem |
| Opérations IA / période | 0 | 1 000 | 3 000 | idem |
| Relances automatiques envoyées / période | 0 | 0 | 6 000 | job ignoré (`monthly_send_quota_reached`) |
| Règles d'automatisation actives | 0 | 0 | 20 | activation refusée |

- Alertes à **70 %, 85 %, 100 %**, une seule fois par métrique et par période (notification in-app).
- Période = cycle d'abonnement (dates du prestataire) ; si le renouvellement tarde, la période avance
  quand même mois par mois depuis l'ancre de facturation → réinitialisation garantie.
- Historique de consommation conservé (`usage_counters`, `usage_events`).
- Aucune mention « illimité » nulle part (test automatique sur la page tarifs).
- Modifier une valeur = éditer `config/plans.json` et redémarrer : la base est resynchronisée au démarrage.
  **Ne pas le faire en production sans validation commerciale et information des clients.**

## 5. Architecture

```
config/plans.json          SOURCE UNIQUE : offres, prix, permissions, quotas, rôles, règles d'accès, textes d'upsell
config/costs.json          hypothèses de coûts (FinOps)
db/migrations/
  001_schema.sql           tables multi-entreprises (tenant_id partout)
  002_functions.sql        Entitlements System en base : app.tenant_access_mode, app.tenant_has_entitlement,
                           app.has_permission, app.get_entitlements, app._consume (quotas atomiques),
                           app.create_request, app.consume_ai, app.invite_member, app.enforce_plan_limits,
                           triggers (audit des abonnements, garde des automatisations, arrêt des relances…)
  003_rls.sql              Row Level Security + privilèges (rôles "authenticated" / "service_role", compatibles Supabase)
src/
  plans.js                 chargement/validation du catalogue (refuse un Starter/Pro avec automatisation)
  entitlements.js          lecture du verdict de la base, erreurs explicites (plan_required / subscription_inactive / forbidden_role) + upsell
  db.js                    transactions asUser (RLS) / asService (serveur)
  http/server.js, routes.js API ; chaque route déclare sa permission
  billing/                 signature des webhooks, traitement des événements, prestataires (désactivé / Stripe / test)
  automations/engine.js    planificateur des relances
  ai/                      passerelle IA (quota, coût, remboursement) + fournisseur Claude
  email/provider.js        désactivé / Resend / mémoire (tests)
  costs.js                 journal des coûts + alertes internes
public/                    page tarifs + tableau de bord (aucune règle d'abonnement côté navigateur)
scripts/                   dev, economics, admin (opérateur)
test/                      63 tests
```

**Décision d'accès** = rôle de l'utilisateur ∩ permissions de l'offre ∩ statut de l'abonnement :

| Statut | Accès |
|---|---|
| `active` (y compris résiliation programmée jusqu'à l'échéance) | complet |
| `past_due` | complet pendant 7 jours, puis lecture seule |
| `incomplete`, `suspended`, `canceled`, aucun abonnement, période échue depuis > 3 jours sans renouvellement | lecture seule : consultation, export, facturation |

**Changements d'offre**
- Montée en gamme : demande transmise au prestataire → activation **uniquement** à réception du webhook
  signé → données, historique, compte inchangés.
- Rétrogradation : prévisualisation (`GET /api/billing/preview?plan=…`) listant permissions perdues,
  automatisations mises en pause, accès collaborateurs suspendus, modèles conservés ; application au
  **renouvellement** (`scheduled_plan_id`). À l'application : règles `paused_by_plan` (jamais supprimées,
  jamais relancées automatiquement après une remontée), relances planifiées annulées, collaborateurs
  excédentaires `suspended_over_limit` (les plus récents, jamais le propriétaire, réactivables).
- Annulation : à l'échéance, puis lecture seule ; données conservées ; réactivation possible.
- Échec de paiement → `past_due` → lecture seule après 7 jours ; paiement → réactivation.
- Remboursement : enregistré + alerte interne, sans effet automatique sur l'accès.

**Facturation (préparée, non activée)** — `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER|PRO|BUSINESS`, `APP_URL`. Aucune donnée de carte n'est
manipulée (Stripe Checkout). Webhooks traités : `customer.subscription.created|updated|deleted`,
`invoice.paid|payment_succeeded|payment_failed`, `charge.refunded` ; `checkout.session.completed` est
volontairement ignoré.

## 6. Règles de sécurité

1. **Trois barrières indépendantes** : route (`requirePermission`), base (RLS + fonctions `SECURITY DEFINER`
   qui revérifient), triggers (règles impossibles à contourner même par le rôle serveur, ex. une règle
   d'automatisation ne peut pas être créée pour une entreprise non Business).
2. L'utilisateur n'a **aucun droit d'écriture** sur `subscriptions`, `plan_*`, `usage_*`,
   `tenant_limit_overrides`, `billing_events`, `cost_ledger`, `sessions` (vérifié en test).
3. La création de demandes et la consommation IA passent **uniquement** par des fonctions qui décomptent le quota
   (INSERT direct interdit). `app._consume` / `app._refund` ne sont pas exécutables par un utilisateur.
4. Quotas atomiques : événement à clé unique inséré d'abord (anti double comptage) puis `UPDATE … WHERE used + n <= limite`.
   Places et règles actives : verrou sur la ligne de l'entreprise.
5. L'entreprise active est choisie parmi les adhésions **actives** de l'utilisateur (`X-Tenant-Id` vérifié) ;
   `tenant_id` est immuable (trigger) ; un client d'une autre entreprise ne peut être rattaché.
6. Webhooks : signature HMAC-SHA256 vérifiée sur le corps brut, comparaison à temps constant, tolérance 5 min,
   idempotence par identifiant d'événement, événements anciens ignorés, offre déduite du prix (jamais d'une
   métadonnée), client prestataire déjà lié prioritaire sur la métadonnée.
7. Toute modification d'abonnement est journalisée (`subscription_audit_log`, trigger) avec l'acteur.
8. Les clés secrètes ne sont lues que côté serveur ; le navigateur ne reçoit que des intentions et des URL de paiement.
9. En-têtes de sécurité (CSP, `nosniff`, `frame-ancestors 'none'`), limite de 100 ko par requête, identifiants
   validés, limitation de débit (en mémoire, par instance).
10. Jetons de session stockés hachés (SHA-256).

## 7. Tests exécutés et résultats

Commande : `npm test` — exécutée le 26/11/2026 : **63 tests, 63 réussis, 0 échec** (≈ 18 s).

| Fichier | Tests | Couverture |
|---|---|---|
| `starter.test.mjs` | 7 | création/gestion dans la limite, stats essentielles, refus Pro (IA, modèles, priorités, équipe), refus automatisations via API **et** via la base, quota 100 + alertes 70/85/100, invitation refusée en SQL |
| `pro.test.mjs` | 8 | fonctions Pro, IA (idempotence, aucun envoi, priorité non appliquée, coût journalisé), panne IA non décomptée, message Business dédié, contournements (corps falsifié, écriture directe d'abonnement/quotas/règles/messages automatiques), 3 places, quota 500, quota IA |
| `business.test.mjs` | 11 | modèle validé + autorisation exigés, délai, une seule relance pour deux passages simultanés, 2e tentative puis arrêt, arrêt sur réponse (webhook signé ; signature falsifiée refusée), arrêt sur clôture, désinscription / pause d'urgence / interrupteur global, erreurs temporaires et définitives, quota d'envois, 20 règles, modèle modifié → règles en pause, rôles, 10 places |
| `lifecycle.test.mjs` | 15 | sans abonnement, signatures invalides/périmées/corps modifié, checkout seul n'active rien, Starter→Pro→Business, Starter→Business, rétrogradation à l'échéance (rien supprimé), échec de paiement + grâce + réactivation, annulation/expiration/réactivation, renouvellement et remise à zéro, période qui avance sans webhook, idempotence + désordre + prix inconnu, remboursement, panne / désactivation du prestataire, falsification de plan, automatisation stoppée quand l'abonnement devient inactif |
| `security.test.mjs` | 8 | isolation API et RLS entre entreprises (lecture, écriture, fonctions, tables internes), en-tête d'entreprise falsifié, auto-attribution Business / propriétaire, retrait d'un collaborateur, authentification, entrées invalides, jeton de réponse inconnu |
| `concurrency.test.mjs` | 5 | 30 créations simultanées pour 10 places, double clic idempotent, invitations simultanées, IA simultanée, activations simultanées au plafond |
| `catalog.test.mjs` | 9 | validation bloquante du catalogue, quotas, base = catalogue, chaque fonctionnalité annoncée protégée par une route, page tarifs sans promesse interdite ni prix en dur, fonctionnalités non configurées signalées, rentabilité, alerte FinOps, offre personnalisée |

Vérification visuelle (Playwright) de la page tarifs (bureau + mobile 390 px, sans débordement) et de la
fenêtre d'upsell du tableau de bord.

**Non testé** (honnêtement) : appels réels à Stripe, Resend et l'API Claude ; Postgres multi-connexions
(PGlite sérialise les transactions — les garanties de verrouillage reposent sur la sémantique Postgres
standard et restent à vérifier sur l'infrastructure cible) ; politiques RLS sur un vrai projet Supabase ;
charge / performance ; accessibilité au lecteur d'écran.

## 8. Bugs et limites connus

- Limitation de débit en mémoire : inefficace avec plusieurs instances (à déplacer vers Redis/équivalent).
- Le planificateur de `npm run dev` est un `setInterval` : en production, un cron unique est nécessaire
  (le verrouillage par job évite les doublons, mais pas la charge inutile).
- Pendant le délai de grâce `past_due` (7 jours), les automatisations Business continuent de s'exécuter
  (choix à confirmer).
- Les fréquences « 1 relance / client / 24 h » et « 3 essais » sont codées en dur dans `engine.js`.
- Le jeton d'invitation est renvoyé à l'administrateur (aucun e-mail d'invitation n'est envoyé).
- Le webhook entrant (réponses clients) attend un format générique `{reply_token, subject, text}` signé :
  un adaptateur pour le prestataire réel reste à écrire.
- Sur le tableau de bord, une jauge à 100 % (ex. « 1 / 1 collaborateur » en Starter) s'affiche en rouge, ce
  qui peut paraître alarmant alors que c'est l'état normal.

## 9. Non développé (ne pas annoncer)

- Authentification de production (inscription, connexion, mot de passe, réinitialisation) : seuls des jetons
  de démonstration existent. Brancher Supabase Auth : `app.current_user_id()` lit déjà `request.jwt.claims`.
- Parcours d'inscription + paiement de bout en bout (le bouton « Demander » mène à l'espace client).
- Envoi de réponses aux clients depuis RELANCEO hors automatisations (le suivi manuel journalise seulement).
- Réception d'e-mails entrants réelle, factures / reçus dans l'interface, portail client Stripe.
- Organisation du support prioritaire (outil, délais) — affiché « activation en cours ».
- SMS, multi-entreprises par compte dans l'interface, multi-sites : **rien n'est développé ni annoncé**.
- Suppression / anonymisation des données après résiliation, export RGPD par personne.
- Tableau de bord interne des coûts (les données et alertes existent : `cost_ledger`, `internal_alerts`).

## 10. Estimation des coûts par abonnement (€/mois, hypothèses `config/costs.json`)

Hypothèses : IA `claude-opus-5-5` à 4 $ / 20 $ par million de jetons, 1 800 jetons en entrée + 450 en sortie
par opération → **0,0149 € / opération** ; e-mail 0,0009 € ; Stripe 1,5 % + 0,25 € + 0,7 % Billing ;
support 35 €/h (10 / 15 / 30 min par client et par mois) ; 68,50 € de frais fixes répartis sur 50 clients.
Scénario « typique » = 40 % des quotas consommés, « plafond » = 100 %.

| Offre | IA | E-mails | Paiement | Support | Fixe | **Total typique** | **Total plafond** |
|---|---|---|---|---|---|---|---|
| Starter | 0 | 0 | 1,33 | 5,83 | 1,37 | **8,53** | **8,53** |
| Pro | 5,96 / 14,90 | 0 | 2,43 | 8,75 | 1,37 | **18,51** | **27,45** |
| Business | 17,88 / 44,71 | 2,16 / 5,40 | 3,53 | 17,50 | 1,37 | **42,44** | **72,51** |

## 11. Estimation des marges

| Offre | Prix | Marge typique (HT) | Marge au plafond (HT) | Si les prix sont TTC (plafond) |
|---|---|---|---|---|
| Starter | 49 € | 40,47 € (82,6 %) | 40,47 € (82,6 %) | 32,30 € (79,1 %) |
| Pro | 99 € | 80,49 € (81,3 %) | 71,55 € (72,3 %) | 55,05 € (66,7 %) |
| Business | 149 € | 106,56 € (71,5 %) | 76,49 € (51,3 %) | 51,66 € (**41,6 %**, alerte < 50 %) |

Lecture FinOps :
- Aucune offre n'est déficitaire avec ces hypothèses, même au plafond.
- **Business est le point de vigilance** : au plafond, l'IA + les e-mails représentent 33,6 % du prix
  (seuil d'alerte interne : 35 %). Si les prix affichés s'entendent TTC, la marge tombe à 41,6 %.
- Levier principal : le modèle IA. Avec `claude-haiku-5-5` (0,10 $ / 0,50 $), le coût par opération
  passerait à ~0,0004 €. **Non appliqué** : c'est une décision produit à prendre après évaluation de la
  qualité sur des demandes réelles.
- Le support pèse plus que l'IA pour Starter et Pro : le chiffrer réellement est prioritaire.
- Les hypothèses de volume (50 clients) font varier la part fixe ; recalculer avec `npm run economics`.

## 12. Points à valider avant toute commercialisation

**Commercial / financier**
- [ ] Prix HT ou TTC, TVA, mentions de prix (le site affiche « mentions à confirmer »).
- [ ] Quotas définitifs (notamment Business 3 000 / 3 000 / 6 000 / 20) et règle au dépassement.
- [ ] Coûts réels : contrats Stripe, e-mail, hébergement, base, temps de support mesuré.
- [ ] Choix du modèle IA après évaluation qualité/coût.
- [ ] Délai de grâce après échec de paiement (7 jours) et comportement des automatisations pendant ce délai.
- [ ] Passer `commercial.ready` à `true` seulement après ces validations.

**Juridique / RGPD** (à faire vérifier par un professionnel)
- [ ] CGV/CGU : renouvellement tacite, résiliation, rétrogradation, remboursements, droit applicable.
- [ ] Politique de confidentialité, registre des traitements, DPA avec les clients (RELANCEO est sous-traitant
      des données de leurs clients), liste des sous-traitants (hébergeur, Stripe, e-mail, Anthropic) et transferts hors UE.
- [ ] Durée de conservation des données après résiliation (actuellement : aucune suppression automatique).
- [ ] Relances automatiques : qualification (suivi d'une demande existante vs prospection), base légale,
      règles applicables aux communications électroniques (B2C/B2B), mentions d'identification de l'expéditeur.
- [ ] Usage de l'IA : information des utilisateurs, données transmises au fournisseur.

**Technique**
- [ ] Déployer sur Postgres/Supabase réel, rejouer les migrations, vérifier les RLS et les tests de concurrence
      avec plusieurs connexions.
- [ ] Brancher l'authentification de production et le parcours d'inscription.
- [ ] Tester Stripe en mode test (Checkout, webhooks, rétrogradation à l'échéance via Subscription Schedule).
- [ ] Tester Resend (domaine expéditeur, SPF/DKIM/DMARC) et l'adaptateur de réponses entrantes.
- [ ] Tester l'API Claude réelle (`AI_PROVIDER=anthropic`) sur un jeu de demandes.
- [ ] Cron du planificateur, supervision, sauvegardes, limitation de débit partagée.
- [ ] Organiser le support prioritaire avant de l'afficher sans réserve (`SUPPORT_PROCESS_READY=true`).

---

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `BILLING_PROVIDER` | `stripe` pour activer le paiement | désactivé |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PRO/BUSINESS`, `APP_URL` | Stripe | — |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `REPLY_DOMAIN` | envoi des relances | désactivé |
| `INBOUND_WEBHOOK_SECRET` | réception signée des réponses clients | désactivé |
| `AUTOMATIONS_ENABLED` | interrupteur global des relances | `false` |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` | assistance IA | désactivé, `claude-opus-5-5` |
| `SUPPORT_PROCESS_READY` | affiche le support prioritaire sans réserve | `false` |
| `RELANCEO_DATA_DIR` | dossier PGlite (dev) | `.data/pglite` |

### Outil opérateur

```bash
node scripts/admin.mjs set-plan <tenant_id> business operateur@exemple   # serveur arrêté, journalisé
node scripts/admin.mjs override <tenant_id> seats 25 operateur@exemple "Contrat sur devis"
node scripts/admin.mjs alerts
```
