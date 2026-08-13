import type { Express } from "express";
import { awardsStore } from "./awardsStorage";
import type { InsertAward } from "@shared/schema";

/**
 * Palmarès (awards de cérémonie).
 * - GET    /api/palmares        : liste enrichie (public).
 * - POST   /api/palmares        : créer (admin).
 * - PATCH  /api/palmares/:id    : modifier (admin).
 * - DELETE /api/palmares/:id    : supprimer (admin).
 * Les écritures sont protégées par requireAdminWrites.
 */
function toRow(b: Record<string, unknown>): InsertAward {
  return {
    competitionId: (b.competitionId as string) || null,
    title: String(b.title ?? "").trim(),
    subtitle: (b.subtitle as string) || null,
    justification: (b.justification as string) || null,
    recipientType: (b.recipientType as string) || "player",
    playerId: (b.playerId as string) || null,
    teamId: (b.teamId as string) || null,
    playerIds: Array.isArray(b.playerIds) ? JSON.stringify(b.playerIds) : (b.playerIds as string) || null,
    freeText: (b.freeText as string) || null,
    accent: (b.accent as string) || null,
    featured: !!b.featured,
    orderIndex: Number(b.orderIndex) || 0,
    published: b.published !== false,
  };
}

export function registerAwardsRoutes(app: Express) {
  app.get("/api/palmares", async (_req, res, next) => {
    try {
      res.json(await awardsStore.list());
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/palmares", async (req, res, next) => {
    try {
      const data = toRow(req.body ?? {});
      if (!data.title) return res.status(400).json({ message: "Titre requis." });
      res.json(await awardsStore.create(data));
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/palmares/:id", async (req, res, next) => {
    try {
      const data = toRow(req.body ?? {});
      const updated = await awardsStore.update(req.params.id, data);
      if (!updated) return res.status(404).json({ message: "Award introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/palmares/:id", async (req, res, next) => {
    try {
      await awardsStore.remove(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
}
