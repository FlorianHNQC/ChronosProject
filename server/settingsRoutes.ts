import type { Express } from "express";
import { settingsStore } from "./settingsStorage";

/**
 * Réglages du site.
 * - GET  /api/settings/:key : lecture publique (renvoie { key, value|null }).
 * - PUT  /api/settings/:key : écriture (admin — garanti par requireAdminWrites),
 *   restreinte à une liste blanche de clés.
 */
const EDITABLE_KEYS = new Set(["home_bg_url"]);

export function registerSettingsRoutes(app: Express) {
  app.get("/api/settings/:key", async (req, res, next) => {
    try {
      const row = await settingsStore.get(req.params.key);
      res.json({ key: req.params.key, value: row?.value ?? null });
    } catch (e) {
      next(e);
    }
  });

  app.put("/api/settings/:key", async (req, res, next) => {
    try {
      if (!EDITABLE_KEYS.has(req.params.key)) {
        return res.status(403).json({ message: "Clé non modifiable." });
      }
      const value = typeof req.body?.value === "string" ? req.body.value.trim() : "";
      const row = await settingsStore.set(req.params.key, value);
      res.json({ key: row.key, value: row.value });
    } catch (e) {
      next(e);
    }
  });
}
