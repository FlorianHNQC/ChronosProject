# Onboarding développeur — Chronos

Bienvenue sur **Chronos**, la plateforme de gestion de la scène compétitive Brawl Stars de
la communauté. Le dépôt est la **fusion** de deux anciennes applis (`leaguebs` = moteur
Compétition, `statsbs` = moteur Stats/Notation), enrichie des briques Chronos : profils
joueurs via l'API Brawl Stars, classement Elo + tiers, section **Hydra** (façon Prydwen),
tags, compétitions génériques et drifter à tarification modulaire.

Ce document te donne : les outils à installer, comment lancer le projet en local, ce dont tu
as besoin de la part de Florian (secrets + base de données), un rappel d'architecture, et
l'inventaire **Fait / À vérifier / À faire**.

---

## 1. Stack

| Couche | Techno |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite · Wouter (routing) · TanStack Query · shadcn/ui · Tailwind |
| Backend | Node 20 · Express 5 · TypeScript |
| Base de données | PostgreSQL · Drizzle ORM · node-postgres (`pg`) |
| Auth | bcrypt + express-session (+ connect-pg-simple : sessions persistées en base) |

Application **unique** : le serveur Express sert à la fois l'API et le client (build Vite),
sur un seul port.

---

## 2. Outils à installer

| Outil | Pourquoi | Notes |
| --- | --- | --- |
| **Node.js 20 LTS** (+ npm) | Runtime + build | `import.meta.dirname` utilisé → Node ≥ 20.11 requis |
| **Git** | Versionnement | Tu as déjà accès au dépôt |
| **Docker Desktop** *(recommandé)* | Postgres local en 1 commande | Alternative : un PostgreSQL 14+ installé en local |
| **VS Code** *(ou autre)* | Éditeur | Extensions utiles : ESLint, Prettier, Tailwind CSS IntelliSense |
| **Un client SQL** *(optionnel)* | Explorer la base | DBeaver, TablePlus ou pgAdmin |
| **Token API Brawl Stars** *(le moment venu)* | Ajout de joueurs par tag | `https://developer.brawlstars.com` — **verrouillé par IP** (voir §4) |

Pour le déploiement (plus tard) : un accès SSH au VPS et des notions de **PM2** / **Nginx**
(tout est scripté, voir `DEPLOYMENT.md`).

---

## 3. Lancer le projet en local

```bash
# 1) Dépendances
npm install

# 2) PostgreSQL via Docker (port 5433 pour ne pas gêner un Postgres local)
docker run -d --name chronos-postgres \
  -e POSTGRES_USER=chronos -e POSTGRES_PASSWORD=chronos123 -e POSTGRES_DB=chronos \
  -p 5433:5432 postgres:16-alpine

# 3) Variables d'environnement : copier le template
cp .env.example .env.local
#    puis renseigner .env.local (voir §4)

# 4) Créer les tables (schéma Drizzle -> base)
npm run db:push

# 5) Démarrer (API + client sur le même port)
npm run dev            # http://localhost:5000
```

Au premier démarrage, un compte **admin** est créé si la table `users` est vide, à partir de
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (sinon défauts internes). Connexion sur `/login`.

### Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur Express + Vite (hot reload), même port |
| `npm run build` | Build client (`dist/public`) + serveur bundlé (`dist/index.js`) |
| `npm run start` | Lancement production |
| `npm run check` | Vérification TypeScript (`tsc`) — **à lancer avant chaque commit** |
| `npm run db:push` | Synchronise le schéma Drizzle avec la base |

---

## 4. Ce dont tu as besoin de Florian

### a) Le fichier d'environnement

Ne jamais commiter les secrets. Florian te transmet les valeurs par un canal privé ; tu les
mets dans `.env.local` (git-ignoré). Variables (voir `.env.example`) :

| Variable | Dev | Remarque |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://chronos:chronos123@127.0.0.1:5433/chronos` | Base Docker locale |
| `PORT` | `5000` | Port d'écoute |
| `SESSION_SECRET` | n'importe quelle valeur aléatoire | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BRAWLSTARS_API_TOKEN` | **ton propre token** | Le token est **verrouillé par IP** → crée le tien sur developer.brawlstars.com avec **ton IP** autorisée. Inutile de réutiliser celui de Florian (son IP ≠ la tienne). |

> Chargement : le serveur lit `.env.local` **en priorité**, puis `.env` en repli
> (`server/load-env.ts`, importé en tout premier). dotenv n'écrase jamais une variable déjà
> définie dans l'environnement réel.

