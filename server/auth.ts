/**
 * Authentification par session : login/logout, utilisateur courant, garde des
 * écritures (§9 du CDC). Règle simple : les lectures (GET /api) sont publiques ;
 * toute écriture (/api hors /api/auth) exige un administrateur connecté.
 *
 * Les sessions sont stockées en base (connect-pg-simple) → elles survivent aux
 * redémarrages du serveur.
 */
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { users } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
    email?: string;
  }
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({ pool, tableName: "user_sessions", createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "chronos-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 },
    }),
  );

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      const [u] = await db.select().from(users).where(eq(users.email, String(email || "").toLowerCase()));
      if (!u || !(await bcrypt.compare(String(password || ""), u.password))) {
        return res.status(401).json({ message: "Identifiants invalides." });
      }
      req.session.userId = u.id;
      req.session.role = u.role || "public";
      req.session.email = u.email;
      res.json({ id: u.id, email: u.email, role: u.role });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Non connecté." });
    res.json({ id: req.session.userId, email: req.session.email, role: req.session.role });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.status(204).end();
  });
}

/** Les écritures /api (hors /api/auth) exigent un admin connecté. */
export function requireAdminWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!req.path.startsWith("/api")) return next();
  if (req.path.startsWith("/api/auth")) return next();
  if (req.session?.userId && req.session.role === "admin") return next();
  return res.status(401).json({ message: "Authentification administrateur requise." });
}

/** Crée un admin par défaut si la table users est vide. */
export async function seedAdmin() {
  const [existing] = await db.select().from(users).limit(1);
  if (existing) return;
  const email = (process.env.ADMIN_EMAIL || "admin@chronos.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "chronos";
  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, password: hash, role: "admin" });
  console.log(`[seed] admin créé : ${email} (mot de passe par défaut : ${password})`);
}
