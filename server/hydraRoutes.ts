import type { Express } from "express";
import { hydra } from "./hydraStorage";

/**
 * Routes du programme Hydra (classement par tiers).
 * Enregistrées depuis server/index.ts.
 */
export function registerHydraRoutes(app: Express) {
  // Catalogue des tiers (paliers d'Elo), ordonné du plus haut au plus bas.
  app.get("/api/tiers", async (_req, res, next) => {
    try {
      res.json(await hydra.listTiers());
    } catch (e) {
      next(e);
    }
  });

  // Réglage manuel de l'Elo d'un joueur (admin). Recalcule le tier + journalise.
  // Body : { elo: number, comment?: string }
  app.patch("/api/players/:id/elo", async (req, res, next) => {
    try {
      const elo = Number(req.body?.elo);
      if (!Number.isFinite(elo)) {
        return res.status(400).json({ message: "Valeur d'Elo invalide." });
      }
      const updated = await hydra.setPlayerElo(req.params.id, Math.round(elo), req.body?.comment, req.session.userId);
      if (!updated) return res.status(404).json({ message: "Joueur introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  // Journal (changelog) des évolutions de classement, plus récent d'abord.
  app.get("/api/hydra/changelog", async (_req, res, next) => {
    try {
      res.json(await hydra.listChangelog());
    } catch (e) {
      next(e);
    }
  });

  // Changelog groupé par lot (date + auteur) pour la navigation par date.
  app.get("/api/hydra/changelog/batches", async (_req, res, next) => {
    try {
      res.json(await hydra.listChangelogBatches());
    } catch (e) {
      next(e);
    }
  });
}
