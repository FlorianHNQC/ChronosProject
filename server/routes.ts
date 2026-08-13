import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { fetchPlayerProfile } from "./brawlstarsPlayerService";

/**
 * Routes de l'API Chronos.
 *
 * V1 : socle (santé) + module Joueurs (synchronisation par tag via l'API
 * Brawl Stars). Les routes leaguebs/statsbs seront portées ensuite.
 */
export async function registerRoutes(_httpServer: Server, app: Express) {
  /* ---------------- Santé ---------------- */
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "chronos", version: "0.1.0" });
  });

  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({ status: "ok", db: "up" });
    } catch (e: any) {
      res.status(500).json({ status: "error", db: "down", message: e?.message });
    }
  });

  /* ---------------- Joueurs ---------------- */

  // Liste des joueurs.
  app.get("/api/players", async (_req, res, next) => {
    try {
      res.json(await storage.listPlayers());
    } catch (e) {
      next(e);
    }
  });

  // Un joueur.
  app.get("/api/players/:id", async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ message: "Joueur introuvable." });
      res.json(player);
    } catch (e) {
      next(e);
    }
  });

  // Aperçu API sans enregistrement (pour vérifier un tag avant création).
  app.get("/api/brawlstars/player/:tag", async (req, res, next) => {
    try {
      res.json(await fetchPlayerProfile(req.params.tag));
    } catch (e) {
      next(e);
    }
  });

  // Création d'un joueur à partir d'un tag Brawl Stars.
  // Body : { tag: string, nationality?: string }
  app.post("/api/players", async (req: Request, res: Response, next) => {
    try {
      const { tag, nationality } = req.body ?? {};
      if (!tag || typeof tag !== "string") {
        return res.status(400).json({ message: "Champ « tag » requis." });
      }
      const profile = await fetchPlayerProfile(tag);

      const existing = await storage.getPlayerByTag(profile.tag);
      if (existing) {
        return res.status(409).json({
          message: `Ce tag est déjà associé à un joueur existant (« ${existing.pseudo} »). Inutile de le recréer : fusionne plutôt les doublons via l'outil Fusion.`,
          player: existing,
        });
      }

      const insert = storage.profileToInsert(profile, {
        nationality: nationality || undefined,
      });
      const player = await storage.createPlayer(insert);
      res.status(201).json(player);
    } catch (e) {
      next(e);
    }
  });

  // Resynchronisation d'un joueur depuis l'API (pseudo + avatar à jour).
  app.post("/api/players/:id/resync", async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ message: "Joueur introuvable." });
      if (!player.playerTag) {
        return res.status(400).json({ message: "Ce joueur n'a pas de tag Brawl Stars." });
      }
      const profile = await fetchPlayerProfile(player.playerTag);
      const updated = await storage.updatePlayer(player.id, {
        pseudo: profile.name,
        iconId: profile.iconId ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  // Mise à jour partielle manuelle (ex. nationalité).
  app.patch("/api/players/:id", async (req, res, next) => {
    try {
      const { nationality, pseudo } = req.body ?? {};
      const updated = await storage.updatePlayer(req.params.id, {
        ...(nationality !== undefined ? { nationality } : {}),
        ...(pseudo !== undefined ? { pseudo } : {}),
      });
      if (!updated) return res.status(404).json({ message: "Joueur introuvable." });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/players/:id", async (req, res, next) => {
    try {
      await storage.deletePlayer(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // TODO(incréments suivants) : équipes, compétitions, matchs, Hydra (Elo,
  // tiers, changelog, tags, modes), portage leaguebs/statsbs.
}
