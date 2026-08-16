import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

/**
 * Upload d'images (logos d'équipe, etc.). Les fichiers sont écrits dans
 * public/uploads (servi à /uploads/...). La compression/redimensionnement est
 * faite côté navigateur avant l'envoi ; on borne quand même la taille ici.
 * Écriture → admin (garanti par requireAdminWrites).
 */
const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT[file.mimetype] ?? ".bin"}`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

export function registerUploadRoutes(app: Express) {
  app.post("/api/upload", upload.single("file"), (req, res) => {
    const f = (req as unknown as { file?: { filename: string } }).file;
    if (!f) return res.status(400).json({ message: "Aucun fichier image reçu." });
    res.json({ url: `/uploads/${f.filename}` });
  });
}
