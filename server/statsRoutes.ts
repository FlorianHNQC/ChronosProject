import type { Express } from "express";
import { statsStore } from "./statsStorage";

/**
 * Routes statistiques. Enregistrées depuis server/index.ts.
 */
export function registerStatsRoutes(app: Express) {
  // Statistiques agrégées par joueur, optionnellement scopées à une compétition.
  app.get("/api/stats/season", async (req, res, next) => {
    try {
      const competitionId = typeof req.query.competitionId === "string" ? req.query.competitionId : undefined;
      res.json(await statsStore.seasonStats(competitionId));
    } catch (e) {
      next(e);
    }
  });
}
