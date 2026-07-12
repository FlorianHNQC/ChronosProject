import type { Express } from "express";
import { playerDetail } from "./playerDetailStorage";
import { storage } from "./storage";
import { fetchPlayerProfile } from "./brawlstarsPlayerService";

/**
 * Routes de détail joueur (historique de matchs, équipes) + association d'un
 * tag Brawl Stars à un joueur EXISTANT.
 * Coexistent avec /api/players/:id défini dans routes.ts (chemins plus spécifiques).
 */
export function registerPlayerDetailRoutes(app: Express) {
  app.get("/api/players/:id/matches", async (req, res, next) => {
    try {
      res.json(await playerDetail.matches(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/players/:id/teams", async (req, res, next) => {
    try {
      res.json(await playerDetail.teams(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  // Associe un tag Brawl Stars à un joueur existant : synchronise pseudo +
  // avatar depuis l'API SANS changer l'id → l'historique (stats, matchs,
  // rosters) reste rattaché au même joueur.
  app.post("/api/players/:id/link", async (req, res, next) => {
    try {
      const { tag } = req.body ?? {};
      if (!tag || typeof tag !== "string") {
        return res.status(400).json({ message: "Champ « tag » requis." });
      }
      const profile = await fetchPlayerProfile(tag);
      const existing = await storage.getPlayerByTag(profile.tag);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ message: "Ce tag est déjà associé à un autre joueur." });
      }
      const updated = await storage.updatePlayer(req.params.id, {
        playerTag: profile.tag,
        iconId: profile.iconId ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
        pseudo: profile.name,
      });
      if (!updated) return res.status(404).json({ message: "Joueur introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });
}
