/**
 * Réglages génériques du site (table clé/valeur). Utilisé notamment pour
 * l'image de fond de la page d'accueil (clé « home_bg_url »).
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings, type Setting } from "@shared/schema";

export const settingsStore = {
  async get(key: string): Promise<Setting | undefined> {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    return row;
  },

  /** Crée ou met à jour une valeur (upsert par clé). */
  async set(key: string, value: string): Promise<Setting> {
    const existing = await this.get(key);
    if (existing) {
      const [row] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return row;
    }
    const [row] = await db.insert(settings).values({ key, value }).returning();
    return row;
  },
};
