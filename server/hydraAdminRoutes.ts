import type { Express } from "express";
import { hydraAdmin } from "./hydraAdminStorage";

/**
 * Routes d'administration Hydra : tags (catalogue + attribution) et édition des
 * seuils de tiers. Enregistrées depuis server/index.ts.
 */
export function registerHydraAdminRoutes(app: Express) {
  /* ---- Tags : catalogue ---- */
  app.get("/api/tags", async (_req, res, next) => {
    try {
      res.json(await hydraAdmin.listTags());
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/tags", async (req, res, next) => {
    try {
      const { code, label, family, color, description } = req.body ?? {};
      if (!code || !label) {
        return res.status(400).json({ message: "Champs « code » et « label » requis." });
      }
      const tag = await hydraAdmin.createTag({
        code,
        label,
        family: family === "palmares" ? "palmares" : "comportement",
        color: color || undefined,
        description: description || undefined,
      });
      res.status(201).json(tag);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/tags/:id", async (req, res, next) => {
    try {
      const body = { ...(req.body ?? {}) };
      if (body.eloBonus !== undefined) body.eloBonus = Number(body.eloBonus) || 0;
      const updated = await hydraAdmin.updateTag(req.params.id, body);
      if (!updated) return res.status(404).json({ message: "Tag introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/tags/:id", async (req, res, next) => {
    try {
      await hydraAdmin.deleteTag(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  /* ---- Tags : attribution ---- */
  app.get("/api/player-tags", async (_req, res, next) => {
    try {
      res.json(await hydraAdmin.listPlayerTags());
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/players/:id/tags", async (req, res, next) => {
    try {
      const { tagId } = req.body ?? {};
      if (!tagId) return res.status(400).json({ message: "Champ « tagId » requis." });
      await hydraAdmin.assignTag(req.params.id, tagId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/players/:id/tags/:tagId", async (req, res, next) => {
    try {
      await hydraAdmin.unassignTag(req.params.id, req.params.tagId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  /* ---- Tiers : édition des seuils ---- */
  app.patch("/api/tiers/:id", async (req, res, next) => {
    try {
      const patch: Record<string, unknown> = {};
      if (req.body?.minElo !== undefined) {
        const n = Number(req.body.minElo);
        if (!Number.isFinite(n)) return res.status(400).json({ message: "minElo invalide." });
        patch.minElo = Math.round(n);
      }
      if (req.body?.color !== undefined) patch.color = req.body.color;
      if (req.body?.code !== undefined) patch.code = req.body.code;
      if (req.body?.orderIndex !== undefined) patch.orderIndex = Number(req.body.orderIndex);
      const updated = await hydraAdmin.updateTier(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Tier introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });
}
