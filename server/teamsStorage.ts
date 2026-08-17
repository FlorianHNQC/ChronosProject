/**
 * Équipes et rosters, scopés par compétition.
 *
 * La composition passe par la table team_players (roster) : un joueur est lié à
 * une équipe DANS une compétition. Les équipes portent competitionId, donc
 * archiver une compétition fige naturellement ses équipes et effectifs.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { teams, teamPlayers, players, conferences, type Team, type InsertTeam, type Conference } from "@shared/schema";

export type RosterMember = {
  playerId: string;
  pseudo: string;
  avatarUrl: string | null;
  playerTag: string | null;
  elo: number | null;
  isCaptain: boolean | null;
};

export const teamsStore = {
  list(competitionId?: string): Promise<Team[]> {
    if (competitionId) {
      return db.select().from(teams).where(eq(teams.competitionId, competitionId));
    }
    return db.select().from(teams);
  },

  /** Toutes les conférences (= poules), pour nommer les groupes d'une compétition. */
  listConferences(): Promise<Conference[]> {
    return db.select().from(conferences);
  },

  async get(id: string): Promise<Team | undefined> {
    const [row] = await db.select().from(teams).where(eq(teams.id, id));
    return row;
  },

  async create(data: InsertTeam): Promise<Team> {
    const [row] = await db.insert(teams).values(data).returning();
    return row;
  },

  async update(id: string, patch: Partial<InsertTeam>): Promise<Team | undefined> {
    const [row] = await db.update(teams).set(patch).where(eq(teams.id, id)).returning();
    return row;
  },

  /**
   * Supprime une équipe pour ajustement, MÊME si elle a déjà des matchs/effectifs.
   * On retire d'abord toutes les références (ordre sûr pour les clés étrangères) :
   * ses matchs et leurs stats/drifters, séries de playoffs, votes, disponibilités,
   * roster ; puis on annule les références nullables (joueurs, awards, paris,
   * jetons, codes, demandes de map, utilisateurs).
   */
  async remove(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Matchs impliquant l'équipe → drifters, stats, puis matchs.
      await tx.execute(sql`DELETE FROM drifter_engagements WHERE match_id IN (SELECT id FROM matches WHERE team_home_id = ${id} OR team_away_id = ${id}) OR from_team_id = ${id} OR to_team_id = ${id}`);
      await tx.execute(sql`DELETE FROM match_player_stats WHERE match_id IN (SELECT id FROM matches WHERE team_home_id = ${id} OR team_away_id = ${id}) OR team_id = ${id}`);
      await tx.execute(sql`DELETE FROM matches WHERE team_home_id = ${id} OR team_away_id = ${id}`);
      // Playoffs : votes puis séries.
      await tx.execute(sql`DELETE FROM playoff_series_votes WHERE team_id = ${id} OR series_id IN (SELECT id FROM playoff_series WHERE team_a_id = ${id} OR team_b_id = ${id} OR winner_id = ${id})`);
      await tx.execute(sql`DELETE FROM playoff_series WHERE team_a_id = ${id} OR team_b_id = ${id} OR winner_id = ${id}`);
      // Autres rattachements directs.
      await tx.execute(sql`DELETE FROM availabilities WHERE team_id = ${id}`);
      await tx.execute(sql`DELETE FROM team_players WHERE team_id = ${id}`);
      // Références nullables : on détache sans supprimer les lignes.
      await tx.execute(sql`UPDATE players SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`UPDATE awards SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`UPDATE bets SET selection_team_id = NULL WHERE selection_team_id = ${id}`);
      await tx.execute(sql`UPDATE token_ledger SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`UPDATE access_codes SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`UPDATE map_change_requests SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`UPDATE users SET team_id = NULL WHERE team_id = ${id}`);
      await tx.execute(sql`DELETE FROM teams WHERE id = ${id}`);
    });
  },

  /* ---- Roster ---- */
  roster(teamId: string): Promise<RosterMember[]> {
    return db
      .select({
        playerId: players.id,
        pseudo: players.pseudo,
        avatarUrl: players.avatarUrl,
        playerTag: players.playerTag,
        elo: players.elo,
        isCaptain: teamPlayers.isCaptain,
      })
      .from(teamPlayers)
      .innerJoin(players, eq(teamPlayers.playerId, players.id))
      .where(eq(teamPlayers.teamId, teamId));
  },

  async addPlayer(teamId: string, playerId: string): Promise<void> {
    await db.insert(teamPlayers).values({ teamId, playerId }).onConflictDoNothing();
  },

  async removePlayer(teamId: string, playerId: string): Promise<void> {
    await db
      .delete(teamPlayers)
      .where(and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.playerId, playerId)));
  },

  async setCaptain(teamId: string, playerId: string): Promise<void> {
    await db.update(teamPlayers).set({ isCaptain: false }).where(eq(teamPlayers.teamId, teamId));
    await db
      .update(teamPlayers)
      .set({ isCaptain: true })
      .where(and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.playerId, playerId)));
  },
};
