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

  app.patch("/api/random/:cid/participants/:playerId", async (req, res, next) => {
    try {
      await randomStore.setParticipantPool(req.params.cid, req.params.playerId, req.body?.poolLabel ?? null);
      res.json(await randomStore.listParticipants(req.params.cid));
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
      const round = await randomStore.drawRound(req.params.cid, playerIds, {
        gameMode: req.body?.gameMode,
        bans: req.body?.bans,
        balanceElo: !!req.body?.balanceElo,
        randomMode: !!req.body?.randomMode,
      });
      res.json(round);
    } catch (e) {
      next(e);
    }
  });

  // Affrontement composé à la main (sans équipe persistante).
  app.post("/api/random/:cid/matches", async (req, res, next) => {
    try {
      const teamA: string[] = Array.isArray(req.body?.teamA) ? req.body.teamA : [];
      const teamB: string[] = Array.isArray(req.body?.teamB) ? req.body.teamB : [];
      if (teamA.length === 0 || teamB.length === 0) {
        return res.status(400).json({ message: "Sélectionne au moins un joueur de chaque côté." });
      }
      const round = await randomStore.addManualMatch(req.params.cid, {
        roundId: req.body?.roundId || undefined,
        teamA, teamB,
        gameMode: req.body?.gameMode,
        map: req.body?.map,
      });
      res.json(round);
    } catch (e) {
      next(e);
    }
  });

  // Publie les affrontements des poules (round-robin intra, ou tirage inter).
  app.post("/api/random/:cid/generate-poules", async (req, res, next) => {
    try {
      const scope = req.body?.scope === "inter" ? "inter" : "intra";
      const round = await randomStore.generatePoules(req.params.cid, { scope, balanceElo: !!req.body?.balanceElo });
      res.json(round);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/random/:cid/rounds/:roundId", async (req, res, next) => {
    try {
      await randomStore.deleteRound(req.params.roundId);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/random/matches/:id", async (req, res, next) => {
    try {
      const b = req.body ?? {};
      // Métadonnées (mode/map) et/ou résultat.
      if (b.gameMode !== undefined || b.map !== undefined) {
        await randomStore.setMatchMeta(req.params.id, { gameMode: b.gameMode, map: b.map });
      }
      if (b.scoreA !== undefined || b.scoreB !== undefined) {
        const updated = await randomStore.setMatchResult(req.params.id, Number(b.scoreA) || 0, Number(b.scoreB) || 0);
        if (!updated) return res.status(404).json({ message: "Match introuvable." });
        return res.json(updated);
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/random/matches/:id", async (req, res, next) => {
    try {
      await randomStore.deleteMatch(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/random/suggestions", async (_req, res, next) => {
    try {
      res.json(await randomStore.suggestions());
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
