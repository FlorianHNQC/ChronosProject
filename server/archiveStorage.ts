/**
 * Consultation de l'archive : playoffs (bracket) et récompenses.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { playoffSeries, weeklyAwards, seasonAwards, players, type PlayoffSeries } from "@shared/schema";

export type AwardRow = {
  id: string;
  label: string; // date (hebdo) ou catégorie (saison)
  pseudo: string | null;
  avatarUrl: string | null;
  justification: string | null;
};

export const archiveStore = {
  playoffs(competitionId: string): Promise<PlayoffSeries[]> {
    return db
      .select()
      .from(playoffSeries)
      .where(eq(playoffSeries.competitionId, competitionId))
      .orderBy(asc(playoffSeries.bracketPosition));
  },

  weeklyAwards(): Promise<AwardRow[]> {
    return db
      .select({
        id: weeklyAwards.id,
        label: weeklyAwards.weekDate,
        pseudo: players.pseudo,
        avatarUrl: players.avatarUrl,
        justification: weeklyAwards.justification,
      })
      .from(weeklyAwards)
      .innerJoin(players, eq(weeklyAwards.playerId, players.id))
      .orderBy(desc(weeklyAwards.weekDate));
  },

  seasonAwards(): Promise<AwardRow[]> {
    return db
      .select({
        id: seasonAwards.id,
        label: seasonAwards.category,
        pseudo: players.pseudo,
        avatarUrl: players.avatarUrl,
        justification: seasonAwards.justification,
      })
      .from(seasonAwards)
      .innerJoin(players, eq(seasonAwards.playerId, players.id));
  },
};
