import type { Express } from "express";
import { competitionsStore } from "./competitionsStorage";

/**
 * Routes du cycle de vie des compétitions. Enregistrées depuis server/index.ts.
 */
export function registerCompetitionsRoutes(app: Express) {
  app.get("/api/competitions", async (req, res, next) => {
    try {
      const all = await competitionsStore.list();
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json(status ? all.filter((c) => c.status === status) : all);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/competitions/:id", async (req, res, next) => {
    try {
      const c = await competitionsStore.get(req.params.id);
      if (!c) return res.status(404).json({ message: "Compétition introuvable." });
      res.json(c);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/competitions", async (req, res, next) => {
    try {
      const { name, type, isCompetitive, affectsElo, rulesetJson } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Champ « name » requis." });
      }
      const c = await competitionsStore.create({
        name,
        type: type || "league",
        isCompetitive: isCompetitive ?? true,
        affectsElo: affectsElo ?? true,
        rulesetJson: rulesetJson || undefined,
        status: "draft",
      });
      res.status(201).json(c);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/competitions/:id", async (req, res, next) => {
    try {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "type", "status", "isCompetitive", "affectsElo", "rulesetJson"]) {
        if (req.body?.[k] !== undefined) patch[k] = req.body[k];
      }
      const c = await competitionsStore.update(req.params.id, patch);
      if (!c) return res.status(404).json({ message: "Compétition introuvable." });
      res.json(c);
    } catch (e) {
      next(e);
    }
  });

  // Clôture officielle → archivée (données historiques, lecture seule).
  app.post("/api/competitions/:id/archive", async (req, res, next) => {
    try {
      const c = await competitionsStore.archive(req.params.id);
      if (!c) return res.status(404).json({ message: "Compétition introuvable." });
      res.json(c);
    } catch (e) {
      next(e);
    }
  });

  // Nouvelle édition sous le même format (format seul).
  app.post("/api/competitions/:id/clone", async (req, res, next) => {
    try {
      const c = await competitionsStore.cloneFormat(req.params.id);
      if (!c) return res.status(404).json({ message: "Compétition introuvable." });
      res.status(201).json(c);
    } catch (e) {
      next(e);
    }
  });
}
