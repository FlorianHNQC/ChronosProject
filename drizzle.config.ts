import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Charge .env.local (puis .env) pour que drizzle-kit voie DATABASE_URL.
dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL manquant : copiez .env.example vers .env.local et renseignez DATABASE_URL.",
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
