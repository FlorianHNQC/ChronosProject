/**
 * Moteur de classement Elo — recalcul depuis les résultats.
 *
 * L'Elo est piloté par les faits objectifs (résultats de match). On repart d'une
 * base neutre et on rejoue les matchs (qui ont des stats, donc une composition
 * connue) dans l'ordre chronologique, avec une mise à jour de type Elo par
 * équipe. Le facteur K est configurable (itératif, cf. CDC §14.1). Chaque
 * recalcul produit un batch de changelog et met à jour, pour chaque joueur, son
 * Elo, son tier, la date de dernière évolution et le nombre de compétitions
 * jouées (denormalisé, utile aux modes Rookie / Réserve).
 *
 * Ce recalcul est l'automation déclenchée après une fusion de profils (le profil
 * conservé hérite de l'historique de l'autre → son classement doit être recalculé).
 */
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  matches, matchPlayerStats, players, tiers, changelogBatches, eloChangelog,
} from "@shared/schema";
import { tierForElo } from "@shared/tiers";

const BASE = 1000;

export const eloEngine = {
  async recompute(opts: { k?: number; competitionId?: string }): Promise<{ players: number; matches: number; k: number }> {
    const K = opts.k && opts.k > 0 ? opts.k : 24;

    const allPlayers = await db.select({ id: players.id, elo: players.elo }).from(players);
    const prev = new Map<string, number>(allPlayers.map((p) => [p.id, p.elo ?? BASE]));
    const cur = new Map<string, number>(allPlayers.map((p) => [p.id, BASE]));

    // Tous les matchs (pour la carte matchId → compétition) et l'ordre chronologique.
    const ms = await db
      .select({ id: matches.id, competitionId: matches.competitionId })
      .from(matches)
      .orderBy(asc(matches.datetime));
    const matchComp = new Map<string, string | null>(ms.map((m) => [m.id, m.competitionId]));
    const matchList = opts.competitionId ? ms.filter((m) => m.competitionId === opts.competitionId) : ms;

    // Toutes les stats en une passe, groupées par match.
    const stats = await db
      .select({ matchId: matchPlayerStats.matchId, playerId: matchPlayerStats.playerId, teamId: matchPlayerStats.teamId, victory: matchPlayerStats.victory })
      .from(matchPlayerStats);
    const byMatch = new Map<string, typeof stats>();
    for (const s of stats) {
      if (!byMatch.has(s.matchId)) byMatch.set(s.matchId, []);
      byMatch.get(s.matchId)!.push(s);
    }

    // Compétitions jouées par joueur (global, indépendant du périmètre Elo).
    const compsByPlayer = new Map<string, Set<string>>();
    for (const s of stats) {
      const cid = matchComp.get(s.matchId);
      if (!cid) continue;
      if (!compsByPlayer.has(s.playerId)) compsByPlayer.set(s.playerId, new Set());
      compsByPlayer.get(s.playerId)!.add(cid);
    }

    let processed = 0;
    for (const m of matchList) {
      const rows = byMatch.get(m.id);
      if (!rows || rows.length === 0) continue;
      const teamMap = new Map<string, { players: string[]; win: boolean }>();
      for (const r of rows) {
        if (!teamMap.has(r.teamId)) teamMap.set(r.teamId, { players: [], win: false });
        const t = teamMap.get(r.teamId)!;
        t.players.push(r.playerId);
        if (r.victory) t.win = true;
      }
      const entries = Array.from(teamMap.values());
      if (entries.length !== 2) continue;
      const [A, B] = entries;
      const avg = (ps: string[]) => ps.reduce((s, p) => s + (cur.get(p) ?? BASE), 0) / ps.length;
      const eloA = avg(A.players);
      const eloB = avg(B.players);
      const expA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
      const expB = 1 - expA;
      const sA = A.win ? 1 : 0;
      const sB = B.win ? 1 : 0;
      for (const p of A.players) cur.set(p, (cur.get(p) ?? BASE) + K * (sA - expA));
      for (const p of B.players) cur.set(p, (cur.get(p) ?? BASE) + K * (sB - expB));
      processed++;
    }

    const allTiers = await db.select().from(tiers);

    await db.transaction(async (tx) => {
      const [batch] = await tx.insert(changelogBatches).values({ note: `Recalcul Elo (K=${K})` }).returning();
      for (const p of allPlayers) {
        const newElo = Math.round(cur.get(p.id) ?? BASE);
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

    return { players: allPlayers.length, matches: processed, k: K };
  },
};
