/**
 * Validation des compositions d'équipe (§13 du CDC).
 * Les règles vivent dans competitions.rulesetJson : budget de points par tier
 * et/ou quotas maximum par tier. La composition proposée est évaluée en dérivant
 * le tier de chaque joueur depuis son Elo.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { competitions, players, tiers } from "@shared/schema";
import { tierForElo } from "@shared/tiers";

export type Ruleset = {
  budget?: number;
  tierPoints?: Record<string, number>;
  maxPerTier?: Record<string, number>;
};

export type ValidationResult = {
  valid: boolean;
  budget: number | null;
  points: number;
  reasons: string[];
  perTier: Record<string, number>;
};

export const validationStore = {
  async validate(competitionId: string, playerIds: string[]): Promise<ValidationResult> {
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
    let ruleset: Ruleset = {};
    try {
      ruleset = comp?.rulesetJson ? JSON.parse(comp.rulesetJson) : {};
    } catch {
      ruleset = {};
    }
    const allTiers = await db.select().from(tiers);
    const rows = playerIds.length
      ? await db.select({ id: players.id, elo: players.elo }).from(players).where(inArray(players.id, playerIds))
      : [];

    const perTier: Record<string, number> = {};
    let points = 0;
    for (const p of rows) {
      const t = tierForElo(p.elo, allTiers);
      const code = t?.code ?? "N/C";
      perTier[code] = (perTier[code] ?? 0) + 1;
      points += ruleset.tierPoints?.[code] ?? 0;
    }

    const reasons: string[] = [];
    const budget = ruleset.budget ?? null;
    if (budget != null && points > budget) {
      reasons.push(`Budget dépassé : ${points} points pour un maximum de ${budget}.`);
    }
    if (ruleset.maxPerTier) {
      for (const [code, max] of Object.entries(ruleset.maxPerTier)) {
        if ((perTier[code] ?? 0) > max) {
          reasons.push(`Trop de joueurs ${code} : ${perTier[code]} (max ${max}).`);
        }
      }
    }
    return { valid: reasons.length === 0, budget, points, reasons, perTier };
  },
};
