/**
 * Schéma unifié Chronos (Drizzle ORM / PostgreSQL).
 *
 * Fusion des deux bases existantes :
 *   - leaguebs  → moteur Compétition (saisons, conférences, équipes, matchs,
 *                 playoffs, jetons, paris, disponibilités, settings).
 *   - statsbs   → moteur Stats/Notation (stats par match, notation
 *                 paramétrable, récompenses).
 *
 * Les tables communes aux deux bases (users, conferences, teams, players,
 * matches) sont réconciliées ici en gardant la version la plus riche
 * (généralement leaguebs) puis en l'étendant pour Chronos.
 *
 * Extensions Chronos (nouveau) :
 *   - profils joueurs par tag Brawl Stars (API), nationalité, ancienneté ;
 *   - Elo + tiers dérivés, seuils de tiers configurables ;
 *   - journal (changelog) des évolutions de classement par batch ;
 *   - tags (palmarès / comportement) et affectations ;
 *   - compétitions génériques (au-delà de la seule ligue) ;
 *   - engagements de drifter à tarification modulaire.
 *
 * NB : l'appartenance d'un joueur aux modes Hydra (Joueurs / Rookie / Réserve)
 * n'est PAS stockée : elle est dérivée des signaux (ancienneté, activité,
 * date de dernière évolution d'Elo). Voir §12/§15 du cahier des charges.
 */

import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, integer, real, timestamp, boolean, decimal,
  pgEnum, serial, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ============================================================
 * ENUMS
 * ========================================================== */
