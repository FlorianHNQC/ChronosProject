import type { Express } from "express";
import { teamsStore } from "./teamsStorage";

/**
 * Routes équipes + rosters. Enregistrées depuis server/index.ts.
 * Les équipes sont scopées par compétition (?competitionId=).
 */
export function registerTeamsRoutes(app: Express) {
  app.get("/api/teams", async (req, res, next) => {
    try {
      const competitionId = typeof req.query.competitionId === "string" ? req.query.competitionId : undefined;
      res.json(await teamsStore.list(competitionId));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/conferences", async (_req, res, next) => {
    try {
      res.json(await teamsStore.listConferences());
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/teams/:id", async (req, res, next) => {
    try {
      const t = await teamsStore.get(req.params.id);
      if (!t) return res.status(404).json({ message: "Équipe introuvable." });
      res.json(t);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/teams", async (req, res, next) => {
    try {
      const { name, tag, competitionId, conferenceId, logoUrl } = req.body ?? {};
      if (!name || !tag) {
        return res.status(400).json({ message: "Champs « name » et « tag » requis." });
      }
      const t = await teamsStore.create({
        name,
        tag,
        competitionId: competitionId || undefined,
        conferenceId: conferenceId || undefined,
        logoUrl: logoUrl || undefined,
      });
      res.status(201).json(t);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/teams/:id", async (req, res, next) => {
    try {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "tag", "conferenceId", "logoUrl", "competitionId"]) {
        if (req.body?.[k] !== undefined) patch[k] = req.body[k];
      }
      const t = await teamsStore.update(req.params.id, patch);
      if (!t) return res.status(404).json({ message: "Équipe introuvable." });
      res.json(t);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/teams/:id", async (req, res, next) => {
    try {
      await teamsStore.remove(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  /* ---- Roster ---- */
  app.get("/api/teams/:id/roster", async (req, res, next) => {
    try {
      res.json(await teamsStore.roster(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/teams/:id/roster", async (req, res, next) => {
    try {
      const { playerId } = req.body ?? {};
      if (!playerId) return res.status(400).json({ message: "Champ « playerId » requis." });
      await teamsStore.addPlayer(req.params.id, playerId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/teams/:id/roster/:playerId", async (req, res, next) => {
    try {
      await teamsStore.removePlayer(req.params.id, req.params.playerId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/teams/:id/roster/:playerId/captain", async (req, res, next) => {
    try {
      await teamsStore.setCaptain(req.params.id, req.params.playerId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