### b) La base de données (données réelles 2026)

Pour bosser sur de vraies données, demande à Florian un **dump** de la base de prod.

Côté Florian (sur le VPS) :
```bash
set -a; source ~/ChronosProject/.env; set +a
pg_dump "$DATABASE_URL" -Fc -f chronos.dump      # dump compressé
# puis te l'envoyer (scp / transfert privé)
```

Côté toi (après avoir lancé le Postgres Docker et fait `npm run db:push`) :
```bash
pg_restore -d "postgresql://chronos:chronos123@127.0.0.1:5433/chronos" \
  --clean --no-owner chronos.dump
```

Alternative sans dump : les fichiers `migrations/legacy_import.sql` et
`migrations/legacy_playoffs_awards.sql` reconstruisent la ligue 2026 (mais ils sont
git-ignorés car ils contiennent des données — à récupérer auprès de Florian aussi).

---

## 5. Architecture en 2 minutes

```
client/        Front React (Vite). Alias @/* -> client/src/*
  src/pages/     une page par écran (home, hydra, matches, stats, ...)
  src/pages/admin/  écrans d'administration (protégés)
  src/components/   UI partagée (shadcn/ui, bracket, sidebar, ...)
server/        API Express. Alias @shared/* -> shared/*
  index.ts       point d'entrée : charge l'env, enregistre TOUTES les routes, seed
  *Routes.ts     routes par domaine (pattern registerXRoutes(app))
  *Storage.ts    accès données (Drizzle) par domaine
  eloEngineStorage.ts  moteur Elo (recompute par résultats)
  brawlstarsPlayerService.ts  appel API officielle Brawl Stars
shared/
  schema.ts      schéma Drizzle unifié (source de vérité des tables)
  tiers.ts       tiers par défaut + tierForElo()
```

Conventions importantes :

- **Chaque domaine** = un couple `xStorage.ts` (données) + `xRoutes.ts` (`registerXRoutes(app)`),
  branché dans `server/index.ts`.
- **Règle d'accès** : les `GET` sont publics, **toutes les écritures exigent un admin
  connecté** (`requireAdminWrites`).
- **Elo** : personnalisé/configurable ; il se recalcule à partir des résultats de matchs
  (`eloEngine.recompute`) et **automatiquement après une fusion de profils**.
- **Hydra** : programme qui range chaque joueur dans un **tier** dérivé de l'Elo (seuils
  `minElo` configurables). Modes dérivés (non stockés) : Joueurs / Rookie (0 compétition) /
  Réserve (Elo inchangé depuis > 90 j). ⚠️ **Ne pas réécrire la page Hydra** (finalisée).
- **API joueurs** : identité via l'API officielle Brawl Stars (token) ; images d'icônes via
  Brawlify (sans clé).

Le schéma Drizzle (`shared/schema.ts`) fait foi : pour modifier la base, on édite le schéma
puis `npm run db:push`.

---

## 6. Inventaire des tâches

### ✅ Fait

- **Fondation monorepo** : structure, configs, schéma Drizzle unifié, shell applicatif + nav.
- **Profils joueurs** : ajout par tag (API Brawl Stars), annuaire public, admin joueurs,
  liaison d'un tag à un joueur existant.
- **Hydra** : tiers & Elo configurables, page façon Prydwen (accordéons + sélecteur de mode),
  modes Joueurs/Rookie/Réserve, tags éditables, changelogs, admin tiers/tags.
- **Moteur Elo** : recompute par résultats (K configurable), écriture des changelogs,
  recalcul **auto après fusion**.
- **Compétitions** : cycle de vie (brouillon/active/archivée), clôture officielle, historique.
- **Équipes & rosters** + **validation des compositions**.
- **Matchs** : calendrier groupé par date, fiche match, stats par joueur.
- **Playoffs** : grille (bracket) par tours.
- **Statistiques agrégées** par compétition.
- **Récompenses** : awards de saison + joueur de la semaine.
- **Auth** : sessions persistantes (connect-pg-simple), rôle admin, GET public / écritures admin.
- **Fusion de profils** (doublons) avec recalcul Elo automatique.
- **Import des données réelles 2026** : 107 joueurs, 19 équipes, 455 matchs, 1028 stats,
  9 séries playoffs, 12 récompenses hebdo + 1 de saison.
