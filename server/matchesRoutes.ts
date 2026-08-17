import type { Express } from "express";
import { matchesStore } from "./matchesStorage";

/**
 * Routes matchs. Enregistrées depuis server/index.ts.
 * Scopées par compétition (?competitionId=).
 */
export function registerMatchesRoutes(app: Express) {
  app.get("/api/matches", async (req, res, next) => {
    try {
      const competitionId = typeof req.query.competitionId === "string" ? req.query.competitionId : undefined;
      res.json(await matchesStore.list(competitionId));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/matches/:id", async (req, res, next) => {
    try {
      const m = await matchesStore.get(req.params.id);
      if (!m) return res.status(404).json({ message: "Match introuvable." });
      res.json(m);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/matches/:id/stats", async (req, res, next) => {
    try {
      res.json(await matchesStore.stats(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/matches", async (req, res, next) => {
    try {
      const { competitionId, teamHomeId, teamAwayId, matchType, datetime, gameMode, map, mapHidden, numGames, roundsPerGame, modifier } = req.body ?? {};
      if (!teamHomeId || !teamAwayId) {
        return res.status(400).json({ message: "Les deux équipes sont requises." });
      }
      if (teamHomeId === teamAwayId) {
        return res.status(400).json({ message: "Une équipe ne peut pas s'affronter elle-même." });
      }
      const posInt = (v: unknown, d: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
      };
      const m = await matchesStore.create({
        competitionId: competitionId || undefined,
        teamHomeId,
        teamAwayId,
        matchType: matchType || "intra",
        datetime: datetime ? new Date(datetime) : undefined,
        hasTime: !!datetime,
        gameMode: gameMode || undefined,
        map: map || undefined,
        mapHidden: !!mapHidden,
        numGames: posInt(numGames, 3),
        roundsPerGame: posInt(roundsPerGame, 3),
        modifier: modifier || undefined,
        status: "upcoming",
      });
      res.status(201).json(m);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/matches/:id", async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const patch: Record<string, unknown> = {};
      for (const k of ["scoreHome", "scoreAway", "winnerId", "status", "gameMode", "map", "mapHidden", "matchType", "numGames", "roundsPerGame", "modifier", "pointsHome", "pointsAway"]) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      if (b.datetime !== undefined) {
        patch.datetime = b.datetime ? new Date(b.datetime) : null;
        patch.hasTime = !!b.datetime;
      }
      const m = await matchesStore.update(req.params.id, patch);
      if (!m) return res.status(404).json({ message: "Match introuvable." });
      res.json(m);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/matches/:id", async (req, res, next) => {
    try {
      await matchesStore.remove(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
