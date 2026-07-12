import type { Express } from "express";
import { validationStore } from "./validationStorage";

/**
 * Route de validation d'une composition d'équipe pour une compétition.
 */
export function registerValidationRoutes(app: Express) {
  // Body : { playerIds: string[] }
  app.post("/api/competitions/:id/validate", async (req, res, next) => {
    try {
      const { playerIds } = req.body ?? {};
      res.json(await validationStore.validate(req.params.id, Array.isArray(playerIds) ? playerIds : []));
    } catch (e) {
      next(e);
    }
  });
}
