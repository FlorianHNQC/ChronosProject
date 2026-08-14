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
      "**En bref.** Ton Elo part d'une évaluation de départ basée surtout sur ton **rang Ranked**, puis chaque match le fait varier : tu gagnes des points en battant plus fort que toi, tu en perds en tombant contre plus faible. Ton tier (T0, T1…) n'est qu'une tranche d'Elo.\n\n" +
      "## Ce qui compte\n" +
      "On se base sur le **vainqueur officiel** du match, pas sur les statistiques en jeu (peu fiables). Chaque match vaut : **victoire = 1**, **défaite = 0**, **nul = 0,5**. Seules les compétitions marquées **compétitives** comptent, et seuls les matchs **terminés** sont pris en compte.\n\n" +
      "## Le calcul, match par match\n" +
      "Pour un match entre l'équipe A et l'équipe B :\n\n" +
      "**1. Force de chaque équipe** — la moyenne de l'Elo de ses joueurs à ce moment-là (on note EloA et EloB).\n\n" +
      "**2. Score attendu** (la probabilité de gagner) : Attendu(A) = 1 ÷ (1 + 10^((EloB − EloA) ÷ 400)), et Attendu(B) = 1 − Attendu(A). Même niveau → 50 % chacun ; 400 points d'écart → le favori a ~10× plus de chances de gagner.\n\n" +
      "**3. Variation de chaque joueur** : nouvel Elo = ancien Elo + K × (Résultat − Attendu), où Résultat (1, 0 ou 0,5) et Attendu sont ceux de son équipe. Battre un favori (Attendu faible) rapporte gros ; perdre contre un outsider coûte cher. Tous les joueurs du roster reçoivent la variation de l'équipe (chacun pondéré par son propre K).\n\n" +
      "## Le facteur K (l'ampleur des variations)\n" +
      "K est **adaptatif**, calculé par joueur :\n" +
      "- **Provisoire** — tant qu'un joueur a joué moins de **10 matchs** : K = **40** (calibrage rapide, pour trouver vite son niveau).\n" +
      "- **Standard** — ensuite : K = **24**.\n" +
      "- **Confirmé** — au-dessus de **1900** d'Elo : K = **16** (variations adoucies, pour stabiliser le haut du classement).\n\n" +
      "Ces valeurs (10 matchs, 40/24/16, seuil 1900) sont **réglables par les admins**, qui peuvent aussi forcer un K unique lors d'un recalcul.\n\n" +
      "## L'Elo de départ (évaluation préliminaire)\n" +
      "Avant tout match, chaque joueur reçoit un Elo de base déterminé surtout par son **rang Ranked** (poids très fort), avec un **petit bonus de trophées** (+1 Elo par 2000 trophées, plafonné à +50 — jamais assez pour dépasser un rang supérieur).\n\n" +
      "| Rang Ranked | Elo de base |\n" +
      "| --- | --- |\n" +
      "| Bronze → Or | ~950–1080 |\n" +
      "| Diamant I (plancher) | 1100 |\n" +
      "| Diamant II–III | 1140–1180 |\n" +
      "| Mythique I / II / III | 1250 / 1325 / **1400** |\n" +
      "| Légendaire I / II / III | **1550** / 1650 / 1750 |\n" +
      "| Master 1 / 2 / 3 | 1900 / 2000 / 2100 |\n" +
      "| Pro | 2250 |\n\n" +
      "Pourquoi ce barème : Diamant I est un plancher que tout le monde atteint (faible signal) ; le **saut Mythique III → Légendaire I** marque le vrai clivage faible/fort ; Master est l'élite. Le rang écrase les trophées — un **Master 1 à 40k** (≈ 1920) reste très au-dessus d'un **Mythique III à 120k** (≈ 1450). Le classement est ensuite obtenu en **rejouant tous les matchs** depuis cet Elo de départ, donc cohérent et reproductible.\n\n" +
      "## De l'Elo au tier\n" +
      "Le tier est une simple **tranche d'Elo** : chaque tier a un seuil minimum (T0 ≥ 2000, T1 ≥ 1700… configurables). Ton tier = la tranche où tombe ton Elo.\n\n" +
      "## Exemple concret\n" +
      "Une équipe à 1500 affronte une équipe à 1700. Attendu de l'équipe à 1500 ≈ 1 ÷ (1 + 10^((1700−1500)÷400)) ≈ **0,24** (24 % de chances). Si elle **gagne** (Résultat = 1) en régime standard (K = 24) : +24 × (1 − 0,24) ≈ **+18 Elo**. Si elle **perd** (Résultat = 0) : +24 × (0 − 0,24) ≈ **−6 Elo**. Battre plus fort rapporte donc bien plus que perdre contre plus fort ne coûte.",
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
