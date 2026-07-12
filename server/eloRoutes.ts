import type { Express } from "express";
import { eloEngine } from "./eloEngineStorage";

/**
 * Route de recalcul de l'Elo depuis les résultats.
 */
export function registerEloRoutes(app: Express) {
  // Body : { k?: number, competitionId?: string }
  app.post("/api/admin/recompute-elo", async (req, res, next) => {
    try {
      const k = req.body?.k !== undefined ? Number(req.body.k) : undefined;
      const competitionId = typeof req.body?.competitionId === "string" && req.body.competitionId
        ? req.body.competitionId
        : undefined;
      const result = await eloEngine.recompute({ k, competitionId });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
}
