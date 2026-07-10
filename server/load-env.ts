/**
 * Chargement des variables d'environnement.
 *
 * IMPORTANT : ce module doit être importé EN PREMIER dans server/index.ts,
 * avant tout module qui lit process.env (ex. server/db.ts). En ESM, les
 * imports sont évalués dans l'ordre, donc placer cet import en tête garantit
 * que .env.local est chargé avant la lecture de DATABASE_URL.
 *
 * Priorité : .env.local (dev, git-ignoré) puis .env en repli. dotenv
 * n'écrase jamais une variable déjà définie dans l'environnement réel.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config(); // .env en repli
