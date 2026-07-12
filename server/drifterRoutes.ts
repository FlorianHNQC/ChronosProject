import type { Express } from "express";
import { drifterStore } from "./drifterStorage";

/**
 * Routes des engagements de drifter.
 */
export function registerDrifterRoutes(app: Express) {
  app.get("/api/matches/:id/drifters", async (req, res, next) => {
    try {
      res.json(await drifterStore.listForMatch(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  // Body : { playerId, fromTeamId?, toTeamId?, currency?, price? }
  app.post("/api/matches/:id/drifters", async (req, res, next) => {
    try {
      const { playerId, fromTeamId, toTeamId, currency, price } = req.body ?? {};
      if (!playerId) return res.status(400).json({ message: "Champ « playerId » requis." });
      const cur = currency === "elo" || currency === "other" ? currency : "tokens";
      const row = await drifterStore.create({
        matchId: req.params.id,
        playerId,
        fromTeamId: fromTeamId || undefined,
        toTeamId: toTeamId || undefined,
        currency: cur,
        price: Number(price) || 0,
      });
      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/drifters/:id", async (req, res, next) => {
    try {
      await drifterStore.remove(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
