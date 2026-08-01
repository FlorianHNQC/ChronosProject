import { db } from "./db";
import { tiers, hydraSections } from "@shared/schema";
import { DEFAULT_TIERS } from "@shared/tiers";

/**
 * Insère les données par défaut si absentes. Idempotent : ne fait rien si les
 * tiers existent déjà. Appelé au démarrage (échec silencieux si DB indisponible).
 */
export async function seedDefaults(): Promise<void> {
  const existing = await db.select().from(tiers);
  if (existing.length === 0) {
    await db.insert(tiers).values(DEFAULT_TIERS);
    console.log("[seed] paliers de tiers créés");
  }
  await seedHydraSections();
}

/** Contenu rédactionnel par défaut des sections Hydra (éditable ensuite en ligne). */
const DEFAULT_HYDRA_SECTIONS = [
  {
    key: "about",
    title: "À propos de Hydra",
    orderIndex: 0,
    body:
      "Hydra est le programme de classement des joueurs de la communauté. Chaque joueur qui participe à une compétition y est rangé dans un **tier** reflétant son niveau estimé.\n\n" +
      "C'est un outil d'organisation, pas un jugement de valeur : les tiers servent à répartir équitablement le niveau pour des compétitions disputées, et à situer chacun dans sa progression.",
  },
  {
    key: "tags",
    title: "Catégories et tags",
    orderIndex: 1,
    body:
      "Deux familles de tags accompagnent le classement :\n\n" +
      "- **Palmarès** — distinctions obtenues (Champion, Finaliste, MVP…).\n" +
      "- **Comportement** — rôle et implication dans la communauté (Nomade, Drifter actif, Réserviste…).\n\n" +
      "Utilise les filtres sous les modes pour n'afficher que les joueurs portant certains tags.",
  },
  {
    key: "notes",
    title: "Notes (notation)",
    orderIndex: 2,
    body:
      "Le tier d'un joueur est **dérivé de son Elo**, lui-même piloté en priorité par les **résultats** des compétitions. Les statistiques en jeu, peu fiables, ne pèsent que marginalement.\n\n" +
      "Les seuils d'Elo de chaque tier sont configurables par les administrateurs : le classement s'adapte donc à la réalité de la scène plutôt qu'à une grille figée.",
  },
  {
    key: "criteria",
    title: "Critères",
    orderIndex: 3,
    body:
      "Les joueurs sont répartis en trois modes :\n\n" +
      "- **Joueurs** — ont déjà disputé au moins une compétition.\n" +
      "- **Rookie** — nouveaux venus, aucune compétition jouée pour l'instant.\n" +
      "- **Réserve** — mis de côté temporairement après une longue inactivité (plus de 90 jours sans évolution d'Elo).",
  },
];

/** Crée les sections Hydra par défaut si la table est vide. Idempotent. */
export async function seedHydraSections(): Promise<void> {
  const existing = await db.select().from(hydraSections);
  if (existing.length === 0) {
    await db.insert(hydraSections).values(DEFAULT_HYDRA_SECTIONS);
    console.log("[seed] sections Hydra créées");
  }
}
