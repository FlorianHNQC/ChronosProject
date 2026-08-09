import type { Express } from "express";
import { archiveStore } from "./archiveStorage";

/**
 * Routes de consultation de l'archive : playoffs.
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
}
