# Chronos

Plateforme unifiée de gestion de la scène compétitive **Brawl Stars** de la communauté Chronos. Ce dépôt est la **fusion** des deux applications existantes :

- **leaguebs** → moteur Compétition (saisons, conférences, équipes, matchs, playoffs, jetons, paris, disponibilités) ;
- **statsbs** → moteur Stats/Notation (stats par match, notation paramétrable, récompenses).

Il ajoute les briques Chronos décrites dans le cahier des charges : profils joueurs via l'API Brawl Stars, classement Elo + tiers, section **Hydra** (façon Prydwen), tags, compétitions génériques et drifter à tarification modulaire.

> État : **fondation** (V0.1). Le socle, la configuration et le schéma de données unifié sont en place. Le portage des fonctionnalités des deux sites et l'implémentation des nouveautés se font par incréments (voir « Feuille de route » plus bas).

---

## Stack

| Couche | Techno |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite · Wouter · TanStack Query · shadcn/ui · Tailwind |
| Backend | Node 20 · Express 5 · TypeScript |
| Base de données | PostgreSQL · Drizzle ORM |
| Auth | bcrypt + express-session |

On standardise sur le stack de leaguebs : **node-postgres** (`pg`) et **bcrypt** (statsbs utilisait Neon serverless et bcryptjs — abandonnés au profit d'une base unique auto-hébergée).

---

## Structure

```
.
├── client/                 # SPA Vite + React
│   └── src/
│       ├── App.tsx                 # Shell + routeur (nav groupée)
│       ├── components/
│       │   ├── layout/app-sidebar.tsx   # Navigation latérale unique et groupée
│       │   └── ui/                 # Primitives shadcn (reprises telles quelles)
│       ├── lib/                    # queryClient, utils
│       ├── hooks/
│       └── pages/                  # Placeholders (à remplacer)
├── server/                 # API Express + middleware Vite
│   ├── index.ts                    # Boot
│   ├── routes.ts                   # Socle (santé) — routes métier à porter
│   ├── db.ts                       # Drizzle + pg
│   ├── vite.ts / static.ts
├── shared/
│   └── schema.ts                   # ★ Schéma Drizzle unifié (source de vérité)
├── drizzle.config.ts
└── package.json
```

---

## Le schéma unifié (`shared/schema.ts`)

Les cinq tables communes aux deux bases ont été réconciliées ; les tables propres à chacune sont conservées ; des tables Chronos sont ajoutées.

| Table | Origine | Décision de réconciliation |
| --- | --- | --- |
| `users` | commune | Version leaguebs (e-mail + rôle + teamId). Le `username` de statsbs est abandonné : auth par **e-mail**. |
| `conferences` | commune | Superset leaguebs (tag, color, logo, saison). « Hydra » y reste un simple libellé de conférence. |
| `teams` | commune | Superset leaguebs (jetons, bilans, bans playoff). |
| `players` | commune **+ étendue** | Base leaguebs/statsbs **+ Chronos** : `playerTag`, `iconId`, `nationality`, `whatsapp` (admin), anciennetés, `elo`, `tierId`, `lastEloChangeAt`, `competitionsPlayed`. |
| `matches` | leaguebs | Superset + `durationSeconds` et `moderator` (repris de statsbs) + `competitionId`. |
| `match_player_stats`, `league_parameters`, `weekly_awards`, `season_awards` | statsbs | Repris tels quels (moteur de notation paramétrable + awards). |
| `playoff_series`, `availabilities`, `time_slots`, `moderator_assignments`, `bettors`/`bets`/`transactions`/`token_ledger`, `access_codes`, `map_change_requests`, `settings` | leaguebs | Repris tels quels. |
| `competitions` | **Chronos** | Généralise au-delà de la ligue (type, `isCompetitive`, `affectsElo`, ruleset). |
| `tiers` | **Chronos** | Seuils de tiers configurables (Elo → tier). |
| `changelog_batches`, `elo_changelog` | **Chronos** | Journal des évolutions de classement par batch (§14.6 du CDC). |
| `tags`, `player_tags` | **Chronos** | Tags palmarès/comportement et affectations. |
| `drifter_engagements` | **Chronos** | Drifter à tarification modulaire (jetons / Elo / autre). |

**À noter** : l'appartenance aux modes Hydra (**Joueurs / Rookie / Réserve**) n'est pas stockée ; elle est **dérivée** des signaux du joueur (ancienneté, activité, `lastEloChangeAt`). Le mode Réserve correspond à un Elo gelé faute d'activité sur tous les capteurs.

**Rappel important** : en partie privée, Brawl Stars ne remonte que les stats du **dernier round** (bug du jeu). Les stats individuelles sont donc un **signal secondaire** du classement — l'Elo pondère d'abord les résultats objectifs.

---

## Démarrer en local

1) **Dépendances**

```bash
npm install
```

2) **PostgreSQL via Docker** (port 5433 pour ne pas gêner un Postgres local) :

```bash
docker run -d --name chronos-postgres \
  -e POSTGRES_USER=chronos -e POSTGRES_PASSWORD=chronos123 -e POSTGRES_DB=chronos \
  -p 5433:5432 postgres:16-alpine
```

3) **Variables d'environnement** : copier `.env.example` vers `.env.local` et renseigner `DATABASE_URL` (et `BRAWLSTARS_API_TOKEN` le moment venu). En dev, exporter les variables avant de lancer, par ex. :

```bash
export DATABASE_URL="postgresql://chronos:chronos123@127.0.0.1:5433/chronos"
```

4) **Appliquer le schéma** puis **lancer** :

```bash
npm run db:push
npm run dev        # http://localhost:5000
```

### Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur Express + Vite (même port) |
| `npm run build` | Build client + serveur |
| `npm run start` | Production |
| `npm run check` | Vérification TypeScript |
| `npm run db:push` | Synchronise le schéma Drizzle avec la base |

---

## Notes git importantes

**Fins de ligne.** Les dépôts d'origine souffraient d'un bruit CRLF/LF massif (chaque ligne apparaissait modifiée). Le `.gitattributes` de ce dépôt (`* text=auto eol=lf`) normalise tout en LF côté dépôt. Ne pas réintroduire ce bruit.

**Environnement Cowork.** Le scaffolding a été produit par un assistant dont l'environnement ne peut pas exécuter les écritures git de façon fiable (verrous non supprimables sur le montage). Les commits sont donc faits par vous, sur votre machine. Pensez, dans les anciens dépôts `leaguebs`/`statsbs`, à supprimer les verrous résiduels si présents (`.git/index.lock`, `.git/packed-refs.lock`) et la branche de test `_probe_write`.

**Branche de travail suggérée** ici :

```bash
git checkout -b foundation/monorepo
git add -A
git commit -m "chore: fondation monorepo Chronos (structure, configs, schéma unifié, shell)"
```

---

## Feuille de route (rappel)

- **Étape 0 — Fusion (en cours)** : structure, configs, schéma unifié, shell de navigation. ✔ fondation
- **V1** : profils via API Brawl Stars, équipes, matchs, Elo + tiers, section Hydra (mode Joueurs).
- **V2** : modes Rookie/Réserve, tags & filtres, validateur de compositions, drifter modulaire, portage des stats.
- **V3** : inscriptions auto, gestion complète ligues/brackets, modes communautaires, intégrations Discord/WhatsApp.

Voir le cahier des charges fonctionnel (v0.3) pour le détail.
