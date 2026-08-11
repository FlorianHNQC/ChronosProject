#!/usr/bin/env node
/**
 * Optimise les images du site en WebP (redimensionnement + compression).
 *
 * Workflow :
 *   1. Dépose tes images brutes (.jpg/.png/.webp) dans  client/public/images/_raw/
 *   2. Lance :  node scripts/optimize-images.mjs [--width=1600] [--quality=65]
 *   3. Les .webp optimisés sont écrits dans  client/public/images/
 *      (le code du site référence déjà ces .webp).
 *
 * Nécessite le module `sharp` (dev) :  npm i -D sharp
 */
import { readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "client/public/images/_raw");
const OUT = path.join(ROOT, "client/public/images");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.+)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);
const width = Number(args.width) || 1600;
const quality = Number(args.quality) || 65;

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Le module 'sharp' est requis.\nInstalle-le :  npm i -D sharp");
  process.exit(1);
}

if (!existsSync(SRC)) {
  console.error(`Dossier source introuvable : ${SRC}`);
  console.error("Crée-le et dépose tes images brutes dedans (.jpg / .png / .webp).");
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
if (files.length === 0) {
  console.log("Aucune image à traiter dans _raw/.");
  process.exit(0);
}

const kb = (n) => `${(n / 1024).toFixed(0)} Ko`;
const mb = (n) => `${(n / 1048576).toFixed(2)} Mo`;

let totalIn = 0;
let totalOut = 0;
for (const f of files) {
  const inPath = path.join(SRC, f);
  const base = f.replace(/\.[^.]+$/, "");
  const outPath = path.join(OUT, `${base}.webp`);
  const before = (await stat(inPath)).size;
  await sharp(inPath).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(outPath);
  const after = (await stat(outPath)).size;
  totalIn += before;
  totalOut += after;
  console.log(`${f}  ${kb(before)} -> ${base}.webp  ${kb(after)}  (-${Math.round((1 - after / before) * 100)}%)`);
}

console.log(`\nTotal : ${mb(totalIn)} -> ${mb(totalOut)}  (-${Math.round((1 - totalOut / totalIn) * 100)}%)`);
console.log(`Largeur max ${width}px · qualité ${quality}. Fichiers .webp générés dans client/public/images/.`);
