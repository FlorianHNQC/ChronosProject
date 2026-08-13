/**
 * Service joueur Brawl Stars.
 *
 * Identité via l'API officielle Supercell (/v1/players/{tag}) — token
 * `BRAWLSTARS_API_TOKEN`, VERROUILLÉ PAR IP (autoriser l'IP du poste/VPS sur
 * developer.brawlstars.com). L'API renvoie une icône sous forme d'identifiant
 * (`icon.id`), pas d'URL : l'image est résolue via Brawlify.
 *
 * Aucun secret n'est versionné : le token est lu dans l'environnement.
 */

const OFFICIAL_BASE = "https://api.brawlstars.com/v1";
const BRAWLIFY_ICONS = "https://api.brawlapi.com/v1/icons";
// Repli CDN si le catalogue Brawlify est indisponible.
const BRAWLIFY_ICON_CDN = (id: number) =>
  `https://cdn.brawlify.com/profile-icons/regular/${id}.png`;

const VALID_TAG_CHARS = /^[0289PYLQGRJCUV]+$/;

export type BrawlPlayerProfile = {
  tag: string; // forme canonique avec #
  name: string;
  nameColor: string | null;
  iconId: number | null;
  avatarUrl: string | null;
  trophies: number | null;
  highestTrophies: number | null;
  expLevel: number | null;
  teamVictories: number | null;
  soloVictories: number | null;
  duoVictories: number | null;
  clubName: string | null;
  clubTag: string | null;
};

/**
 * Normalise un tag saisi : retire espaces/#, met en majuscules, valide les
 * caractères. Retourne la forme canonique (#XXXX) et la forme encodée (%23…).
 */
export function normalizeTag(input: string): { canonical: string; encoded: string } {
  const cleaned = input.trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "").replace(/O/g, "0");
  if (!cleaned || !VALID_TAG_CHARS.test(cleaned)) {
    throw Object.assign(new Error(`Tag invalide : « ${input} »`), { status: 400 });
  }
  return { canonical: `#${cleaned}`, encoded: `%23${cleaned}` };
}

/* ---------- Résolution des icônes (Brawlify, cache 24h) ---------- */
type IconCache = { map: Record<string, string>; expiresAt: number } | null;
let iconCache: IconCache = null;
const ICON_TTL_MS = 24 * 60 * 60 * 1000;

async function loadIconMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (iconCache && iconCache.expiresAt > now) return iconCache.map;
  try {
    const res = await fetch(BRAWLIFY_ICONS);
    if (!res.ok) throw new Error(`Brawlify icons ${res.status}`);
    const data: any = await res.json();
    const player = data?.player ?? {};
    const map: Record<string, string> = {};
    for (const id of Object.keys(player)) {
      const url = player[id]?.imageUrl || player[id]?.imageUrl2;
      if (url) map[id] = url;
    }
    iconCache = { map, expiresAt: now + ICON_TTL_MS };
    return map;
  } catch (err) {
    // Repli : on garde l'ancien cache s'il existe, sinon map vide.
    console.warn("[brawlstars] Brawlify icons indisponible, repli CDN", (err as Error).message);
    return iconCache?.map ?? {};
  }
}

export async function resolveIconUrl(iconId: number | null): Promise<string | null> {
  if (!iconId) return null;
  const map = await loadIconMap();
  return map[String(iconId)] ?? BRAWLIFY_ICON_CDN(iconId);
}

/* ---------- Appel API officielle ---------- */
async function fetchOfficialPlayer(encodedTag: string): Promise<any> {
  const token = process.env.BRAWLSTARS_API_TOKEN;
  if (!token) {
    throw Object.assign(
      new Error("Token API Brawl Stars manquant : renseignez BRAWLSTARS_API_TOKEN dans le fichier .env, puis redémarrez l'application."),
      { status: 503 },
    );
  }
  const res = await fetch(`${OFFICIAL_BASE}/players/${encodedTag}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 404) {
    throw Object.assign(new Error("Joueur introuvable pour ce tag."), { status: 404 });
  }
  if (res.status === 403) {
    throw Object.assign(
      new Error("API Brawl Stars refusée (403) : token invalide, ou IP du serveur non autorisée sur la clé (developer.brawlstars.com)."),
      { status: 403 },
    );
  }
  if (res.status === 429) {
    throw Object.assign(new Error("Trop de requêtes à l'API Brawl Stars (429)."), { status: 429 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Erreur API Brawl Stars (${res.status}).`), { status: 502 });
  }
  return res.json();
}

/**
 * Récupère et normalise le profil d'un joueur à partir de son tag.
 * L'avatar est résolu via Brawlify (best-effort).
 */
export async function fetchPlayerProfile(rawTag: string): Promise<BrawlPlayerProfile> {
  const { canonical, encoded } = normalizeTag(rawTag);
  const p = await fetchOfficialPlayer(encoded);
  const iconId: number | null = p?.icon?.id ?? null;
  const avatarUrl = await resolveIconUrl(iconId);
  return {
    tag: canonical,
    name: p?.name ?? canonical,
    nameColor: p?.nameColor ?? null,
    iconId,
    avatarUrl,
    trophies: p?.trophies ?? null,
    highestTrophies: p?.highestTrophies ?? null,
    expLevel: p?.expLevel ?? null,
    teamVictories: p?.["3vs3Victories"] ?? null,
    soloVictories: p?.soloVictories ?? null,
    duoVictories: p?.duoVictories ?? null,
    clubName: p?.club?.name ?? null,
    clubTag: p?.club?.tag ?? null,
  };
}
