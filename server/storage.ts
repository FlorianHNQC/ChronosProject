/**
 * Couche d'accès aux données (Chronos).
 *
 * FONDATION V1 : centrée sur les joueurs. Les autres entités (équipes,
 * compétitions, matchs, classement…) seront ajoutées au fil des incréments.
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { players, type Player, type InsertPlayer } from "@shared/schema";
import type { BrawlPlayerProfile } from "./brawlstarsPlayerService";

export const storage = {
  async listPlayers(): Promise<Player[]> {
    return db.select().from(players).orderBy(players.pseudo);
  },

  async getPlayer(id: string): Promise<Player | undefined> {
    const [row] = await db.select().from(players).where(eq(players.id, id));
    return row;
  },

  async getPlayerByTag(tag: string): Promise<Player | undefined> {
    const [row] = await db.select().from(players).where(eq(players.playerTag, tag));
    return row;
  },

  async createPlayer(data: InsertPlayer): Promise<Player> {
    const [row] = await db.insert(players).values(data).returning();
    return row;
  },

  async updatePlayer(id: string, patch: Partial<InsertPlayer>): Promise<Player | undefined> {
    const [row] = await db.update(players).set(patch).where(eq(players.id, id)).returning();
    return row;
  },

  async deletePlayer(id: string): Promise<void> {
    await db.delete(players).where(eq(players.id, id));
  },

  /** Mappe un profil API Brawl Stars vers les colonnes `players`. */
  profileToInsert(profile: BrawlPlayerProfile, extra: Partial<InsertPlayer> = {}): InsertPlayer {
    return {
      pseudo: profile.name,
      playerTag: profile.tag,
      iconId: profile.iconId ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      ...extra,
    } as InsertPlayer;
  },
};

export type Storage = typeof storage;
