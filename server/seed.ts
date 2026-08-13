import { eq } from "drizzle-orm";
import { db } from "./db";
import { tiers, hydraSections, awards, competitions, players, teams, type InsertAward } from "@shared/schema";
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
  await seedAwards();
}

/**
 * Amorce les awards de cérémonie de la dernière ligue (best-effort). Résout les
 * joueurs/équipes par pseudo normalisé ; repli en texte si un nom ne correspond
 * pas. Idempotent : ne fait rien si des awards existent déjà, ou si la
 * compétition 2026 est absente.
 */
type SeedRecipient =
  | { k: "player"; p: string }
  | { k: "players"; p: string[] }
  | { k: "team"; t: string }
  | { k: "text"; t: string };
type SeedSpec = { title: string; subtitle?: string; justification?: string; featured?: boolean; accent?: string; r: SeedRecipient };

const AWARD_SPECS: SeedSpec[] = [
  { title: "MVP", subtitle: "Most Valuable Player", featured: true, accent: "#FACC15",
    justification: "La note la plus élevée de la ligue, avec une constance sur toute la saison.", r: { k: "player", p: "Bluny" } },
  { title: "Meilleur buteur", accent: "#22C55E",
    justification: "10 buts sur l'ensemble de la ligue.", r: { k: "player", p: "Kuro-Exodus777" } },
  { title: "Meilleur assassin", accent: "#EF4444",
    justification: "100 kills en 22 matchs — plus de 9 kills par game.", r: { k: "player", p: "SkuLL" } },
  { title: "Meilleur contrôleur", accent: "#3B82F6",
    justification: "19 morts seulement en 22 matchs, en playoffs dès sa première compétition.", r: { k: "player", p: "Silverthoon" } },
  { title: "Meilleur capitaine", accent: "#F59E0B",
    justification: "Du haut d'une série presque parfaite.", r: { k: "player", p: "Sabera" } },
  { title: "Meilleur capitaine", accent: "#F59E0B",
    justification: "A porté Crimson Vanguard tout au long de la ligue.", r: { k: "player", p: "1000 - 7 = ?" } },
  { title: "Best Offensive Team", subtitle: "Les 5 joueurs les plus offensifs", accent: "#F97316",
    r: { k: "players", p: ["SkuLL", "Yoshi", "1000 - 7 = ?", "Bluny", "Himeiros"] } },
  { title: "Best Defensive Team", subtitle: "Les 5 joueurs les plus défensifs", accent: "#0EA5E9",
    r: { k: "players", p: ["Silverthoon", "Manny", "Enzious1604", "Sabera", "TB|Le volleur"] } },
  { title: "Prix de la persévérance", accent: "#A855F7",
    justification: "Malgré les défaites, jamais abandonné et présent chaque soir. Bravo, rendez-vous l'an prochain.", r: { k: "team", t: "XxdominationxX" } },
  { title: "Mention — le plus de morts", justification: "74 morts en 25 matchs. Mourir est une stratégie ; le plus important, c'est la victoire.", r: { k: "player", p: "Jack" } },
  { title: "Meilleur modérateur — ligue", justification: "Merci pour l'aide sur cette organisation gigantesque.", r: { k: "text", t: "Marel & Ludger Rexxial" } },
  { title: "Meilleur modérateur — admins", justification: "Pour la vitesse de remplissage des stats et la justesse dans l'exercice.", r: { k: "text", t: "AnnanGG" } },
  { title: "Mentions spéciales", justification: "Merci aux joueurs qui se sont donnés sans être cités : Overlord Jojo, CryingMasta, et les joueurs d'Equitrix et de LargentFaitLeBonheur.", r: { k: "text", t: "Overlord Jojo · CryingMasta · Equitrix · LargentFaitLeBonheur" } },
  { title: "Hommage — La St0rm", justification: "A dominé toutes les équipes de la ligue jusqu'à rencontrer plus fort. Presque parfait.", r: { k: "text", t: "La St0rm" } },
];

