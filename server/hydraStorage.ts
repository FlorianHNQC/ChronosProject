/**
 * Accès aux données du programme Hydra (classement) : tiers, réglage d'Elo,
 * changelog. Séparé de storage.ts pour rester modulaire.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { tiers, players, eloChangelog, changelogBatches, users, type Tier, type Player } from "@shared/schema";
import { eloEngine } from "./eloEngineStorage";

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

  /**
   * Définit l'Elo de DÉPART (évaluation préliminaire) d'un joueur, puis relance
   * le recalcul global : l'Elo affiché part de cette valeur et est ajusté par les
   * matchs. Le recalcul journalise et attribue les changements à l'admin.
   */
  async setPlayerElo(id: string, seedElo: number, _comment?: string, authorUserId?: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    if (!player) return undefined;

    await db.update(players).set({ seedElo }).where(eq(players.id, id));
    await eloEngine.recompute({ authorUserId });

    const [updated] = await db.select().from(players).where(eq(players.id, id));
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
