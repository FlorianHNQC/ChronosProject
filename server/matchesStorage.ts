/**
 * Matchs et stats de match, scopés par compétition.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { matches, matchPlayerStats, players, type Match, type InsertMatch } from "@shared/schema";

export type MatchStatRow = {
  playerId: string;
  pseudo: string;
  teamId: string;
  kills: number;
  deaths: number;
  damage: number;
  goals: number;
  assists: number;
  starPlayer: boolean;
  notePerf: number;
  impact: number;
  noteFinale: number;
};

export const matchesStore = {
  list(competitionId?: string): Promise<Match[]> {
    if (competitionId) {
      return db
        .select()
        .from(matches)
        .where(eq(matches.competitionId, competitionId))
        .orderBy(asc(matches.datetime));
    }
    return db.select().from(matches).orderBy(desc(matches.createdAt));
  },

  async get(id: string): Promise<Match | undefined> {
    const [row] = await db.select().from(matches).where(eq(matches.id, id));
    return row;
  },

  async create(data: InsertMatch): Promise<Match> {
    const [row] = await db.insert(matches).values(data).returning();
    return row;
  },

  async update(id: string, patch: Partial<InsertMatch>): Promise<Match | undefined> {
    const [row] = await db.update(matches).set(patch).where(eq(matches.id, id)).returning();
    return row;
  },

  async remove(id: string): Promise<void> {
    await db.delete(matchPlayerStats).where(eq(matchPlayerStats.matchId, id));
    await db.delete(matches).where(eq(matches.id, id));
  },

  stats(matchId: string): Promise<MatchStatRow[]> {
    return db
      .select({
        playerId: players.id,
        pseudo: players.pseudo,
        teamId: matchPlayerStats.teamId,
        kills: matchPlayerStats.kills,
        deaths: matchPlayerStats.deaths,
        damage: matchPlayerStats.damage,
        goals: matchPlayerStats.goals,
        assists: matchPlayerStats.assists,
        starPlayer: matchPlayerStats.starPlayer,
        notePerf: matchPlayerStats.notePerf,
        impact: matchPlayerStats.impact,
        noteFinale: matchPlayerStats.noteFinale,
      })
      .from(matchPlayerStats)
      .innerJoin(players, eq(matchPlayerStats.playerId, players.id))
      .where(eq(matchPlayerStats.matchId, matchId));
  },
};
