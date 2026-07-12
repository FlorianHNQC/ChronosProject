/**
 * Équipes et rosters, scopés par compétition.
 *
 * La composition passe par la table team_players (roster) : un joueur est lié à
 * une équipe DANS une compétition. Les équipes portent competitionId, donc
 * archiver une compétition fige naturellement ses équipes et effectifs.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { teams, teamPlayers, players, type Team, type InsertTeam } from "@shared/schema";

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

  async remove(id: string): Promise<void> {
    await db.delete(teamPlayers).where(eq(teamPlayers.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
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
