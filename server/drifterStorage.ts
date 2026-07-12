/**
 * Engagements de drifter (§12.2 du CDC) : un joueur d'une autre équipe engagé
 * pour un match, à un tarif modulaire (jetons, Elo, autre).
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { drifterEngagements, players, type InsertDrifterEngagement } from "@shared/schema";

export type DrifterRow = {
  id: string;
  matchId: string;
  playerId: string;
  pseudo: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  currency: "tokens" | "elo" | "other";
  price: number;
  createdAt: Date | null;
};

export const drifterStore = {
  listForMatch(matchId: string): Promise<DrifterRow[]> {
    return db
      .select({
        id: drifterEngagements.id,
        matchId: drifterEngagements.matchId,
        playerId: drifterEngagements.playerId,
        pseudo: players.pseudo,
        fromTeamId: drifterEngagements.fromTeamId,
        toTeamId: drifterEngagements.toTeamId,
        currency: drifterEngagements.currency,
        price: drifterEngagements.price,
        createdAt: drifterEngagements.createdAt,
      })
      .from(drifterEngagements)
      .innerJoin(players, eq(drifterEngagements.playerId, players.id))
      .where(eq(drifterEngagements.matchId, matchId))
      .orderBy(desc(drifterEngagements.createdAt));
  },

  async create(data: InsertDrifterEngagement) {
    const [row] = await db.insert(drifterEngagements).values(data).returning();
    return row;
  },

  async remove(id: string): Promise<void> {
    await db.delete(drifterEngagements).where(eq(drifterEngagements.id, id));
  },
};
