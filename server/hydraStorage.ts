/**
 * Accès aux données du programme Hydra (classement) : tiers, réglage d'Elo,
 * changelog. Séparé de storage.ts pour rester modulaire.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { tiers, players, eloChangelog, changelogBatches, users, type Tier, type Player } from "@shared/schema";
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

/** Un lot de changements : une date, un auteur, et la liste des modifications. */
export type ChangelogChange = {
  pseudo: string | null;
  oldElo: number | null;
  newElo: number | null;
  comment: string | null;
};
export type ChangelogBatchGroup = {
  id: string;
  createdAt: Date | null;
  note: string | null;
  author: string | null; // email de l'admin (login)
  changes: ChangelogChange[];
};

export const hydra = {
  async listTiers(): Promise<Tier[]> {
    return db.select().from(tiers).orderBy(tiers.orderIndex);
  },

  /** Définit l'Elo d'un joueur, recalcule son tier et journalise le changement. */
  async setPlayerElo(id: string, elo: number, comment?: string, authorUserId?: string): Promise<Player | undefined> {
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

    // Chaque réglage manuel est journalisé dans un lot daté et attribué à l'admin.
    const [batch] = await db
      .insert(changelogBatches)
      .values({ note: "Réglage manuel", authorUserId: authorUserId ?? null })
      .returning();

    await db.insert(eloChangelog).values({
      batchId: batch.id,
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

  /**
   * Changelog groupé par lot (date + auteur). Chaque lot = une intervention d'un
   * admin à une date donnée, avec la liste des changements effectués.
   */
  async listChangelogBatches(limit = 500): Promise<ChangelogBatchGroup[]> {
    const rows = await db
      .select({
        batchId: eloChangelog.batchId,
        rowId: eloChangelog.id,
        rowCreatedAt: eloChangelog.createdAt,
        pseudo: players.pseudo,
        oldElo: eloChangelog.oldElo,
        newElo: eloChangelog.newElo,
        comment: eloChangelog.comment,
        batchCreatedAt: changelogBatches.createdAt,
        note: changelogBatches.note,
        authorEmail: users.email,
      })
      .from(eloChangelog)
      .leftJoin(players, eq(eloChangelog.playerId, players.id))
      .leftJoin(changelogBatches, eq(eloChangelog.batchId, changelogBatches.id))
      .leftJoin(users, eq(changelogBatches.authorUserId, users.id))
      .orderBy(desc(eloChangelog.createdAt))
      .limit(limit);

    const map = new Map<string, ChangelogBatchGroup>();
    for (const r of rows) {
      const key = r.batchId ?? `solo-${r.rowId}`;
      let g = map.get(key);
      if (!g) {
        g = {
          id: key,
          createdAt: r.batchCreatedAt ?? r.rowCreatedAt ?? null,
          note: r.note ?? null,
          author: r.authorEmail ?? null,
          changes: [],
        };
        map.set(key, g);
      }
      g.changes.push({
        pseudo: r.pseudo ?? null,
        oldElo: r.oldElo ?? null,
        newElo: r.newElo ?? null,
        comment: r.comment ?? null,
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
  },
};
