# MARYX

MARYX est une application de suivi des cotisations avec une base PostgreSQL (Neon) et des espaces membre et administration. Le montant journalier par défaut est de 50 FCFA; l’administrateur peut le modifier depuis son tableau de bord.

L’administrateur peut également définir la pénalité quotidienne de retard (25 FCFA par défaut). Un changement de tarif s’applique à partir du jour même : les échéances et pénalités déjà dues conservent leur montant d’origine. Les jours calendaires sont calculés dans le fuseau `MARYX_TIMEZONE` (par défaut `Africa/Porto-Novo`, UTC+1), et non en UTC. Un seul montant est ajouté par jour calendaire où au moins une cotisation échue reste impayée, quel que soit le nombre de cotisations manquées. Les pénalités déjà calculées ne sont pas réécrites lorsque le réglage change. La migration conserve les soldes existants sans leur appliquer de pénalité rétroactive; les comptes mis en pause ne créent pas de nouvelles échéances et leur calendrier repart à leur réactivation.

Dans le dashboard membre, **Régulariser tous mes impayés** règle le total échu, pénalités comprises. **Payer mes cotisations** permet de choisir de 1 à 365 jours. Tout paiement est affecté d’abord aux pénalités, puis aux échéances les plus anciennes, puis aux jours suivant le dernier jour déjà couvert : un paiement d’avance ne peut donc jamais recouvrir des jours déjà réglés, et aucun montant ne reste non affecté. Si la dette absorbe le paiement, la cotisation du jour demeure due et apparaîtra comme impayée à son échéance. Les paiements SasPay restés en attente sont listés dans le tableau de bord du membre, qui peut relancer leur vérification.

Le centre de notifications administrateur sépare les éléments actifs des archives. Les connexions et déconnexions des membres sont archivées après 5 minutes; les autres notifications le sont après 3 jours. Les archives restent en base et sont consultables par date. L’échéance est vérifiée à chaque consultation et actualisation automatique du centre.

L’administrateur peut télécharger un relevé global limité aux statistiques agrégées et un relevé individuel complet depuis la ligne de chaque membre. Chaque membre peut télécharger son relevé personnel ainsi que la synthèse globale. Les PDF sont distincts, portent l’identité visuelle MARYX et présentent les soldes, retards, détails d’impayés et transactions selon le type de relevé.

## Démarrage local

```powershell
npm install
copy .env.example .env.local   # puis renseignez DATABASE_URL (Neon ou PostgreSQL local)
npm run dev
```

Les tables sont créées automatiquement au premier accès. Aucun compte, mot de passe ou historique fictif n’est préchargé. Sur une base vide en local, la page de connexion propose **Initialiser le compte administrateur** (mot de passe de 12 caractères minimum).

## Base de données

- Type : PostgreSQL, hébergé sur [Neon](https://neon.tech) (offre gratuite).
- Connexion : `DATABASE_URL`, chaîne **pooled** fournie par Neon avec `sslmode=require`.
- Schéma : `lib/schema.ts`, idempotent, appliqué automatiquement.
- Concurrence : chaque calcul de facturation ou de paiement verrouille le membre concerné (`pg_advisory_xact_lock`), ce qui évite les doubles crédits entre instances serverless.

Reprise des données de l’ancienne version SQLite (`data/maryx.sqlite`) :

```powershell
$env:DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"; npm run db:migrate-sqlite
```

Le script est idempotent : relancé, il n’ajoute que les lignes manquantes. Pour une base neuve, créez l’administrateur avec `npm run db:create-admin` (variables `MARYX_ADMIN_EMAIL`, `MARYX_ADMIN_PASSWORD`, `MARYX_ADMIN_FIRST_NAME`, `MARYX_ADMIN_LAST_NAME`, `MARYX_ADMIN_PHONE`). Ne mettez jamais un mot de passe dans le code ou dans une variable `NEXT_PUBLIC_*`.

## Emails (EmailJS)

Les emails partent depuis le serveur via l’API REST d’EmailJS : lien de réinitialisation du mot de passe (valable une heure, utilisable une fois), bienvenue à l’inscription et confirmation de paiement. Sans configuration, aucun email n’est envoyé et la page « mot de passe oublié » renvoie vers l’administrateur, qui peut générer un mot de passe temporaire depuis la fiche du membre.

1. Créez un service email (Gmail par exemple) et notez son **Service ID**.
2. Créez **un seul modèle** avec pour destinataire `{{to_email}}`, pour objet `{{subject}}`, et pour contenu les variables `{{to_name}}`, `{{title}}`, `{{message}}`, `{{action_url}}` et `{{action_label}}`. Notez son **Template ID**.
3. Dans *Account > General*, copiez la **Public Key** ; dans *Account > Security*, créez une **Private Key** et cochez **Allow EmailJS API for non-browser applications**.
4. Renseignez `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` et `EMAILJS_PRIVATE_KEY` côté serveur.

Les tentatives de connexion échouées sont limitées (5 par compte et 30 par adresse sur 15 minutes), les demandes de réinitialisation à 5 par heure et par adresse.

## Mise en ligne (Vercel + Neon)

1. Créez une base Neon et copiez sa chaîne de connexion *pooled*.
2. Reprenez les données existantes avec `npm run db:migrate-sqlite` (voir plus haut).
3. Importez le dépôt GitHub dans Vercel et déclarez les variables d’environnement : `DATABASE_URL`, `SASPAY_SECRET_KEY`, `MARYX_PUBLIC_URL` (adresse HTTPS du site, par exemple `https://maryx.vercel.app`), `MARYX_TIMEZONE` et les quatre variables EmailJS.
4. Déployez. Après tout changement de variable, relancez un déploiement.

## Paiements en ligne

MARYX utilise la page de paiement hébergée SasPay en XOF. Copiez `.env.example` vers `.env.local`, puis renseignez `SASPAY_SECRET_KEY` avec une clé `sk_test_...` pour les essais ou `sk_live_...` pour la production. La clé doit avoir le scope `PAYIN` ou `BOTH` et reste exclusivement côté serveur. `MARYX_PUBLIC_URL` doit contenir l’adresse de l’application; en production, utilisez impérativement son URL HTTPS publique.

MARYX redirige le membre vers la page SasPay, puis vérifie côté serveur le statut de la session et de la transaction avant de créditer le compte. Le retour du navigateur seul ne confirme jamais un règlement; le membre peut également relancer la vérification depuis son tableau de bord. Après confirmation réelle, un reçu PDF MARYX est téléchargé automatiquement et reste téléchargeable depuis le message de confirmation. Le reçu récapitule le membre, le montant, les références SasPay/MARYX, la date et la répartition entre impayés et cotisations.

Le checkout est une page hébergée par SasPay. L’endpoint de création documenté ne propose pas de paramètres de thème ou de couleurs; son apparence doit être réglée dans les options de marque du tableau de bord SasPay si elles sont disponibles pour le compte, ou auprès de leur support. SasPay n’inclut pas dans l’exemple documenté de webhook de champ permettant de rattacher de façon fiable une transaction à une session MARYX; aucun webhook n’est donc configuré pour éviter toute attribution erronée. Ne placez jamais la clé secrète dans le code, dans Git ou dans une variable `NEXT_PUBLIC_*`. Redémarrez le serveur après avoir modifié `.env.local`.

## Vérification

```powershell
npm run lint
npm run build
```
