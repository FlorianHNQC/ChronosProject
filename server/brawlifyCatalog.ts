/**
 * Catalogue Brawl Stars (maps & modes de jeu) via l'API publique Brawlify, avec
 * cache mémoire 24h et repli sur l'ancien cache si l'API est indisponible.
 * Sert à proposer un choix visuel (images CDN) côté interface.
 */
const MAPS_URL = "https://api.brawlify.com/v1/maps";
const MODES_URL = "https://api.brawlify.com/v1/gamemodes";
const TTL_MS = 24 * 60 * 60 * 1000;

export type GameModeItem = { id: number | null; name: string; imageUrl: string | null; color: string | null };
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

export async function getGameModes(): Promise<GameModeItem[]> {
  const now = Date.now();
  if (modesCache && modesCache.expiresAt > now) return modesCache.data;
  try {
    const res = await fetch(MODES_URL);
    if (!res.ok) throw new Error(`Brawlify gamemodes ${res.status}`);
    const json: any = await res.json();
    const list: any[] = Array.isArray(json?.list) ? json.list : [];
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
    const res = await fetch(MAPS_URL);
    if (!res.ok) throw new Error(`Brawlify maps ${res.status}`);
    const json: any = await res.json();
    const list: any[] = Array.isArray(json?.list) ? json.list : [];
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
