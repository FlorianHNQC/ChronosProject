/**
 * Compresse une image côté navigateur (redimensionnement + WebP) puis l'envoie
 * à /api/upload. Renvoie l'URL servie (ex. /uploads/xxx.webp). Optimisation faite
 * dans le navigateur : le serveur ne reçoit qu'un petit fichier.
 */
export async function uploadImage(file: File, opts?: { max?: number; quality?: number }): Promise<string> {
  const max = opts?.max ?? 256;
  const quality = opts?.quality ?? 0.85;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Compression indisponible sur ce navigateur.");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Échec de la compression."))), "image/webp", quality),
  );

  const fd = new FormData();
  fd.append("file", blob, "image.webp");
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch { /* corps illisible */ }
    throw new Error(msg);
  }
  const { url } = await res.json();
  return url as string;
}