export const matchTypeEnum = pgEnum("match_type", ["intra", "inter", "playoff"]);
export const matchStatusEnum = pgEnum("match_status", ["upcoming", "live", "completed", "cancelled"]);
export const availabilityStatusEnum = pgEnum("availability_status", ["available", "unavailable", "uncertain"]);
export const betStatusEnum = pgEnum("bet_status", ["pending", "won", "lost", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["credit", "debit", "bet", "win"]);
export const mapChangeStatusEnum = pgEnum("map_change_status", ["pending", "accepted", "rejected", "applied"]);

// Chronos
export const competitionTypeEnum = pgEnum("competition_type", [
  "league", "tournament", "swiss", "round_robin", "groups", "scrim", "event",
]);
export const tagFamilyEnum = pgEnum("tag_family", ["palmares", "comportement"]);
export const drifterCurrencyEnum = pgEnum("drifter_currency", ["tokens", "elo", "other"]);

/* ============================================================
 * SAISONS & CONFÉRENCES  (leaguebs)
 * ========================================================== */
export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// "Hydra" a pu être le nom d'une conférence (saison 2026). C'est un simple
// libellé de conférence — aucun rapport avec le programme de tiers Hydra.
export const conferences = pgTable("conferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tag: varchar("tag", { length: 10 }).notNull(),
  color: varchar("color", { length: 7 }).default("#EAB308"),
  logoUrl: text("logo_url"),
  seasonId: varchar("season_id").references(() => seasons.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * COMPÉTITIONS  (Chronos — nouveau)
 * Généralise la notion au-delà de la seule ligue (§13 du CDC).
 * ========================================================== */
export const competitions = pgTable("competitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: competitionTypeEnum("type").notNull().default("league"),
  seasonId: varchar("season_id").references(() => seasons.id),
  // Décidé par les admins : une compétition "compétitive" alimente le classement.
  isCompetitive: boolean("is_competitive").default(true),
  affectsElo: boolean("affects_elo").default(true),
  // Configuration libre du format et des restrictions de composition (budget,
  // quotas de tiers, quotas de nationalité, règles de drifter…).
  rulesetJson: text("ruleset_json"),
  // Cycle de vie : draft (brouillon) → active → archived (clôturée, historique).
  status: text("status").default("draft"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // Dates du tournoi.
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  // Options de format (créateur de tournoi).
  teamSize: integer("team_size").default(3), // 1 solo, 2 duo, 3 trio, 5 équipe
  randomTeams: boolean("random_teams").default(false),
  avgEloCap: integer("avg_elo_cap"), // moyenne d'Elo max par équipe (null = aucune)
  minElo: integer("min_elo"), // Elo minimum pour participer (null = aucun)
  noRookies: boolean("no_rookies").default(false),
  // Barème de points au classement (répartition définie par l'admin).
  pointsWin: integer("points_win").default(3),
  pointsDraw: integer("points_draw").default(1),
  pointsLoss: integer("points_loss").default(0),
});

// Phases d'une compétition : ordre + type de format + config (JSON libre).
export const competitionPhases = pgTable("competition_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id").references(() => competitions.id).notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  name: text("name").notNull(),
  // season | round_robin | swiss | groups | bracket | random
  type: text("type").notNull(),
  config: text("config"), // JSON : { rounds?, groups?, qualifiers?, bestOf?, doubleElim?, mode? … }
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCompetitionPhaseSchema = createInsertSchema(competitionPhases).omit({ id: true, createdAt: true });
export type CompetitionPhase = typeof competitionPhases.$inferSelect;

/* ============================================================
 * ÉQUIPES  (leaguebs — superset)
 * ========================================================== */
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tag: varchar("tag", { length: 10 }).notNull(),
  email: text("email").default("").notNull(),
  accessKey: varchar("access_key", { length: 8 }).default("XXXXXXXX").notNull(),
  logoUrl: text("logo_url"),
  conferenceId: varchar("conference_id").references(() => conferences.id),
  competitionId: varchar("competition_id").references(() => competitions.id),
  tokens: integer("tokens").default(100),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  points: integer("points").default(0),
  isActive: boolean("is_active").default(true),
  // Playoffs : 2 brawlers bannis pour tout le bracket (nom Supercell brut).
  playoffBanBrawler1: text("playoff_ban_brawler_1"),
  playoffBanBrawler2: text("playoff_ban_brawler_2"),
  playoffBansLockedAt: timestamp("playoff_bans_locked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * JOUEURS  (fusion leaguebs + statsbs + extensions Chronos)
 * ========================================================== */
export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pseudo: text("pseudo").notNull(),
  role: text("role"),
  teamId: varchar("team_id").references(() => teams.id),
  isCaptain: boolean("is_captain").default(false),
  isActive: boolean("is_active").default(true),
  avatarUrl: text("avatar_url"),

  // --- Extensions Chronos ---
  // Tag Brawl Stars (# + alphanumérique). Clé de synchronisation API.
  playerTag: varchar("player_tag", { length: 20 }),
  // Identifiant d'icône renvoyé par l'API (résolu en image via Brawlify).
  iconId: integer("icon_id"),
  nationality: varchar("nationality", { length: 2 }),
  // Contact réservé aux admins (jamais exposé publiquement).
  whatsapp: text("whatsapp"),
  // Ancienneté : arrivée dans Chronos (mode Rookie) et compte in-game (API).
  joinedChronosAt: timestamp("joined_chronos_at").defaultNow(),
  accountCreatedAt: timestamp("account_created_at"),
  // Classement. L'Elo est la source ; le tier en est dérivé (voir tiers).
  elo: integer("elo").default(1000),
  // Elo de départ (évaluation préliminaire réglable par admin). Le recalcul part
  // de cette valeur pour chaque joueur, puis les matchs l'ajustent.
  seedElo: integer("seed_elo").default(1000),
  tierId: varchar("tier_id").references(() => tiers.id),
  // Signal pour le mode Réserve : dernière évolution effective de l'Elo.
  lastEloChangeAt: timestamp("last_elo_change_at"),
  // Compteur dénormalisé (aide le mode Rookie / seuils d'activité).
  competitionsPlayed: integer("competitions_played").default(0),
  // Statut Hydra forcé par un admin (joueurs | rookie | reserve). null = déduit auto.
  modeOverride: text("mode_override"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqByTag: uniqueIndex("players_player_tag_idx").on(t.playerTag),
}));

/* ============================================================
 * ROSTER  (Chronos — composition d'équipe PAR compétition)
 * Un joueur appartient à une équipe dans le cadre d'une compétition. Préserve
 * l'historique : archiver une ligue fige ses effectifs, cloner repart propre.
 * ========================================================== */
export const teamPlayers = pgTable("team_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id).notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  isCaptain: boolean("is_captain").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqTeamPlayer: uniqueIndex("team_players_team_player_idx").on(t.teamId, t.playerId),
}));

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).omit({ id: true, createdAt: true });
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;

