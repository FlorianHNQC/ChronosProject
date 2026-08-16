import "./load-env"; // doit rester le tout premier import (charge .env.local)
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import { setupAuth, requireAdminWrites, seedAdmin } from "./auth";
import { registerRoutes } from "./routes";
import { registerHydraRoutes } from "./hydraRoutes";
import { registerHydraAdminRoutes } from "./hydraAdminRoutes";
import { registerHydraSectionsRoutes } from "./hydraSectionsRoutes";
import { registerSettingsRoutes } from "./settingsRoutes";
import { registerAwardsRoutes } from "./awardsRoutes";
import { registerRandomRoutes } from "./randomRoutes";
import { registerUploadRoutes } from "./uploadRoutes";
import { registerCompetitionsRoutes } from "./competitionsRoutes";
import { registerTeamsRoutes } from "./teamsRoutes";
import { registerMatchesRoutes } from "./matchesRoutes";
import { registerStatsRoutes } from "./statsRoutes";
import { registerPlayerDetailRoutes } from "./playerDetailRoutes";
import { registerMergeRoutes } from "./mergeRoutes";
import { registerArchiveRoutes } from "./archiveRoutes";
import { registerEloRoutes } from "./eloRoutes";
import { registerValidationRoutes } from "./validationRoutes";
import { registerDrifterRoutes } from "./drifterRoutes";
import { serveStatic } from "./static";
import { seedDefaults } from "./seed";

const app = express();

// Fichiers statiques (logos d'équipes, photos de joueurs, uploads divers).
app.use("/team-logos", express.static(path.join(process.cwd(), "public/team-logos")));
app.use("/player-photos", express.static(path.join(process.cwd(), "public/player-photos")));
app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// Authentification : session + routes /api/auth, puis garde des écritures.
setupAuth(app);
app.use(requireAdminWrites);

export function log(message: string, source = "express") {
  const t = new Date().toLocaleTimeString("fr-FR", { hour12: false });
  console.log(`${t} [${source}] ${message}`);
}

// Journalisation legere des appels /api.
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let captured: Record<string, any> | undefined;
  const originalJson = res.json;
  res.json = function (body, ...args) {
    captured = body;
    return originalJson.apply(res, [body, ...args]);
  };
  res.on("finish", () => {
    if (reqPath.startsWith("/api")) {
      let line = `${req.method} ${reqPath} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      if (line.length > 200) line = line.slice(0, 199) + "...";
      log(line);
    }
  });
  next();
});

(async () => {
  // Seeding idempotent (paliers de tiers, admin par défaut…). N'empêche pas le boot si la DB est down.
  try {
    await seedDefaults();
    await seedAdmin();
  } catch (e) {
    console.warn("[seed] ignoré (DB indisponible ?) :", (e as Error).message);
  }

  await registerRoutes(httpServer, app);
  registerHydraRoutes(app);
  registerHydraAdminRoutes(app);
  registerHydraSectionsRoutes(app);
  registerSettingsRoutes(app);
  registerAwardsRoutes(app);
  registerRandomRoutes(app);
  registerUploadRoutes(app);
  registerCompetitionsRoutes(app);
  registerTeamsRoutes(app);
  registerMatchesRoutes(app);
  registerStatsRoutes(app);
  registerPlayerDetailRoutes(app);
  registerMergeRoutes(app);
  registerArchiveRoutes(app);
  registerEloRoutes(app);
  registerValidationRoutes(app);
  registerDrifterRoutes(app);

  // Messages d'erreur PostgreSQL courants → messages clairs (sans fuiter le SQL brut).
  const PG_MESSAGES: Record<string, string> = {
    "42P01": "La base de données n'est pas à jour (table manquante). Exécutez `npm run db:push`.",
    "42703": "La base de données n'est pas à jour (colonne manquante). Exécutez `npm run db:push`.",
    "23505": "Cette valeur existe déjà.",
    "23503": "Référence invalide : un élément lié est introuvable ou encore utilisé.",
    "23502": "Un champ obligatoire est manquant.",
    "22P02": "Valeur invalide (format incorrect).",
    "23514": "Valeur non autorisée.",
    "53300": "Base de données momentanément surchargée. Réessayez.",
    ECONNREFUSED: "Base de données injoignable. Réessayez dans un instant.",
  };

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("API error:", err);
    if (res.headersSent) return next(err);

    let message: string;
    if (err.code && PG_MESSAGES[err.code]) {
      message = PG_MESSAGES[err.code];
    } else if (status >= 500) {
      // Ne pas exposer les détails internes des erreurs inattendues.
      message = "Erreur serveur inattendue. Réessayez plus tard.";
    } else {
      // Erreurs volontaires (4xx) : on garde le message applicatif.
      message = err.message || "Requête invalide.";
    }
    res.status(status).json({ message });
  });

  // Vite en dev, statique en prod — apres les routes API.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`Chronos en ecoute sur le port ${port}`);
  });
})();