export async function seedAwards(): Promise<void> {
  const existing = await db.select({ id: awards.id }).from(awards).limit(1);
  if (existing.length > 0) return;

  const comps = await db.select({ id: competitions.id, name: competitions.name }).from(competitions);
  const comp = comps.find((c) => /2026/.test(c.name)) ?? comps.find((c) => /chronos/i.test(c.name));
  if (!comp) return;

  const pls = await db.select({ id: players.id, pseudo: players.pseudo }).from(players);
  const tms = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.competitionId, comp.id));
  const norm = (s: string) => s.trim().toLowerCase();
  const byPseudo = new Map<string, string>();
  for (const p of pls) if (!byPseudo.has(norm(p.pseudo))) byPseudo.set(norm(p.pseudo), p.id);
  const byTeam = new Map<string, string>();
  for (const t of tms) if (!byTeam.has(norm(t.name))) byTeam.set(norm(t.name), t.id);

  const rows: InsertAward[] = AWARD_SPECS.map((s, i) => {
    const base = {
      competitionId: comp.id,
      title: s.title,
      subtitle: s.subtitle ?? null,
      justification: s.justification ?? null,
      accent: s.accent ?? null,
      featured: !!s.featured,
      orderIndex: i + 1,
      published: true,
    };
    if (s.r.k === "player") {
      const id = byPseudo.get(norm(s.r.p));
      return id ? { ...base, recipientType: "player", playerId: id } : { ...base, recipientType: "text", freeText: s.r.p };
    }
    if (s.r.k === "players") {
      const found = s.r.p.map((n) => byPseudo.get(norm(n))).filter((x): x is string => !!x);
      return found.length === s.r.p.length
        ? { ...base, recipientType: "players", playerIds: JSON.stringify(found) }
        : { ...base, recipientType: "text", freeText: s.r.p.join(" · ") };
    }
    if (s.r.k === "team") {
      const id = byTeam.get(norm(s.r.t));
      return id ? { ...base, recipientType: "team", teamId: id } : { ...base, recipientType: "text", freeText: s.r.t };
    }
    return { ...base, recipientType: "text", freeText: s.r.t };
  });

  await db.insert(awards).values(rows);
  console.log(`[seed] ${rows.length} awards de cérémonie créés (${comp.name})`);
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
      "Le classement repose sur un **Elo**, mis à jour à partir des **résultats** des matchs (le vainqueur), et non des statistiques en jeu, jugées peu fiables. Le **tier** (T0, T1…) n'est qu'une lecture de l'Elo selon des seuils configurables.\n\n" +
      "**Comment l'Elo évolue :**\n" +
      "- Chaque joueur part d'un **Elo de départ** (une évaluation préliminaire) ; les matchs le font ensuite monter ou descendre.\n" +
      "- Après un match, l'Elo moyen de l'équipe est comparé à celui de l'adversaire : **battre plus fort que soi rapporte beaucoup**, perdre contre plus faible coûte cher (et inversement). Un nul vaut un demi-résultat.\n" +
      "- La vitesse de variation (le **facteur K**) est **adaptative** : élevée pour les nouveaux (calibrage rapide), plus faible pour les joueurs confirmés (stabilité en haut de classement).\n" +
      "- Seules les compétitions marquées **compétitives** influencent l'Elo.\n\n" +
      "Les seuils des tiers comme les paramètres du moteur (K, base…) sont **réglables par les administrateurs** : le classement colle à la réalité de la scène plutôt qu'à une grille figée.",
  },
  {
    key: "criteria",
    title: "Critères",
    orderIndex: 3,
    body:
      "**Placement dans un tier.** Il dépend uniquement de l'Elo : dès qu'il franchit un seuil (configurable), le joueur change de tier. L'Elo lui-même vient des résultats (voir « Notes (notation) »).\n\n" +
      "**Modes.** Les joueurs sont répartis en trois modes :\n" +
      "- **Joueurs** — ont déjà disputé au moins une compétition.\n" +
      "- **Rookie** — nouveaux venus, aucune compétition jouée pour l'instant (Elo encore en calibrage).\n" +
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
