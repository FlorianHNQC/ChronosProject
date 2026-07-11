import { db } from "./db";
import { tiers } from "@shared/schema";
import { DEFAULT_TIERS } from "@shared/tiers";

/**
 * Insère les données par défaut si absentes. Idempotent : ne fait rien si les
 * tiers existent déjà. Appelé au démarrage (échec silencieux si DB indisponible).
 */
export async function seedDefaults(): Promise<void> {
  const existing = await db.select().from(tiers);
  if (existing.length === 0) {
    await db.insert(tiers).values(DEFAULT_TIERS);
    console.log("[seed] paliers de tiers créés");
  }
}
