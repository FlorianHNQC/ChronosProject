import type { Express } from "express";
import { competitionsStore } from "./competitionsStorage";
import type { InsertCompetition } from "@shared/schema";

/**
 * Routes du cycle de vie des compétitions. Enregistrées depuis server/index.ts.
 */
// Extrait les options de format/dates du corps de requête (coercion sûre).
function optionFields(b: Record<string, any>): Partial<InsertCompetition> {
  const o: Partial<InsertCompetition> = {};
  const num = (v: any): number | null => (v === null || v === "" || v === undefined ? null : Number(v));
  if (b.startsAt !== undefined) o.startsAt = b.startsAt ? new Date(b.startsAt) : null;
  if (b.endsAt !== undefined) o.endsAt = b.endsAt ? new Date(b.endsAt) : null;
  if (b.teamSize !== undefined) o.teamSize = num(b.teamSize) ?? 3;
  if (b.randomTeams !== undefined) o.randomTeams = !!b.randomTeams;
  if (b.avgEloCap !== undefined) o.avgEloCap = num(b.avgEloCap);
  if (b.minElo !== undefined) o.minElo = num(b.minElo);
  if (b.noRookies !== undefined) o.noRookies = !!b.noRookies;
  if (b.scoringMode !== undefined && ["simple", "advanced", "manual"].includes(b.scoringMode)) o.scoringMode = b.scoringMode;
  if (b.pointsWin !== undefined) o.pointsWin = num(b.pointsWin) ?? 3;
  if (b.pointsDraw !== undefined) o.pointsDraw = num(b.pointsDraw) ?? 1;
  if (b.pointsLoss !== undefined) o.pointsLoss = num(b.pointsLoss) ?? 0;
  if (b.pointsWinClean !== undefined) o.pointsWinClean = num(b.pointsWinClean) ?? 3;
  if (b.pointsWinTight !== undefined) o.pointsWinTight = num(b.pointsWinTight) ?? 2;
  if (b.pointsLossTight !== undefined) o.pointsLossTight = num(b.pointsLossTight) ?? 1;
  if (b.pointsLossClean !== undefined) o.pointsLossClean = num(b.pointsLossClean) ?? 0;
  return o;
}

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

  app.get("/api/competitions/:id/phases", async (req, res, next) => {
    try {
      res.json(await competitionsStore.listPhases(req.params.id));
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
        ...optionFields(req.body ?? {}),
      });
      if (Array.isArray(req.body?.phases)) {
        await competitionsStore.replacePhases(c.id, req.body.phases);
      }
      res.status(201).json(c);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/competitions/:id", async (req, res, next) => {
    try {
      const patch: Record<string, unknown> = { ...optionFields(req.body ?? {}) };
      for (const k of ["name", "type", "status", "isCompetitive", "affectsElo", "rulesetJson"]) {
        if (req.body?.[k] !== undefined) patch[k] = req.body[k];
      }
      const c = await competitionsStore.update(req.params.id, patch);
      if (!c) return res.status(404).json({ message: "Compétition introuvable." });
      if (Array.isArray(req.body?.phases)) {
        await competitionsStore.replacePhases(req.params.id, req.body.phases);
      }
      res.json(c);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/competitions/:id", async (req, res, next) => {
    try {
      await competitionsStore.remove(req.params.id);
      res.json({ ok: true });
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
