# Workers

Petit outil pour suivre une équipe de workers, leur assigner un objectif, et voir son évolution en temps réel via des intégrations externes (TikTok / Apify pour l'instant).

## Fonctionnalités

- Ajouter / modifier / supprimer des workers (nom, poste, email, coût en €)
- Assigner un objectif par worker, via un système de **fournisseurs** extensible :
  - **Followers TikTok** (Apify) — suit le nombre de followers d'un compte, plus le nombre de vidéos publiées en métrique secondaire
  - **Suivi manuel** — pour tout objectif sans intégration automatique
- Historique des mesures, delta depuis la dernière mesure (`▲ +3`), mini-graphique de tendance
- Rafraîchissement automatique de tous les objectifs à chaque chargement de la page

## Stack

- **Frontend** : React + Vite
- **Backend** : Node.js + Express, stockage JSON local (`server/data/workers.json`, non versionné)
- **Intégration externe** : [Apify](https://apify.com) (actor `clockworks/tiktok-followers-scraper`)

## Démarrer

1. Installer les dépendances :
   ```
   npm install
   ```
2. Copier `.env.example` en `.env` et renseigner ta clé API Apify (Settings → Integrations sur [console.apify.com](https://console.apify.com)) :
   ```
   APIFY_TOKEN=...
   ```
3. Lancer le frontend et le backend ensemble :
   ```
   npm run dev:all
   ```
   Le site est sur `http://localhost:5173`, l'API sur `http://localhost:3001`.

## Ajouter un nouveau fournisseur d'objectif

Créer un fichier dans `server/providers/` (voir `tiktokFollowers.js` comme exemple) et l'ajouter à la liste dans `server/providers/index.js`. Rien d'autre à modifier côté serveur — l'API et l'interface sont génériques.
