/**
 * Paramètres du moteur Elo, éditables par l'admin (stockés dans league_parameters,
 * type = "elo"). Valeurs par défaut si non définis.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { leagueParameters } from "@shared/schema";

export type EloParams = {
  base: number; // Elo de départ par défaut
  provisionalGames: number; // nb de matchs avant de sortir de la phase provisoire
  kProvisional: number; // K en phase provisoire (calibrage rapide)
  kBase: number; // K standard
  kStableElo: number; // Elo au-delà duquel on stabilise
  kStable: number; // K des joueurs confirmés (haut de classement)
};

export const DEFAULT_ELO_PARAMS: EloParams = {
  base: 1000,
  provisionalGames: 10,
  kProvisional: 40,
  kBase: 24,
  kStableElo: 1900,
  kStable: 16,
};

const KEYS = Object.keys(DEFAULT_ELO_PARAMS) as (keyof EloParams)[];

export const eloParamsStore = {
  async get(): Promise<EloParams> {
    const rows = await db.select().from(leagueParameters).where(eq(leagueParameters.type, "elo"));
    const map = new Map(rows.map((r) => [r.name, r.value]));
    const out: EloParams = { ...DEFAULT_ELO_PARAMS };
    for (const k of KEYS) {
      const v = map.get(k);
      if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
    }
    return out;
  },

  async set(patch: Partial<EloParams>): Promise<EloParams> {
    for (const k of KEYS) {
      const v = patch[k];
      if (typeof v !== "number" || Number.isNaN(v)) continue;
      const [existing] = await db
        .select()
        .from(leagueParameters)
        .where(and(eq(leagueParameters.type, "elo"), eq(leagueParameters.name, k)));
      if (existing) {
        await db.update(leagueParameters).set({ value: v }).where(eq(leagueParameters.id, existing.id));
      } else {
        await db.insert(leagueParameters).values({ type: "elo", name: k, value: v });
      }
    }
    return this.get();
  },
};
