import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Point d'entrée des routes de l'API Chronos.
 *
 * FONDATION : ce fichier ne contient volontairement que le socle (santé /
 * ping DB). Les routes métier seront portées depuis leaguebs (compétitions,
 * playoffs, jetons…) et statsbs (stats, notation, awards) dans les incréments
 * suivants, puis complétées par les nouveautés Chronos (Elo, tiers, Hydra).
 */
export async function registerRoutes(_httpServer: Server, app: Express) {
  // Santé de l'API.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "chronos", version: "0.1.0" });
  });

  // Vérifie la connexion à la base.
  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({ status: "ok", db: "up" });
    } catch (e: any) {
      res.status(500).json({ status: "error", db: "down", message: e?.message });
    }
  });

  // TODO(incréments suivants) :
  //   - /api/players  (+ synchronisation API Brawl Stars par tag)
  //   - /api/competitions, /api/teams, /api/matches
  //   - /api/hydra    (classement, tiers, changelog, tags, modes)
  //   - portage des routes leaguebs (playoffs, jetons) et statsbs (stats).
}
