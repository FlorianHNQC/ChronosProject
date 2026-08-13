import type { Express } from "express";
import { eloEngine } from "./eloEngineStorage";
import { eloParamsStore, type EloParams } from "./eloParamsStorage";

/**
 * Routes du moteur Elo : recalcul depuis les résultats + paramètres éditables.
 */
export function registerEloRoutes(app: Express) {
  // Lecture des paramètres du moteur Elo (public).
  app.get("/api/elo/params", async (_req, res, next) => {
    try {
      res.json(await eloParamsStore.get());
    } catch (e) {
      next(e);
    }
  });

  // Mise à jour des paramètres (admin — protégé par requireAdminWrites).
  app.put("/api/elo/params", async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const patch: Partial<EloParams> = {};
      for (const k of ["base", "provisionalGames", "kProvisional", "kBase", "kStableElo", "kStable"] as (keyof EloParams)[]) {
        if (b[k] !== undefined && b[k] !== "" && !Number.isNaN(Number(b[k]))) patch[k] = Number(b[k]);
      }
      res.json(await eloParamsStore.set(patch));
    } catch (e) {
      next(e);
    }
  });

  // Body : { k?: number, competitionId?: string }
  app.post("/api/admin/recompute-elo", async (req, res, next) => {
    try {
      const k = req.body?.k !== undefined ? Number(req.body.k) : undefined;
      const competitionId = typeof req.body?.competitionId === "string" && req.body.competitionId
        ? req.body.competitionId
        : undefined;
      const result = await eloEngine.recompute({ k, competitionId, authorUserId: req.session.userId });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
}
