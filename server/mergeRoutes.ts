import type { Express } from "express";
import { mergeStore } from "./mergeStorage";
import { storage } from "./storage";

/**
 * Routes de nettoyage : suggestions de doublons + fusion de joueurs.
 */
export function registerMergeRoutes(app: Express) {
  // Groupes de joueurs partageant un pseudo normalisé (candidats à la fusion).
  app.get("/api/admin/duplicate-suggestions", async (_req, res, next) => {
    try {
      const players = await storage.listPlayers();
      const groups = new Map<string, typeof players>();
      for (const p of players) {
        const key = (p.pseudo || "").trim().toLowerCase();
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }
      const out = Array.from(groups.values())
        .filter((g) => g.length > 1)
        .map((g) => ({ pseudo: g[0].pseudo, players: g }));
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  // Fusionne sourceId dans targetId.
  app.post("/api/admin/merge-players", async (req, res, next) => {
    try {
      const { targetId, sourceId } = req.body ?? {};
      await mergeStore.mergePlayers(targetId, sourceId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
