import type { Express } from "express";
import { getMaps, getGameModes } from "./brawlifyCatalog";

/** Catalogue Brawl Stars (maps & modes) pour le choix visuel. Lecture publique. */
export function registerBrawlifyRoutes(app: Express) {
  app.get("/api/bs/gamemodes", async (_req, res, next) => {
    try {
      res.json(await getGameModes());
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/bs/maps", async (_req, res, next) => {
    try {
      res.json(await getMaps());
    } catch (e) {
      next(e);
    }
  });
}
