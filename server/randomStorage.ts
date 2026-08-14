/**
 * Tournoi à équipes aléatoires (format « chaos »). Un pool de joueurs ; à chaque
 * tour on tire des trios au sort et on les apparie en affrontements 3v3 (BO3).
 * Comme les mates changent chaque tour, le classement est INDIVIDUEL (victoires
 * par joueur). Non lié à l'Elo.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { randomParticipants, randomRounds, randomMatches, players, type RandomMatch } from "@shared/schema";

export type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null };
export type MatchView = {
  id: string;
  teamA: PoolPlayer[];
  teamB: PoolPlayer[];
  scoreA: number;
  scoreB: number;
  winner: string | null;
};
export type RoundView = {
  id: string;
  roundNumber: number;
  gameMode: string | null;
  bans: string | null;
  note: string | null;
  matches: MatchView[];
};
export type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const parseTeam = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
};

async function playerMap(): Promise<Map<string, PoolPlayer>> {
  const rows = await db.select({ id: players.id, pseudo: players.pseudo, avatarUrl: players.avatarUrl }).from(players);
  return new Map(rows.map((r) => [r.id, { playerId: r.id, pseudo: r.pseudo, avatarUrl: r.avatarUrl }]));
}

export const randomStore = {
  async listParticipants(competitionId: string): Promise<PoolPlayer[]> {
    const rows = await db
      .select({ playerId: randomParticipants.playerId, pseudo: players.pseudo, avatarUrl: players.avatarUrl })
      .from(randomParticipants)
      .leftJoin(players, eq(randomParticipants.playerId, players.id))
      .where(eq(randomParticipants.competitionId, competitionId));
    return rows.map((r) => ({ playerId: r.playerId, pseudo: r.pseudo ?? "?", avatarUrl: r.avatarUrl ?? null }));
  },

  async addParticipant(competitionId: string, playerId: string): Promise<void> {
    await db.insert(randomParticipants).values({ competitionId, playerId }).onConflictDoNothing();
  },
  async removeParticipant(competitionId: string, playerId: string): Promise<void> {
    await db.delete(randomParticipants).where(and(eq(randomParticipants.competitionId, competitionId), eq(randomParticipants.playerId, playerId)));
  },

  /** Tire un nouveau tour : mélange les joueurs présents en trios et les apparie. */
  async drawRound(competitionId: string, playerIds: string[], gameMode?: string, bans?: string): Promise<RoundView> {
    const existing = await db.select({ n: randomRounds.roundNumber }).from(randomRounds).where(eq(randomRounds.competitionId, competitionId));
    const roundNumber = existing.reduce((m, r) => Math.max(m, r.n), 0) + 1;

    const [round] = await db
      .insert(randomRounds)
      .values({ competitionId, roundNumber, gameMode: gameMode || null, bans: bans || null })
      .returning();

    const shuffled = shuffle(playerIds);
    const trios: string[][] = [];
    for (let i = 0; i + 3 <= shuffled.length; i += 3) trios.push(shuffled.slice(i, i + 3));
    // Apparie les trios deux par deux (un trio en trop = repos).
    for (let i = 0; i + 2 <= trios.length; i += 2) {
      await db.insert(randomMatches).values({
        roundId: round.id,
        competitionId,
        teamA: JSON.stringify(trios[i]),
        teamB: JSON.stringify(trios[i + 1]),
      });
    }
    return (await this.listRounds(competitionId)).find((r) => r.id === round.id)!;
  },

  async listRounds(competitionId: string): Promise<RoundView[]> {
    const rounds = await db.select().from(randomRounds).where(eq(randomRounds.competitionId, competitionId)).orderBy(asc(randomRounds.roundNumber));
    if (rounds.length === 0) return [];
    const ms = await db.select().from(randomMatches).where(eq(randomMatches.competitionId, competitionId));
    const pm = await playerMap();
    const resolve = (ids: string[]) => ids.map((id) => pm.get(id) ?? { playerId: id, pseudo: "?", avatarUrl: null });
    const byRound = new Map<string, MatchView[]>();
    for (const m of ms) {
      if (!byRound.has(m.roundId)) byRound.set(m.roundId, []);
      byRound.get(m.roundId)!.push({
        id: m.id,
        teamA: resolve(parseTeam(m.teamA)),
        teamB: resolve(parseTeam(m.teamB)),
        scoreA: m.scoreA ?? 0,
        scoreB: m.scoreB ?? 0,
        winner: m.winner,
      });
    }
    return rounds.map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      gameMode: r.gameMode,
      bans: r.bans,
      note: r.note,
      matches: byRound.get(r.id) ?? [],
    }));
  },

  async setMatchResult(matchId: string, scoreA: number, scoreB: number): Promise<RandomMatch | undefined> {
    const winner = scoreA === scoreB ? null : scoreA > scoreB ? "a" : "b";
    const [row] = await db.update(randomMatches).set({ scoreA, scoreB, winner }).where(eq(randomMatches.id, matchId)).returning();
    return row;
  },

  async leaderboard(competitionId: string): Promise<LeaderRow[]> {
    const ms = await db.select().from(randomMatches).where(eq(randomMatches.competitionId, competitionId));
    const pm = await playerMap();
    const rec = new Map<string, LeaderRow>();
    const ensure = (id: string): LeaderRow => {
      let r = rec.get(id);
      if (!r) {
        const p = pm.get(id);
        r = { playerId: id, pseudo: p?.pseudo ?? "?", avatarUrl: p?.avatarUrl ?? null, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 };
        rec.set(id, r);
      }
      return r;
    };
    for (const m of ms) {
      if (!m.winner) continue; // match non joué
      const a = parseTeam(m.teamA);
      const b = parseTeam(m.teamB);
      const sa = m.scoreA ?? 0;
      const sb = m.scoreB ?? 0;
      for (const id of a) { const r = ensure(id); r.played++; r.gamesWon += sa; r.gamesLost += sb; if (m.winner === "a") r.wins++; else r.losses++; }
      for (const id of b) { const r = ensure(id); r.played++; r.gamesWon += sb; r.gamesLost += sa; if (m.winner === "b") r.wins++; else r.losses++; }
    }
    return Array.from(rec.values()).sort(
      (x, y) => y.wins - x.wins || (y.gamesWon - y.gamesLost) - (x.gamesWon - x.gamesLost) || x.pseudo.localeCompare(y.pseudo),
    );
  },
};
