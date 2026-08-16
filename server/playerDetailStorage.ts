/**
 * Détail d'un joueur : historique de matchs (via ses stats) et équipes.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { matches, matchPlayerStats, teams, teamPlayers } from "@shared/schema";

export type PlayerMatchRow = {
  matchId: string;
  datetime: Date | null;
  gameMode: string | null;
  competitionId: string | null;
  teamId: string;
  teamHomeId: string | null;
  teamAwayId: string | null;
  winnerId: string | null;
  kills: number;
  deaths: number;
  damage: number;
  victory: boolean;
  noteFinale: number;
  notePerf: number;
  impact: number;
  eloDelta: number | null;
};

export type PlayerTeamRow = {
  teamId: string;
  name: string;
  tag: string;
  competitionId: string | null;
  isCaptain: boolean | null;
};

export const playerDetail = {
  matches(playerId: string): Promise<PlayerMatchRow[]> {
    return db
      .select({
        matchId: matches.id,
        datetime: matches.datetime,
        gameMode: matches.gameMode,
        competitionId: matches.competitionId,
        teamId: matchPlayerStats.teamId,
        teamHomeId: matches.teamHomeId,
        teamAwayId: matches.teamAwayId,
        winnerId: matches.winnerId,
        kills: matchPlayerStats.kills,
        deaths: matchPlayerStats.deaths,
        damage: matchPlayerStats.damage,
        victory: matchPlayerStats.victory,
        noteFinale: matchPlayerStats.noteFinale,
        notePerf: matchPlayerStats.notePerf,
        impact: matchPlayerStats.impact,
        eloDelta: matchPlayerStats.eloDelta,
      })
      .from(matchPlayerStats)
      .innerJoin(matches, eq(matchPlayerStats.matchId, matches.id))
      .where(eq(matchPlayerStats.playerId, playerId))
      .orderBy(desc(matches.datetime));
  },

  teams(playerId: string): Promise<PlayerTeamRow[]> {
    return db
      .select({
        teamId: teams.id,
        name: teams.name,
        tag: teams.tag,
        competitionId: teams.competitionId,
        isCaptain: teamPlayers.isCaptain,
      })
      .from(teamPlayers)
      .innerJoin(teams, eq(teamPlayers.teamId, teams.id))
      .where(eq(teamPlayers.playerId, playerId));
  },
};
