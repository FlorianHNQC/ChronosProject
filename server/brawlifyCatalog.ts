/**
 * Catalogue Brawl Stars (maps & modes de jeu) via l'API publique Brawlify, avec
 * cache mémoire 24h et repli sur l'ancien cache si l'API est indisponible.
 * Sert à proposer un choix visuel (images CDN) côté interface.
 */
// BrawlAPI (même hôte que le service icônes, déjà joignable depuis le serveur).
const MAPS_URL = "https://api.brawlapi.com/v1/maps";
const MODES_URL = "https://api.brawlapi.com/v1/gamemodes";
const BRAWLERS_URL = "https://api.brawlapi.com/v1/brawlers";
const TTL_MS = 24 * 60 * 60 * 1000;
const HEADERS = { Accept: "application/json" };

/** Extrait un tableau quelle que soit la forme de réponse ({list}, {data}, ou tableau). */
function asList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.list)) return json.list;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

export type GameModeItem = { id: number | null; name: string; imageUrl: string | null; color: string | null };
export type BrawlerItem = { id: number | null; name: string; imageUrl: string | null };
export type MapItem = {
  id: number | null;
  name: string;
  imageUrl: string | null;
  mode: string | null;
  modeImageUrl: string | null;
  modeColor: string | null;
};

type Cache<T> = { data: T; expiresAt: number } | null;
let modesCache: Cache<GameModeItem[]> = null;
let mapsCache: Cache<MapItem[]> = null;
let brawlersCache: Cache<BrawlerItem[]> = null;

export async function getBrawlers(): Promise<BrawlerItem[]> {
  const now = Date.now();
  if (brawlersCache && brawlersCache.expiresAt > now) return brawlersCache.data;
  try {
    const res = await fetch(BRAWLERS_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`brawlers ${res.status}`);
    const list = asList(await res.json());
    const data: BrawlerItem[] = list
      .filter((b) => b && b.name)
      .map((b) => ({ id: b.id ?? null, name: String(b.name), imageUrl: b.imageUrl ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
    brawlersCache = { data, expiresAt: now + TTL_MS };
    return data;
  } catch (err) {
    console.warn("[brawlapi] brawlers indisponible :", (err as Error).message);
    return brawlersCache?.data ?? [];
  }
}

export async function getGameModes(): Promise<GameModeItem[]> {
  const now = Date.now();
  if (modesCache && modesCache.expiresAt > now) return modesCache.data;
  try {
    const res = await fetch(MODES_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`gamemodes ${res.status}`);
    const list = asList(await res.json());
    const data: GameModeItem[] = list
      .filter((m) => m && m.name && m.disabled !== true)
      .map((m) => ({ id: m.id ?? null, name: String(m.name), imageUrl: m.imageUrl ?? null, color: m.color ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
    modesCache = { data, expiresAt: now + TTL_MS };
    return data;
  } catch (err) {
    console.warn("[brawlify] gamemodes indisponible :", (err as Error).message);
    return modesCache?.data ?? [];
  }
}

export async function getMaps(): Promise<MapItem[]> {
  const now = Date.now();
  if (mapsCache && mapsCache.expiresAt > now) return mapsCache.data;
  try {
    const res = await fetch(MAPS_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`maps ${res.status}`);
    const list = asList(await res.json());
    const data: MapItem[] = list
      .filter((m) => m && m.name)
      .map((m) => ({
        id: m.id ?? null,
        name: String(m.name),
        imageUrl: m.imageUrl ?? null,
        mode: m.gameMode?.name ?? null,
        modeImageUrl: m.gameMode?.imageUrl ?? null,
        modeColor: m.gameMode?.color ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    mapsCache = { data, expiresAt: now + TTL_MS };
    return data;
  } catch (err) {
    console.warn("[brawlify] maps indisponible :", (err as Error).message);
    return mapsCache?.data ?? [];
  }
}
