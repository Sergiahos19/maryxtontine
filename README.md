# MARYX

MARYX est une application de suivi des cotisations avec une base SQLite persistante et des espaces membre et administration. Le montant journalier par défaut est de 50 FCFA; l’administrateur peut le modifier depuis son tableau de bord.

L’administrateur peut également définir la pénalité quotidienne de retard (25 FCFA par défaut). Un seul montant est ajouté par jour calendaire où au moins une cotisation échue reste impayée, quel que soit le nombre de cotisations manquées. Les pénalités déjà calculées ne sont pas réécrites lorsque le réglage change. La migration conserve les soldes existants sans leur appliquer de pénalité rétroactive; les comptes mis en pause ne créent pas de nouvelles échéances et leur calendrier repart à leur réactivation.

Dans le dashboard membre, **Régulariser tous mes impayés** règle le total échu, pénalités comprises. **Payer mes cotisations** permet de choisir de 1 à 365 jours. Tout paiement est affecté d’abord aux pénalités puis aux échéances les plus anciennes; seule la somme restante couvre les jours sélectionnés. Si la dette absorbe le paiement, la cotisation du jour demeure due et apparaîtra comme impayée à son échéance.

Le centre de notifications administrateur sépare les éléments actifs des archives. Les connexions et déconnexions des membres sont archivées après 5 minutes; les autres notifications le sont après 3 jours. Les archives restent en base et sont consultables par date. L’échéance est vérifiée à chaque consultation et actualisation automatique du centre.

L’administrateur peut télécharger un relevé global limité aux statistiques agrégées et un relevé individuel complet depuis la ligne de chaque membre. Chaque membre peut télécharger son relevé personnel ainsi que la synthèse globale. Les PDF sont distincts, portent l’identité visuelle MARYX et présentent les soldes, retards, détails d’impayés et transactions selon le type de relevé.

## Démarrage local

```powershell
npm install
npm run dev
```

La base SQL est créée au premier démarrage dans `data/maryx.sqlite`. Les utilisateurs, membres, transactions, notifications et sessions y sont conservés. Aucun compte, mot de passe ou historique de paiement fictif n’est préchargé.

Au premier lancement sur `localhost`, ouvrez la page de connexion et choisissez **Initialiser le compte administrateur**. Définissez vos propres coordonnées et un mot de passe d’au moins 12 caractères. Ce parcours n’est disponible qu’en développement local et ne révèle pas le mot de passe après création.

Les nouvelles inscriptions créent un compte membre et son dossier dans une transaction SQL. Les mots de passe sont stockés sous forme de hachages `scrypt`; les sessions utilisent des jetons aléatoires stockés hachés en base et un cookie `HttpOnly`.

## Base de données

- Type : SQLite (`better-sqlite3`)
- Chemin par défaut : `data/maryx.sqlite`
- Chemin personnalisé : `MARYX_DATABASE_PATH`
- Les fichiers de base et de journal sont exclus de Git.

Pour un déploiement, utilisez un serveur Node.js avec un disque persistant monté et définissez `MARYX_DATABASE_PATH` vers ce disque. Une base SQLite sur un système de fichiers éphémère/serverless ne convient pas : les données risqueraient d’être perdues ou séparées entre instances.

Pour créer l’administrateur d’une installation de production, initialisez la base en démarrant l’application une première fois, définissez les variables suivantes côté serveur, puis exécutez `npm run db:create-admin` :

```text
MARYX_ADMIN_EMAIL
MARYX_ADMIN_PASSWORD
MARYX_ADMIN_FIRST_NAME
MARYX_ADMIN_LAST_NAME
MARYX_ADMIN_PHONE
```

Ne mettez jamais le mot de passe administrateur dans le code source ou dans une variable `NEXT_PUBLIC_*`. Le script n’affiche pas le mot de passe.

## Emails et récupération de mot de passe

La base et les notifications intégrées fonctionnent sans compte tiers. L’envoi d’emails (récupération par lien, relances et bilans hebdomadaires) nécessite toutefois un fournisseur SMTP et des identifiants qui ne sont pas présents dans le projet. Tant qu’ils ne sont pas configurés, l’application signale explicitement que la récupération par email n’est pas disponible au lieu de prétendre qu’un message a été envoyé.

## Paiements en ligne

MARYX utilise la page de paiement hébergée SasPay en XOF. Copiez `.env.example` vers `.env.local`, puis renseignez `SASPAY_SECRET_KEY` avec une clé `sk_test_...` pour les essais ou `sk_live_...` pour la production. La clé doit avoir le scope `PAYIN` ou `BOTH` et reste exclusivement côté serveur. `MARYX_PUBLIC_URL` doit contenir l’adresse de l’application; en production, utilisez impérativement son URL HTTPS publique.

MARYX redirige le membre vers la page SasPay, puis vérifie côté serveur le statut de la session et de la transaction avant de créditer le compte. Le retour du navigateur seul ne confirme jamais un règlement; le membre peut également relancer la vérification depuis son tableau de bord. Après confirmation réelle, un reçu PDF MARYX est téléchargé automatiquement et reste téléchargeable depuis le message de confirmation. Le reçu récapitule le membre, le montant, les références SasPay/MARYX, la date et la répartition entre impayés et cotisations.

Le checkout est une page hébergée par SasPay. L’endpoint de création documenté ne propose pas de paramètres de thème ou de couleurs; son apparence doit être réglée dans les options de marque du tableau de bord SasPay si elles sont disponibles pour le compte, ou auprès de leur support. SasPay n’inclut pas dans l’exemple documenté de webhook de champ permettant de rattacher de façon fiable une transaction à une session MARYX; aucun webhook n’est donc configuré pour éviter toute attribution erronée. Ne placez jamais la clé secrète dans le code, dans Git ou dans une variable `NEXT_PUBLIC_*`. Redémarrez le serveur après avoir modifié `.env.local`.

## Vérification

```powershell
npm run lint
npm run build
```
