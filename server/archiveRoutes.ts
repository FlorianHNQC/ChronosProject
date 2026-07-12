import type { Express } from "express";
import { archiveStore } from "./archiveStorage";

/**
 * Routes de consultation de l'archive : playoffs et récompenses.
 */
export function registerArchiveRoutes(app: Express) {
  app.get("/api/playoffs", async (req, res, next) => {
    try {
      const competitionId = typeof req.query.competitionId === "string" ? req.query.competitionId : undefined;
      if (!competitionId) return res.json([]);
      res.json(await archiveStore.playoffs(competitionId));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/awards", async (_req, res, next) => {
    try {
      const [weekly, season] = await Promise.all([
        archiveStore.weeklyAwards(),
        archiveStore.seasonAwards(),
      ]);
      res.json({ weekly, season });
    } catch (e) {
      next(e);
    }
  });
}