- **Page d'accueil** refaite : fil d'actualité + raccourcis (sans classement).
- **Déploiement** : scripts `setup.sh` / `deploy.sh` / `setup-nginx.sh`. **Prod en ligne**
  sur `https://chronosbs.com` (VPS Ubuntu, PM2 `chronos` port 5010, Nginx + SSL Let's Encrypt).

### 🔎 À vérifier

- **Ajout de joueur par tag en prod** : chargement du `BRAWLSTARS_API_TOKEN` (debug en cours) —
  confirmer un retour 200, et autoriser l'IP du VPS si 403.
- **Fusion des profils** : vérifier que l'avatar et l'historique se mettent bien à jour, et que
  l'Elo se recalcule correctement après merge sur données réelles.
- **Nouvelle page d'accueil** : contrôler le rendu en prod après un vrai `build`.
- **SSL** : renouvellement auto (`sudo certbot renew --dry-run`).
- **Cohérence générale des données 2026** importées (scores, rosters, doublons).

### 🚧 À faire

- **Cycle complet d'inscription et de création de tournoi** *(chantier majeur, aujourd'hui absent)*.
  L'état actuel se limite à créer une compétition (nom + `type`), la faire passer
  draft → active → archivée, et la cloner. Il reste à concevoir et construire :
  - **Inscription** : permettre à une équipe / des joueurs de **s'inscrire** à une compétition
    (aucune entité ni flux d'inscription aujourd'hui) — page publique + gestion des candidatures.
  - **Validation des équipes** : workflow admin pour **accepter / refuser** les inscriptions.
    ⚠️ À ne pas confondre avec la **validation de composition** qui, elle, existe déjà
    (`competitions.rulesetJson` : budget de points par tier + quotas par tier, page
    `validation-admin`).
  - **Établissement des règles / format** : le `rulesetJson` ne couvre aujourd'hui que les
    **contraintes de composition**. Il manque les **paramètres de format** : nombre d'équipes,
    phases (poules / bracket / suisse), best-of, seeding, dates & planning.
  - **Templates de tournoi** : il existe un champ `type` (league/tournament/swiss/round_robin/
    groups/scrim/event) et un bouton « nouvelle édition » (clone), mais **pas de vrai template
    réutilisable ni d'assistant de création**. À concevoir : des modèles de format
    préconfigurés + **génération automatique des poules / du bracket** à partir des équipes validées.
- **Fusion manuelle des ~50 doublons** de profils (tâche data ; sûre grâce au recompute auto).
- **Refonte UI complète** via v0 (Vercel) : design system + toutes les pages **sauf Hydra**.
  Prompts prêts dans `docs/prompts-v0.md` ; l'intégration au repo reste à faire.
- **Portage jetons / paris / disponibilités** depuis leaguebs : le **schéma existe déjà**
  (`bettors`, `bets`, `transactions`, `tokenLedger`, `availabilities`, `timeSlots`,
  `moderatorAssignments`) — il manque l'**UI** et les routes publiques.
- **Drifter** : finaliser la tarification modulaire (monnaie tokens / elo / autre) côté UI.
- **Changement de mot de passe admin** propre (script `scripts/set-admin-password.sh` à créer —
  actuellement changer `ADMIN_PASSWORD` ne met pas à jour un compte déjà existant).
- **Tests** : aucun test automatisé pour l'instant → à mettre en place.
- **Nettoyage prod** : retirer les anciens process PM2 (`chronos-league`, `chronos-stats`)
  une fois la bascule validée.

---

## 7. Déploiement (résumé)

Tout est détaillé dans **`DEPLOYMENT.md`**. En bref, sur le VPS :

```bash
sudo bash scripts/setup.sh                      # provisionnement (une fois)
bash scripts/deploy.sh                           # pull + install + db:push + build + PM2
sudo bash scripts/setup-nginx.sh <domaine> <email>   # reverse-proxy + SSL (une fois)
```

Prod actuelle : app PM2 `chronos` (port **5010**) derrière Nginx, domaine
`https://chronosbs.com`. Secrets dans `.env` sur le serveur (jamais commité).

---

## 8. Premiers pas conseillés

1. Lancer le projet en local (§3) avec un dump de données (§4b).
2. Lire `README.md`, `shared/schema.ts` et `server/index.ts` pour la vue d'ensemble.
3. Faire tourner `npm run check` pour valider l'environnement.
4. Choisir un premier ticket dans « À faire » — le portage **jetons/paris/disponibilités**
   (schéma déjà là) ou l'**intégration des écrans v0** sont de bons points d'entrée.
