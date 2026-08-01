import type { Express } from "express";
import { hydraSectionsStore } from "./hydraSectionsStorage";

/**
 * Routes des sections éditoriales d'Hydra.
 * - GET  /api/hydra/sections        : liste publique (ordonnée).
 * - PUT  /api/hydra/sections/:key   : mise à jour (admin — garanti par requireAdminWrites,
 *   qui laisse passer les GET mais exige un admin pour toute écriture).
 */
export function registerHydraSectionsRoutes(app: Express) {
  app.get("/api/hydra/sections", async (_req, res, next) => {
    try {
      res.json(await hydraSectionsStore.list());
    } catch (e) {
      next(e);
    }
  });

  app.put("/api/hydra/sections/:key", async (req, res, next) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const body = typeof req.body?.body === "string" ? req.body.body : "";
      if (!title) return res.status(400).json({ message: "Titre requis." });
      const updated = await hydraSectionsStore.update(req.params.key, title, body);
      if (!updated) return res.status(404).json({ message: "Section introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });
}
