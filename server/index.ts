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

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    res.status(status).json({ message: err.message || "Internal Server Error" });
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
