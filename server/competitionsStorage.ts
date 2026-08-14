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
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { competitions, competitionPhases, type Competition, type InsertCompetition, type CompetitionPhase } from "@shared/schema";

type PhaseInput = { name?: string; type?: string; config?: unknown };

export const competitionsStore = {
  list(): Promise<Competition[]> {
    return db.select().from(competitions).orderBy(desc(competitions.createdAt));
  },

  listPhases(competitionId: string): Promise<CompetitionPhase[]> {
    return db.select().from(competitionPhases).where(eq(competitionPhases.competitionId, competitionId)).orderBy(asc(competitionPhases.orderIndex));
  },

  /** Remplace toutes les phases d'une compétition (dans l'ordre fourni). */
  async replacePhases(competitionId: string, phases: PhaseInput[]): Promise<void> {
    await db.delete(competitionPhases).where(eq(competitionPhases.competitionId, competitionId));
    if (phases.length) {
      await db.insert(competitionPhases).values(
        phases.map((p, i) => ({
          competitionId,
          orderIndex: i,
          name: p.name || `Phase ${i + 1}`,
          type: p.type || "season",
          config: p.config == null ? null : typeof p.config === "string" ? p.config : JSON.stringify(p.config),
        })),
      );
    }
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

  /** Supprime une compétition (et ses phases). Échoue si des données y sont rattachées (FK). */
  async remove(id: string): Promise<void> {
    await db.delete(competitionPhases).where(eq(competitionPhases.competitionId, id));
    await db.delete(competitions).where(eq(competitions.id, id));
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
