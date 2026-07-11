/**
 * Accès aux données d'administration Hydra : catalogue de tags, attribution
 * aux joueurs, et édition des seuils de tiers. Fichier séparé pour rester
 * modulaire (n'impacte pas storage.ts / hydraStorage.ts).
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  tiers, tags, playerTags,
  type Tag, type InsertTag, type Tier,
} from "@shared/schema";

export type PlayerTagRow = {
  playerId: string;
  tagId: string;
  code: string;
  label: string;
  family: "palmares" | "comportement";
  color: string | null;
};

export const hydraAdmin = {
  /* ---- Catalogue de tags ---- */
  listTags(): Promise<Tag[]> {
    return db.select().from(tags).orderBy(asc(tags.label));
  },
  async createTag(data: InsertTag): Promise<Tag> {
    const [row] = await db.insert(tags).values(data).returning();
    return row;
  },
  async updateTag(id: string, patch: Partial<InsertTag>): Promise<Tag | undefined> {
    const [row] = await db.update(tags).set(patch).where(eq(tags.id, id)).returning();
    return row;
  },
  async deleteTag(id: string): Promise<void> {
    await db.delete(playerTags).where(eq(playerTags.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));
  },

  /* ---- Attribution des tags ---- */
  async assignTag(playerId: string, tagId: string): Promise<void> {
    await db.insert(playerTags).values({ playerId, tagId }).onConflictDoNothing();
  },
  async unassignTag(playerId: string, tagId: string): Promise<void> {
    await db
      .delete(playerTags)
      .where(and(eq(playerTags.playerId, playerId), eq(playerTags.tagId, tagId)));
  },
  /** Toutes les affectations, jointes aux infos du tag (pour mapping client). */
  listPlayerTags(): Promise<PlayerTagRow[]> {
    return db
      .select({
        playerId: playerTags.playerId,
        tagId: tags.id,
        code: tags.code,
        label: tags.label,
        family: tags.family,
        color: tags.color,
      })
      .from(playerTags)
      .innerJoin(tags, eq(playerTags.tagId, tags.id));
  },

  /* ---- Édition des tiers ---- */
  async updateTier(
    id: string,
    patch: Partial<Pick<Tier, "code" | "minElo" | "orderIndex" | "color">>,
  ): Promise<Tier | undefined> {
    const [row] = await db.update(tiers).set(patch).where(eq(tiers.id, id)).returning();
    return row;
  },
};
