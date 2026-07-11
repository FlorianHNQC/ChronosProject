/**
 * Cycle de vie des compétitions (modularité pré-merge).
 *
 * Une « ligue » est une compétition (type league) datée. Elle passe par
 * draft → active → archived. Archiver fige l'instance (données historiques) ;
 * cloner crée une nouvelle compétition en brouillon reprenant UNIQUEMENT le
 * format (type, règles, restrictions), sans les équipes ni les résultats.
 *
 * L'Elo/Hydra est indépendant des ligues : rien ici ne le touche.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { competitions, type Competition, type InsertCompetition } from "@shared/schema";

export const competitionsStore = {
  list(): Promise<Competition[]> {
    return db.select().from(competitions).orderBy(desc(competitions.createdAt));
  },

  async get(id: string): Promise<Competition | undefined> {
    const [row] = await db.select().from(competitions).where(eq(competitions.id, id));
    return row;
  },

  async create(data: InsertCompetition): Promise<Competition> {
    const [row] = await db.insert(competitions).values(data).returning();
    return row;
  },

  async update(id: string, patch: Partial<InsertCompetition>): Promise<Competition | undefined> {
    const [row] = await db.update(competitions).set(patch).where(eq(competitions.id, id)).returning();
    return row;
  },

  /** Clôture officielle : passe en archivée et fige la date. */
  async archive(id: string): Promise<Competition | undefined> {
    const [row] = await db
      .update(competitions)
      .set({ status: "archived", closedAt: new Date() })
      .where(eq(competitions.id, id))
      .returning();
    return row;
  },

  /** Nouvelle édition sous le même format (format seul, aucune donnée). */
  async cloneFormat(id: string): Promise<Competition | undefined> {
    const src = await this.get(id);
    if (!src) return undefined;
    const [row] = await db
      .insert(competitions)
      .values({
        name: `${src.name} (nouvelle édition)`,
        type: src.type,
        seasonId: null,
        isCompetitive: src.isCompetitive,
        affectsElo: src.affectsElo,
        rulesetJson: src.rulesetJson,
        status: "draft",
      })
      .returning();
    return row;
  },
};