/* ============================================================
 * TIERS & CLASSEMENT  (Chronos — nouveau)
 * Le tier est une catégorie dérivée de l'Elo ; les seuils sont éditables.
 * ========================================================== */
export const tiers = pgTable("tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 10 }).notNull().unique(), // T0, T0.5, T1…
  label: text("label"),
  minElo: integer("min_elo").notNull(),
  orderIndex: integer("order_index").notNull(),
  color: varchar("color", { length: 7 }),
});

// Un batch de mise à jour du classement (§14.6). Chaque batch produit un
// ensemble d'entrées de changelog, avec un éventuel commentaire admin.
export const changelogBatches = pgTable("changelog_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  note: text("note"),
  authorUserId: varchar("author_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eloChangelog = pgTable("elo_changelog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => changelogBatches.id),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  oldElo: integer("old_elo"),
  newElo: integer("new_elo"),
  oldTierId: varchar("old_tier_id").references(() => tiers.id),
  newTierId: varchar("new_tier_id").references(() => tiers.id),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * TAGS  (Chronos — nouveau)
 * Palmarès (Champion…) et comportement (Nomade, Drifter actif…).
 * ========================================================== */
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: text("label").notNull(),
  family: tagFamilyEnum("family").notNull().default("comportement"),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  isAuto: boolean("is_auto").default(false), // attribué automatiquement ?
  // Bonus d'Elo de départ conféré par ce tag (palmarès). Seul le plus élevé des
  // tags d'un joueur compte (pas de cumul). 0 = aucun.
  eloBonus: integer("elo_bonus").default(0),
});

export const playerTags = pgTable("player_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  tagId: varchar("tag_id").references(() => tags.id).notNull(),
  note: text("note"),
  awardedAt: timestamp("awarded_at").defaultNow(),
}, (t) => ({
  uniqPlayerTag: uniqueIndex("player_tags_player_tag_idx").on(t.playerId, t.tagId),
}));

