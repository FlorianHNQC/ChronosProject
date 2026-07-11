/**
 * Dérivation des tiers à partir de l'Elo (partagé serveur + client).
 *
 * Le tier est une catégorie DÉRIVÉE de l'Elo (§14.4 du CDC) : on stocke la cote
 * continue et on en déduit le palier. Les seuils sont modifiables ; les valeurs
 * ci-dessous ne sont qu'un point de départ à calibrer.
 */
import type { Tier } from "./schema";

export const DEFAULT_TIERS: Array<Omit<Tier, "id">> = [
  { code: "T0", label: "Élite", minElo: 2000, orderIndex: 0, color: "#E23B3B" },
  { code: "T0.5", label: "Très haut", minElo: 1850, orderIndex: 1, color: "#F0883E" },
  { code: "T1", label: "Haut", minElo: 1700, orderIndex: 2, color: "#EAB308" },
  { code: "T1.5", label: "Confirmé", minElo: 1500, orderIndex: 3, color: "#5BC873" },
  { code: "T2", label: "Intermédiaire", minElo: 1300, orderIndex: 4, color: "#3BA7E2" },
  { code: "T3", label: "Découverte", minElo: 0, orderIndex: 5, color: "#8B93A7" },
];

/** Retourne le tier dont le minElo est le plus élevé tout en restant ≤ elo. */
export function tierForElo(elo: number | null | undefined, tiers: Tier[]): Tier | null {
  if (elo == null || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => b.minElo - a.minElo);
  for (const t of sorted) {
    if (elo >= t.minElo) return t;
  }
  return sorted[sorted.length - 1] ?? null;
}
