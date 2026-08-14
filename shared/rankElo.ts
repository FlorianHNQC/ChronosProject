/**
 * Barème « rang Ranked → Elo de base » (évaluation préliminaire).
 *
 * Principe (validé avec la communauté) :
 *  - Le RANG pèse énormément ; les trophées ne sont qu'un petit bonus d'expérience.
 *  - Diamant I = plancher que tout le monde atteint → faible signal.
 *  - Mythique III = plafond des plus faibles ; Légendaire I = plancher des plus forts
 *    → grand saut à cette frontière (le vrai clivage faible/fort).
 *  - Master = élite (très rare, 3-4 dans la communauté) → tout en haut.
 *
 * Le bonus de trophées est plafonné (jamais assez pour dépasser un rang supérieur).
 */

export type RankDef = { key: string; label: string; baseElo: number };

export const RANKS: RankDef[] = [
  { key: "bronze1", label: "Bronze I", baseElo: 950 },
  { key: "bronze2", label: "Bronze II", baseElo: 965 },
  { key: "bronze3", label: "Bronze III", baseElo: 980 },
  { key: "silver1", label: "Argent I", baseElo: 995 },
  { key: "silver2", label: "Argent II", baseElo: 1010 },
  { key: "silver3", label: "Argent III", baseElo: 1025 },
  { key: "gold1", label: "Or I", baseElo: 1040 },
  { key: "gold2", label: "Or II", baseElo: 1060 },
  { key: "gold3", label: "Or III", baseElo: 1080 },
  { key: "diamond1", label: "Diamant I", baseElo: 1100 },
  { key: "diamond2", label: "Diamant II", baseElo: 1140 },
  { key: "diamond3", label: "Diamant III", baseElo: 1180 },
  { key: "mythic1", label: "Mythique I", baseElo: 1250 },
  { key: "mythic2", label: "Mythique II", baseElo: 1325 },
  { key: "mythic3", label: "Mythique III", baseElo: 1400 },
  { key: "legendary1", label: "Légendaire I", baseElo: 1550 },
  { key: "legendary2", label: "Légendaire II", baseElo: 1650 },
  { key: "legendary3", label: "Légendaire III", baseElo: 1750 },
  { key: "masters1", label: "Master 1", baseElo: 1900 },
  { key: "masters2", label: "Master 2", baseElo: 2000 },
  { key: "masters3", label: "Master 3", baseElo: 2100 },
  { key: "pro", label: "Pro", baseElo: 2250 },
];

// Bonus de trophées : petit, plafonné (rang > trophées).
export const TROPHY_DIVISOR = 2000; // 1 point d'Elo par 2000 trophées
export const TROPHY_MAX_BONUS = 50; // plafond (atteint vers 100k trophées)

const rankMap = new Map(RANKS.map((r) => [r.key, r]));

/**
 * Elo de base suggéré à partir du rang Ranked et du total de trophées.
 * Renvoie null si le rang est inconnu.
 */
export function seedEloFromRank(rankKey: string, trophies: number): number | null {
  const rank = rankMap.get(rankKey);
  if (!rank) return null;
  const t = Number.isFinite(trophies) && trophies > 0 ? trophies : 0;
  const bonus = Math.min(TROPHY_MAX_BONUS, Math.round(t / TROPHY_DIVISOR));
  return rank.baseElo + bonus;
}