/* ============================================================
 * MATCHS  (leaguebs — superset ; + durée pour la notation stats)
 * ========================================================== */
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").references(() => seasons.id),
  competitionId: varchar("competition_id").references(() => competitions.id),
  teamHomeId: varchar("team_home_id").references(() => teams.id),
  teamAwayId: varchar("team_away_id").references(() => teams.id),
  matchType: matchTypeEnum("match_type").notNull(),
  datetime: timestamp("datetime"),
  hasTime: boolean("has_time").default(false),
  gameMode: text("game_mode"),
  map: text("map"),
  // Format de la rencontre : nombre d'affrontements (parties de la série) et
  // nombre de manches par affrontement.
  numGames: integer("num_games").default(3),
  roundsPerGame: integer("rounds_per_game").default(3),
  // Durée en secondes — nécessaire à la normalisation des dégâts (notation).
  durationSeconds: integer("duration_seconds").default(150),
  moderator: text("moderator"),
  status: matchStatusEnum("status").default("upcoming"),
  tokensStake: integer("tokens_stake").default(10),
  oddsHome: decimal("odds_home", { precision: 4, scale: 2 }),
  oddsAway: decimal("odds_away", { precision: 4, scale: 2 }),
  scoreHome: integer("score_home"),
  scoreAway: integer("score_away"),
  winnerId: varchar("winner_id").references(() => teams.id),
  drifterHomeId: varchar("drifter_home_id").references(() => players.id),
  drifterAwayId: varchar("drifter_away_id").references(() => players.id),
  modifier: text("modifier"),
  notes: text("notes"),
  hasDelay: boolean("has_delay").default(false),
  delayMinutes: integer("delay_minutes"),
  mapProposalHome: text("map_proposal_home"),
  mapProposalAway: text("map_proposal_away"),
  mapBetHome: integer("map_bet_home").default(0),
  mapBetAway: integer("map_bet_away").default(0),
  gameModeProposalHome: text("game_mode_proposal_home"),
  gameModeProposalAway: text("game_mode_proposal_away"),
  modifierProposalHome: text("modifier_proposal_home"),
  modifierProposalAway: text("modifier_proposal_away"),
  penaltyHome: integer("penalty_home").default(0),
  penaltyAway: integer("penalty_away").default(0),
  screenshotUrl: text("screenshot_url"),
  seriesId: varchar("series_id"),
  gameNumber: integer("game_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * STATS PAR MATCH & NOTATION  (statsbs)
 * Rappel : en partie privée, le jeu ne remonte que le dernier round (bug).
 * Les stats sont donc un signal secondaire du classement (§14.2 du CDC).
 * ========================================================== */
export const matchPlayerStats = pgTable("match_player_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id).notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id).notNull(),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  damage: integer("damage").notNull().default(0),
  victory: boolean("victory").notNull().default(false),
  starPlayer: boolean("star_player").notNull().default(false),
  clutch: integer("clutch").notNull().default(0),
  tripleKill: integer("triple_kill").notNull().default(0),
  impolitesse: real("impolitesse").notNull().default(0),
  objectif: real("objectif").notNull().default(0),
  starhunter: integer("starhunter").notNull().default(0),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  notePerf: real("note_perf").notNull().default(0),
  impact: real("impact").notNull().default(0),
  noteFinale: real("note_finale").notNull().default(0),
});

// Paramètres de notation configurables (coefficients, valeurs de référence).
export const leagueParameters = pgTable("league_parameters", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  value: real("value").notNull(),
});

/* ============================================================
 * RÉCOMPENSES  (statsbs)
 * ========================================================== */
export const weeklyAwards = pgTable("weekly_awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekDate: text("week_date").notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  justification: text("justification"),
  published: boolean("published").notNull().default(false),
});

export const seasonAwards = pgTable("season_awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  justification: text("justification"),
  published: boolean("published").notNull().default(false),
});

// Palmarès de cérémonie : awards riches, groupés par compétition. Récipiendaire
// flexible : joueur, équipe, liste de joueurs (best team) ou texte libre (modérateurs…).
export const awards = pgTable("awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id").references(() => competitions.id),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  justification: text("justification"),
  // player | team | players | text
  recipientType: text("recipient_type").notNull().default("player"),
  playerId: varchar("player_id").references(() => players.id),
  teamId: varchar("team_id").references(() => teams.id),
  playerIds: text("player_ids"), // JSON: string[] (pour recipientType "players")
  freeText: text("free_text"), // pour recipientType "text"
  accent: text("accent"), // couleur d'accent hex optionnelle
  featured: boolean("featured").notNull().default(false), // met en avant (ex. MVP)
  orderIndex: integer("order_index").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true, createdAt: true });
export type Award = typeof awards.$inferSelect;
export type InsertAward = typeof awards.$inferInsert;

/* ============================================================
 * TOURNOI À ÉQUIPES ALÉATOIRES (format "chaos" : trios tirés au sort chaque tour)
 * ========================================================== */
// Pool de joueurs inscrits à l'événement aléatoire.
export const randomParticipants = pgTable("random_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id").references(() => competitions.id).notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
}, (t) => ({
  uniq: uniqueIndex("random_participants_idx").on(t.competitionId, t.playerId),
}));

