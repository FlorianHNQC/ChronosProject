/**
 * Agrégation des statistiques de joueurs à partir de match_player_stats.
 * Scopée par compétition via la jointure sur matches.competitionId.
 *
 * Rappel : en partie privée, le jeu ne remonte que le dernier round (bug) ;
 * ces stats sont donc indicatives et ne pilotent pas l'Elo à elles seules.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { matchPlayerStats, matches, players } from "@shared/schema";

export type PlayerAgg = {
  playerId: string;
  pseudo: string;
  avatarUrl: string | null;
  matchesPlayed: number;
  wins: number;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  totalGoals: number;
  totalAssists: number;
  totalStarPlayer: number;
  avgNoteFinale: number;
  avgNotePerf: number;
  avgImpact: number;
};

export const statsStore = {
  seasonStats(competitionId?: string): Promise<PlayerAgg[]> {
    return db
      .select({
        playerId: players.id,
        pseudo: players.pseudo,
        avatarUrl: players.avatarUrl,
        matchesPlayed: sql<number>`count(*)::int`,
        wins: sql<number>`sum(case when ${matchPlayerStats.victory} then 1 else 0 end)::int`,
        totalKills: sql<number>`coalesce(sum(${matchPlayerStats.kills}),0)::int`,
        totalDeaths: sql<number>`coalesce(sum(${matchPlayerStats.deaths}),0)::int`,
        totalDamage: sql<number>`coalesce(sum(${matchPlayerStats.damage}),0)::int`,
        totalGoals: sql<number>`coalesce(sum(${matchPlayerStats.goals}),0)::int`,
        totalAssists: sql<number>`coalesce(sum(${matchPlayerStats.assists}),0)::int`,
        totalStarPlayer: sql<number>`sum(case when ${matchPlayerStats.starPlayer} then 1 else 0 end)::int`,
        avgNoteFinale: sql<number>`coalesce(avg(${matchPlayerStats.noteFinale}),0)::float`,
        avgNotePerf: sql<number>`coalesce(avg(${matchPlayerStats.notePerf}),0)::float`,
        avgImpact: sql<number>`coalesce(avg(${matchPlayerStats.impact}),0)::float`,
      })
      .from(matchPlayerStats)
      .innerJoin(players, eq(matchPlayerStats.playerId, players.id))
      .innerJoin(matches, eq(matchPlayerStats.matchId, matches.id))
      .where(competitionId ? eq(matches.competitionId, competitionId) : sql`true`)
      .groupBy(players.id, players.pseudo, players.avatarUrl);
  },
};
