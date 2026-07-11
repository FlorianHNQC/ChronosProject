/**
 * Accès aux données du programme Hydra (classement) : tiers, réglage d'Elo,
 * changelog. Séparé de storage.ts pour rester modulaire.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { tiers, players, eloChangelog, type Tier, type Player } from "@shared/schema";
import { tierForElo } from "@shared/tiers";

export type ChangelogRow = {
  id: string;
  playerId: string | null;
  pseudo: string | null;
  oldElo: number | null;
  newElo: number | null;
  oldTierId: string | null;
  newTierId: string | null;
  comment: string | null;
  createdAt: Date | null;
};

export const hydra = {
  async listTiers(): Promise<Tier[]> {
    return db.select().from(tiers).orderBy(tiers.orderIndex);
  },

  /** Définit l'Elo d'un joueur, recalcule son tier et journalise le changement. */
  async setPlayerElo(id: string, elo: number, comment?: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    if (!player) return undefined;

    const allTiers = await this.listTiers();
    const oldTierId = player.tierId ?? null;
    const newTierId = tierForElo(elo, allTiers)?.id ?? null;

    const [updated] = await db
      .update(players)
      .set({ elo, tierId: newTierId, lastEloChangeAt: new Date() })
      .where(eq(players.id, id))
      .returning();

    await db.insert(eloChangelog).values({
      playerId: id,
      oldElo: player.elo ?? null,
      newElo: elo,
      oldTierId,
      newTierId,
      comment: comment || null,
    });

    return updated;
  },

  async listChangelog(limit = 50): Promise<ChangelogRow[]> {
    return db
      .select({
        id: eloChangelog.id,
        playerId: eloChangelog.playerId,
        pseudo: players.pseudo,
        oldElo: eloChangelog.oldElo,
        newElo: eloChangelog.newElo,
        oldTierId: eloChangelog.oldTierId,
        newTierId: eloChangelog.newTierId,
        comment: eloChangelog.comment,
        createdAt: eloChangelog.createdAt,
      })
      .from(eloChangelog)
      .leftJoin(players, eq(eloChangelog.playerId, players.id))
      .orderBy(desc(eloChangelog.createdAt))
      .limit(limit);
  },
};
