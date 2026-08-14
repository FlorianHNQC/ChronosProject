/**
 * Moteur de classement Elo — recalcul depuis les résultats.
 *
 * Principes (cf. CDC §14) :
 *  - Chaque joueur part de son **Elo de départ** (seed_elo, évaluation préliminaire
 *    réglable par admin), pas d'une base uniforme.
 *  - Le résultat vient de `matches.winner_id` (fiable), et la composition des
 *    rosters d'équipe (team_players) — pas des stats du dernier round (peu fiables).
 *  - Elo par équipe (moyenne des joueurs, courbe logistique en /400), **résultat
 *    seul** (victoire/défaite/nul), **K adaptatif** (provisoire élevé → stable).
 *  - Seules les compétitions marquées `affects_elo` comptent.
 *
 * Chaque recalcul produit un batch de changelog et met à jour, par joueur : Elo,
 * tier, date de dernière évolution et nombre de compétitions jouées.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  matches, teamPlayers, teams, competitions, players, tiers, tags, playerTags, changelogBatches, eloChangelog,
} from "@shared/schema";
import { tierForElo } from "@shared/tiers";
import { eloParamsStore } from "./eloParamsStorage";

export const eloEngine = {
  async recompute(opts: { k?: number; competitionId?: string; authorUserId?: string }): Promise<{ players: number; matches: number; k: number }> {
    const P = await eloParamsStore.get();
    const BASE = P.base;
    const fixedK = opts.k && opts.k > 0 ? opts.k : null;

    const allPlayers = await db.select({ id: players.id, elo: players.elo, seedElo: players.seedElo }).from(players);

    // Bonus de tag (palmarès) : on ne garde que le PLUS ÉLEVÉ des tags d'un joueur.
    const tagRows = await db.select({ id: tags.id, eloBonus: tags.eloBonus }).from(tags);
    const bonusByTag = new Map(tagRows.map((t) => [t.id, t.eloBonus ?? 0]));
    const pts = await db.select({ playerId: playerTags.playerId, tagId: playerTags.tagId }).from(playerTags);
    const tagBonus = new Map<string, number>();
    for (const pt of pts) {
      const b = bonusByTag.get(pt.tagId) ?? 0;
      if (b > (tagBonus.get(pt.playerId) ?? 0)) tagBonus.set(pt.playerId, b);
    }
    // Elo de départ effectif = seed (rang) + meilleur bonus de tag.
    const seedOf = (id: string, seedElo: number | null) => (seedElo ?? BASE) + (tagBonus.get(id) ?? 0);

    const prev = new Map<string, number>(allPlayers.map((p) => [p.id, p.elo ?? BASE]));
    const cur = new Map<string, number>(allPlayers.map((p) => [p.id, seedOf(p.id, p.seedElo)]));
    const games = new Map<string, number>();

    // Compétitions qui comptent pour l'Elo.
    const comps = await db.select({ id: competitions.id, affectsElo: competitions.affectsElo }).from(competitions);
    const affects = new Set(comps.filter((c) => c.affectsElo !== false).map((c) => c.id));

    // Rosters : teamId -> playerId[] ; et compétition de chaque équipe.
    const tps = await db.select({ teamId: teamPlayers.teamId, playerId: teamPlayers.playerId }).from(teamPlayers);
    const tms = await db.select({ id: teams.id, competitionId: teams.competitionId }).from(teams);
    const teamComp = new Map<string, string | null>(tms.map((t) => [t.id, t.competitionId]));
    const roster = new Map<string, string[]>();
    for (const tp of tps) {
      if (!roster.has(tp.teamId)) roster.set(tp.teamId, []);
      roster.get(tp.teamId)!.push(tp.playerId);
    }

    // Compétitions jouées par joueur (via rosters d'équipes rattachées à une compétition).
    const compsByPlayer = new Map<string, Set<string>>();
    for (const tp of tps) {
      const cid = teamComp.get(tp.teamId);
      if (!cid) continue;
      if (!compsByPlayer.has(tp.playerId)) compsByPlayer.set(tp.playerId, new Set());
      compsByPlayer.get(tp.playerId)!.add(cid);
    }

    // Matchs terminés, dans l'ordre chronologique.
    const ms = await db
      .select({
        id: matches.id,
        competitionId: matches.competitionId,
        teamHomeId: matches.teamHomeId,
        teamAwayId: matches.teamAwayId,
        winnerId: matches.winnerId,
        status: matches.status,
      })
      .from(matches)
      .orderBy(asc(matches.datetime));

    const kFor = (id: string): number => {
      if (fixedK) return fixedK;
      if ((games.get(id) ?? 0) < P.provisionalGames) return P.kProvisional;
      if ((cur.get(id) ?? BASE) >= P.kStableElo) return P.kStable;
      return P.kBase;
    };

    let processed = 0;
    for (const m of ms) {
      if (m.status !== "completed") continue;
      if (!m.competitionId || !affects.has(m.competitionId)) continue;
      if (opts.competitionId && m.competitionId !== opts.competitionId) continue;
      if (!m.teamHomeId || !m.teamAwayId) continue;

      const homeP = roster.get(m.teamHomeId) ?? [];
      const awayP = roster.get(m.teamAwayId) ?? [];
      if (homeP.length === 0 || awayP.length === 0) continue;

      const avg = (ps: string[]) => ps.reduce((s, p) => s + (cur.get(p) ?? BASE), 0) / ps.length;
      const eloH = avg(homeP);
      const eloA = avg(awayP);
      const expH = 1 / (1 + Math.pow(10, (eloA - eloH) / 400));
      const expA = 1 - expH;

      let sH: number;
      let sA: number;
      if (m.winnerId === m.teamHomeId) { sH = 1; sA = 0; }
      else if (m.winnerId === m.teamAwayId) { sH = 0; sA = 1; }
      else { sH = 0.5; sA = 0.5; } // nul / vainqueur non renseigné

      for (const p of homeP) {
        cur.set(p, (cur.get(p) ?? BASE) + kFor(p) * (sH - expH));
        games.set(p, (games.get(p) ?? 0) + 1);
      }
      for (const p of awayP) {
        cur.set(p, (cur.get(p) ?? BASE) + kFor(p) * (sA - expA));
        games.set(p, (games.get(p) ?? 0) + 1);
      }
      processed++;
    }

    const allTiers = await db.select().from(tiers);

    await db.transaction(async (tx) => {
      const note = fixedK ? `Recalcul Elo (K=${fixedK})` : "Recalcul Elo (K adaptatif)";
      const [batch] = await tx.insert(changelogBatches).values({ note, authorUserId: opts.authorUserId ?? null }).returning();
      for (const p of allPlayers) {
        // Régression vers l'Elo de départ (rang) pondérée par le nombre de matchs :
        // Elo = Départ + (Calculé − Départ) × matchs / (matchs + priorGames).
        const raw = cur.get(p.id) ?? BASE;
        const seed = seedOf(p.id, p.seedElo);
        const g = games.get(p.id) ?? 0;
        const shrunk = P.priorGames > 0 ? seed + (raw - seed) * (g / (g + P.priorGames)) : raw;
        const newElo = Math.round(shrunk);
        const oldElo = prev.get(p.id) ?? BASE;
        const newTierId = tierForElo(newElo, allTiers)?.id ?? null;
        const played = compsByPlayer.get(p.id)?.size ?? 0;
        await tx
          .update(players)
          .set({ elo: newElo, tierId: newTierId, lastEloChangeAt: new Date(), competitionsPlayed: played })
          .where(eq(players.id, p.id));
        if (newElo !== oldElo) {
          await tx.insert(eloChangelog).values({ batchId: batch.id, playerId: p.id, oldElo, newElo, newTierId, comment: null });
        }
      }
    });

    return { players: allPlayers.length, matches: processed, k: fixedK ?? P.kBase };
  },
};