// Un tour : mode de jeu du jour, bans, note. Les équipes changent à chaque tour.
export const randomRounds = pgTable("random_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id").references(() => competitions.id).notNull(),
  roundNumber: integer("round_number").notNull().default(1),
  gameMode: text("game_mode"),
  bans: text("bans"), // ex. "Piper, Edgar"
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Un affrontement 3v3 d'un tour : deux trios (listes de playerId en JSON) + résultat.
export const randomMatches = pgTable("random_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roundId: varchar("round_id").references(() => randomRounds.id).notNull(),
  competitionId: varchar("competition_id").references(() => competitions.id).notNull(),
  teamA: text("team_a").notNull(), // JSON: string[] de playerId
  teamB: text("team_b").notNull(),
  scoreA: integer("score_a").default(0),
  scoreB: integer("score_b").default(0),
  winner: text("winner"), // "a" | "b" | null
  createdAt: timestamp("created_at").defaultNow(),
});

export type RandomRound = typeof randomRounds.$inferSelect;
export type RandomMatch = typeof randomMatches.$inferSelect;

/* ============================================================
 * PLAYOFFS  (leaguebs)
 * ========================================================== */
export const playoffSeries = pgTable("playoff_series", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").references(() => seasons.id),
  competitionId: varchar("competition_id").references(() => competitions.id),
  round: text("round").notNull(),
  bracketPosition: integer("bracket_position").notNull(),
  teamAId: varchar("team_a_id").references(() => teams.id),
  teamBId: varchar("team_b_id").references(() => teams.id),
  teamALabel: text("team_a_label"),
  teamBLabel: text("team_b_label"),
  bestOf: integer("best_of").notNull(),
  teamAWins: integer("team_a_wins").default(0),
  teamBWins: integer("team_b_wins").default(0),
  winnerId: varchar("winner_id").references(() => teams.id),
  status: text("status").default("pending"),
  nextSeriesId: varchar("next_series_id"),
  nextSeriesSlot: text("next_series_slot"),
  scheduledAt: timestamp("scheduled_at"),
  hasTime: boolean("has_time").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playoffSeriesVotes = pgTable("playoff_series_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar("series_id").references(() => playoffSeries.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id).notNull(),
  voterUserId: varchar("voter_user_id"),
  voterIp: text("voter_ip").notNull(),
  voterCookie: text("voter_cookie").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqByCookie: uniqueIndex("playoff_votes_series_cookie_idx").on(t.seriesId, t.voterCookie),
  uniqByIp: uniqueIndex("playoff_votes_series_ip_idx").on(t.seriesId, t.voterIp),
}));

/* ============================================================
 * DISPONIBILITÉS & CRÉNEAUX & MODÉRATION  (leaguebs)
 * ========================================================== */
