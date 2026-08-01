/**
 * Accès aux sections éditoriales d'Hydra (À propos, Catégories et tags, Notes,
 * Critères…). Lecture publique ; mise à jour réservée aux admins (voir routes).
 */
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { hydraSections, type HydraSection } from "@shared/schema";

export const hydraSectionsStore = {
  /** Toutes les sections, dans l'ordre d'affichage. */
  list(): Promise<HydraSection[]> {
    return db.select().from(hydraSections).orderBy(asc(hydraSections.orderIndex));
  },

  /** Met à jour le titre et le corps d'une section (par clé). Renvoie la ligne à jour. */
  async update(key: string, title: string, body: string): Promise<HydraSection | undefined> {
    const [row] = await db
      .update(hydraSections)
      .set({ title, body, updatedAt: new Date() })
      .where(eq(hydraSections.key, key))
      .returning();
    return row;
  },
};
