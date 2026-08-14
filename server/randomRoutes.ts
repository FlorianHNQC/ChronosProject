import type { Express } from "express";
import { randomStore } from "./randomStorage";

/**
 * Tournoi à équipes aléatoires. Lectures publiques ; écritures admin
 * (protégées par requireAdminWrites).
 */
export function registerRandomRoutes(app: Express) {
  app.get("/api/random/:cid/participants", async (req, res, next) => {
    try {
      res.json(await randomStore.listParticipants(req.params.cid));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/random/:cid/participants", async (req, res, next) => {
    try {
      const playerId = req.body?.playerId;
      if (!playerId) return res.status(400).json({ message: "playerId requis." });
      await randomStore.addParticipant(req.params.cid, playerId);
      res.json(await randomStore.listParticipants(req.params.cid));
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/random/:cid/participants/:playerId", async (req, res, next) => {
    try {
      await randomStore.removeParticipant(req.params.cid, req.params.playerId);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/random/:cid/rounds", async (req, res, next) => {
    try {
      res.json(await randomStore.listRounds(req.params.cid));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/random/:cid/rounds", async (req, res, next) => {
    try {
      const playerIds: string[] = Array.isArray(req.body?.playerIds) ? req.body.playerIds : [];
      if (playerIds.length < 6) return res.status(400).json({ message: "Au moins 6 joueurs présents pour former un affrontement 3v3." });
      const round = await randomStore.drawRound(req.params.cid, playerIds, req.body?.gameMode, req.body?.bans);
      res.json(round);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/random/matches/:id", async (req, res, next) => {
    try {
      const scoreA = Number(req.body?.scoreA) || 0;
      const scoreB = Number(req.body?.scoreB) || 0;
      const updated = await randomStore.setMatchResult(req.params.id, scoreA, scoreB);
      if (!updated) return res.status(404).json({ message: "Match introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/random/:cid/leaderboard", async (req, res, next) => {
    try {
      res.json(await randomStore.leaderboard(req.params.cid));
    } catch (e) {
      next(e);
    }
  });
}