export const availabilities = pgTable("availabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id),
  date: timestamp("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  status: availabilityStatusEnum("status").default("available"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeSlots = pgTable("time_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const moderatorAssignments = pgTable("moderator_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  moderators: text("moderators").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ============================================================
 * ÉCONOMIE DE JETONS & PARIS  (leaguebs)
 * NB : le devenir de la couche de paris est un point ouvert du CDC.
 * ========================================================== */
export const bettors = pgTable("bettors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visibleId: varchar("visible_id", { length: 10 }).notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  totalWagered: decimal("total_wagered", { precision: 10, scale: 2 }).default("0"),
  totalWon: decimal("total_won", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bettorId: varchar("bettor_id").references(() => bettors.id),
  matchId: varchar("match_id").references(() => matches.id),
  selectionTeamId: varchar("selection_team_id").references(() => teams.id),
  betType: text("bet_type").default("winner"),
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }).notNull(),
  odds: decimal("odds", { precision: 4, scale: 2 }).notNull(),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  status: betStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bettorId: varchar("bettor_id").references(() => bettors.id),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  betId: varchar("bet_id").references(() => bets.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tokenLedger = pgTable("token_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id),
  matchId: varchar("match_id").references(() => matches.id),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accessCodes = pgTable("access_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id),
  teamId: varchar("team_id").references(() => teams.id),
  code: varchar("code", { length: 20 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mapChangeRequests = pgTable("map_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id),
  teamId: varchar("team_id").references(() => teams.id),
  proposedMap: text("proposed_map").notNull(),
  tokensCost: integer("tokens_cost").notNull(),
  status: mapChangeStatusEnum("status").default("pending"),
  accessCodeId: varchar("access_code_id").references(() => accessCodes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * DRIFTER  (Chronos — tarification modulaire, §12.2 du CDC)
 * La ligue utilise déjà les champs drifter*Id de `matches` + tokenLedger.
 * Cette table généralise le tarif à d'autres devises (jetons, Elo, autre).
 * ========================================================== */
export const drifterEngagements = pgTable("drifter_engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id).notNull(),
  playerId: varchar("player_id").references(() => players.id).notNull(),
  fromTeamId: varchar("from_team_id").references(() => teams.id),
  toTeamId: varchar("to_team_id").references(() => teams.id),
  currency: drifterCurrencyEnum("currency").notNull().default("tokens"),
  price: real("price").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
 * UTILISATEURS & PARAMÈTRES  (leaguebs, réconcilié)
 * Auth par e-mail (leaguebs) ; le champ username de statsbs est abandonné.
 * ========================================================== */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("public"), // public | player | moderator | admin
  teamId: varchar("team_id").references(() => teams.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  label: text("label"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ============================================================
 * MODES DE JEU (référentiel notation, statsbs)
 * ========================================================== */
export type GameMode = "Brawl Ball" | "Zone Réservée" | "Razzia de gemmes" | "Braquage" | "Prime" | "Hors-jeu";

export const GAME_MODE_REFS: Record<GameMode, number> = {
  "Brawl Ball": 30000,
  "Zone Réservée": 50000,
  "Razzia de gemmes": 40000,
  "Braquage": 30000,
  "Prime": 25000,
  "Hors-jeu": 20000,
};

export const GAME_MODE_OBJECTIF_COEF: Record<GameMode, number> = {
  "Brawl Ball": 0.25,
  "Zone Réservée": 0.5,
  "Razzia de gemmes": 0.75,
  "Braquage": 1,
  "Prime": 0,
  "Hors-jeu": 0,
};

/* ============================================================
 * SCHÉMAS D'INSERTION (drizzle-zod) & TYPES
 * ========================================================== */
export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true, createdAt: true });
export const insertConferenceSchema = createInsertSchema(conferences).omit({ id: true, createdAt: true });
export const insertCompetitionSchema = createInsertSchema(competitions).omit({ id: true, createdAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true });
export const insertTierSchema = createInsertSchema(tiers).omit({ id: true });
export const insertChangelogBatchSchema = createInsertSchema(changelogBatches).omit({ id: true, createdAt: true });
export const insertEloChangelogSchema = createInsertSchema(eloChangelog).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertPlayerTagSchema = createInsertSchema(playerTags).omit({ id: true, awardedAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertMatchPlayerStatsSchema = createInsertSchema(matchPlayerStats).omit({ id: true });
export const insertLeagueParameterSchema = createInsertSchema(leagueParameters).omit({ id: true });
export const insertWeeklyAwardSchema = createInsertSchema(weeklyAwards).omit({ id: true });
export const insertSeasonAwardSchema = createInsertSchema(seasonAwards).omit({ id: true });
export const insertPlayoffSeriesSchema = createInsertSchema(playoffSeries).omit({ id: true, createdAt: true });
export const insertAvailabilitySchema = createInsertSchema(availabilities).omit({ id: true, createdAt: true });
export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({ id: true, createdAt: true });
export const insertModeratorAssignmentSchema = createInsertSchema(moderatorAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBettorSchema = createInsertSchema(bettors).omit({ id: true, createdAt: true });
export const insertBetSchema = createInsertSchema(bets).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertTokenLedgerSchema = createInsertSchema(tokenLedger).omit({ id: true, createdAt: true });
export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({ id: true, createdAt: true });
export const insertMapChangeRequestSchema = createInsertSchema(mapChangeRequests).omit({ id: true, createdAt: true });
export const insertDrifterEngagementSchema = createInsertSchema(drifterEngagements).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Conference = typeof conferences.$inferSelect;
export type InsertConference = z.infer<typeof insertConferenceSchema>;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Tier = typeof tiers.$inferSelect;
export type InsertTier = z.infer<typeof insertTierSchema>;
export type ChangelogBatch = typeof changelogBatches.$inferSelect;
export type InsertChangelogBatch = z.infer<typeof insertChangelogBatchSchema>;
export type EloChangelogEntry = typeof eloChangelog.$inferSelect;
export type InsertEloChangelogEntry = z.infer<typeof insertEloChangelogSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type PlayerTag = typeof playerTags.$inferSelect;
export type InsertPlayerTag = z.infer<typeof insertPlayerTagSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type MatchPlayerStats = typeof matchPlayerStats.$inferSelect;
export type InsertMatchPlayerStats = z.infer<typeof insertMatchPlayerStatsSchema>;
export type LeagueParameter = typeof leagueParameters.$inferSelect;
export type InsertLeagueParameter = z.infer<typeof insertLeagueParameterSchema>;
export type WeeklyAward = typeof weeklyAwards.$inferSelect;
export type InsertWeeklyAward = z.infer<typeof insertWeeklyAwardSchema>;
export type SeasonAward = typeof seasonAwards.$inferSelect;
export type InsertSeasonAward = z.infer<typeof insertSeasonAwardSchema>;
export type PlayoffSeries = typeof playoffSeries.$inferSelect;
export type InsertPlayoffSeries = z.infer<typeof insertPlayoffSeriesSchema>;
export type PlayoffSeriesVote = typeof playoffSeriesVotes.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type ModeratorAssignment = typeof moderatorAssignments.$inferSelect;
export type InsertModeratorAssignment = z.infer<typeof insertModeratorAssignmentSchema>;
export type Bettor = typeof bettors.$inferSelect;
export type InsertBettor = z.infer<typeof insertBettorSchema>;
export type Bet = typeof bets.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TokenLedgerEntry = typeof tokenLedger.$inferSelect;
export type InsertTokenLedgerEntry = z.infer<typeof insertTokenLedgerSchema>;
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type MapChangeRequest = typeof mapChangeRequests.$inferSelect;
export type InsertMapChangeRequest = z.infer<typeof insertMapChangeRequestSchema>;
export type DrifterEngagement = typeof drifterEngagements.$inferSelect;
export type InsertDrifterEngagement = z.infer<typeof insertDrifterEngagementSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

/* ============================================================
 * TYPES DÉRIVÉS (vues) — repris de statsbs pour l'affichage
 * ========================================================== */
export type PlayerSeasonStats = {
  playerId: string;
  pseudo: string;
  teamId: string;
  teamName: string;
  conferenceId: string;
  conferenceName: string;
  isCaptain: boolean;
  matchesPlayed: number;
  avgNoteFinale: number;
  avgNotePerf: number;
  avgImpact: number;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  totalStarPlayer: number;
  totalGoals: number;
  totalAssists: number;
  wins: number;
  losses: number;
  winRate: number;
};

// Sections éditoriales d'Hydra (À propos, Catégories et tags, Notes, Critères…).
// Contenu rédactionnel modifiable en ligne par un admin ; rendu dans les accordéons.
export const hydraSections = pgTable("hydra_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // about | tags | notes | criteria
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertHydraSectionSchema = createInsertSchema(hydraSections).omit({ id: true, updatedAt: true });
export type HydraSection = typeof hydraSections.$inferSelect;

// Mode Hydra dérivé (non stocké) — calculé à partir des signaux du joueur.
export type HydraMode = "joueurs" | "rookie" | "reserve";
