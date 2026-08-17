/**
 * Tournoi à équipes aléatoires (format « chaos »). Un pool de joueurs ; à chaque
 * tour on tire des trios au sort et on les apparie en affrontements 3v3 (BO3).
 * Comme les mates changent chaque tour, le classement est INDIVIDUEL (victoires
 * par joueur). Non lié à l'Elo.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { randomParticipants, randomRounds, randomMatches, players, type RandomMatch } from "@shared/schema";

export type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
export type MatchView = {
  id: string;
  teamA: PoolPlayer[];
  teamB: PoolPlayer[];
  scoreA: number;
  scoreB: number;
  winner: string | null;
  gameMode: string | null;
  map: string | null;
  datetime: string | null;
};
export type RoundView = {
  id: string;
  roundNumber: number;
  gameMode: string | null;
  bans: string | null;
  note: string | null;
  matches: MatchView[];
};
export type DrawOpts = { gameMode?: string; bans?: string; balanceElo?: boolean; randomMode?: boolean; pouleScope?: "intra" | "inter" };
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

/** Forme des trios : équilibrés par Elo (serpent) ou purement aléatoires. */
function formTrios(playerIds: string[], balance: boolean, eloOf?: Map<string, number>): string[][] {
  if (balance && eloOf) {
    const nbTeams = Math.floor(playerIds.length / 3);
    const buckets: string[][] = Array.from({ length: Math.max(1, nbTeams) }, () => []);
    const sorted = [...playerIds].sort((a, b) => (eloOf.get(b) ?? 1000) - (eloOf.get(a) ?? 1000));
    let dir = 1, idx = 0;
    for (const pid of sorted) {
      if (buckets[idx].length < 3) buckets[idx].push(pid);
      let guard = 0;
      do {
        idx += dir;
        if (idx >= buckets.length) { idx = buckets.length - 1; dir = -1; }
        else if (idx < 0) { idx = 0; dir = 1; }
        if (++guard > buckets.length * 2) break;
      } while (buckets[idx].length >= 3);
    }
    return buckets.filter((b) => b.length === 3);
  }
  const shuffled = shuffle(playerIds);
  const trios: string[][] = [];
  for (let i = 0; i + 3 <= shuffled.length; i += 3) trios.push(shuffled.slice(i, i + 3));
  return trios;
}

async function eloMap(): Promise<Map<string, number>> {
  const rows = await db.select({ id: players.id, elo: players.elo }).from(players);
  return new Map(rows.map((r) => [r.id, r.elo ?? 1000]));
}

async function playerMap(): Promise<Map<string, PoolPlayer>> {
  const rows = await db.select({ id: players.id, pseudo: players.pseudo, avatarUrl: players.avatarUrl }).from(players);
  return new Map(rows.map((r) => [r.id, { playerId: r.id, pseudo: r.pseudo, avatarUrl: r.avatarUrl }]));
}

export const randomStore = {
  async listParticipants(competitionId: string): Promise<PoolPlayer[]> {
    const rows = await db
      .select({ playerId: randomParticipants.playerId, pseudo: players.pseudo, avatarUrl: players.avatarUrl, poolLabel: randomParticipants.poolLabel })
      .from(randomParticipants)
      .leftJoin(players, eq(randomParticipants.playerId, players.id))
      .where(eq(randomParticipants.competitionId, competitionId));
    return rows.map((r) => ({ playerId: r.playerId, pseudo: r.pseudo ?? "?", avatarUrl: r.avatarUrl ?? null, poolLabel: r.poolLabel ?? null }));
  },

  async addParticipant(competitionId: string, playerId: string): Promise<void> {
    await db.insert(randomParticipants).values({ competitionId, playerId }).onConflictDoNothing();
  },
  async removeParticipant(competitionId: string, playerId: string): Promise<void> {
    await db.delete(randomParticipants).where(and(eq(randomParticipants.competitionId, competitionId), eq(randomParticipants.playerId, playerId)));
  },
  /** Affecte (ou retire) la poule d'un participant. */
  async setParticipantPool(competitionId: string, playerId: string, poolLabel: string | null): Promise<void> {
    await db.update(randomParticipants).set({ poolLabel: poolLabel || null })
      .where(and(eq(randomParticipants.competitionId, competitionId), eq(randomParticipants.playerId, playerId)));
  },

  /**
   * Tire un nouveau tour : forme des trios (aléatoires ou équilibrés par Elo) et
   * les apparie en affrontements 3v3. Le mode peut être commun, ou tiré au hasard
   * par affrontement (randomMode) parmi les modes déjà utilisés.
   */
  async drawRound(competitionId: string, playerIds: string[], opts: DrawOpts = {}): Promise<RoundView> {
    const existing = await db.select({ n: randomRounds.roundNumber }).from(randomRounds).where(eq(randomRounds.competitionId, competitionId));
    const roundNumber = existing.reduce((m, r) => Math.max(m, r.n), 0) + 1;

    const [round] = await db
      .insert(randomRounds)
      .values({ competitionId, roundNumber, gameMode: opts.gameMode || null, bans: opts.bans || null })
      .returning();

    const elos = opts.balanceElo ? await eloMap() : undefined;

    // Découpage en groupes : en INTRA, on ne mélange JAMAIS deux poules (chaque
    // poule est tirée séparément). En INTER (défaut historique), tout le monde
    // ensemble.
    let groups: string[][];
    if (opts.pouleScope === "intra") {
      const parts = await this.listParticipants(competitionId);
      const pouleOf = new Map(parts.map((p) => [p.playerId, (p.poolLabel ?? "").trim()]));
      const by = new Map<string, string[]>();
      for (const id of playerIds) {
        const key = pouleOf.get(id) ?? "";
        if (!by.has(key)) by.set(key, []);
        by.get(key)!.push(id);
      }
      groups = Array.from(by.values());
    } else {
      groups = [playerIds];
    }

    // Modes de jeu : commun, ou tiré au hasard par affrontement parmi l'historique.
    let modePool: string[] = [];
    if (opts.randomMode) {
      const s = await this.suggestions();
      modePool = s.modes;
    }
    const pickMode = (): string | null => {
      if (opts.randomMode && modePool.length > 0) return modePool[Math.floor(Math.random() * modePool.length)];
      return opts.gameMode || null;
    };

    // Pour chaque groupe : trios (aléatoires ou équilibrés) appariés deux par deux.
    for (const g of groups) {
      const trios = formTrios(g, !!opts.balanceElo, elos);
      for (let i = 0; i + 2 <= trios.length; i += 2) {
        await db.insert(randomMatches).values({
          roundId: round.id,
          competitionId,
          teamA: JSON.stringify(trios[i]),
          teamB: JSON.stringify(trios[i + 1]),
          gameMode: pickMode(),
        });
      }
    }
    return (await this.listRounds(competitionId)).find((r) => r.id === round.id)!;
  },

  /** Crée un tour vide (pour composer des affrontements à la main). */
  async createEmptyRound(competitionId: string, note?: string): Promise<string> {
    const existing = await db.select({ n: randomRounds.roundNumber }).from(randomRounds).where(eq(randomRounds.competitionId, competitionId));
    const roundNumber = existing.reduce((m, r) => Math.max(m, r.n), 0) + 1;
    const [round] = await db.insert(randomRounds).values({ competitionId, roundNumber, note: note || null }).returning();
    return round.id;
  },

  /**
   * Crée un affrontement en choisissant directement les joueurs des deux camps —
   * SANS équipe persistante. Si roundId absent, crée un tour « manuel ».
   */
  async addManualMatch(
    competitionId: string,
    data: { roundId?: string; teamA: string[]; teamB: string[]; gameMode?: string; map?: string },
  ): Promise<RoundView> {
    const roundId = data.roundId || (await this.createEmptyRound(competitionId, "Manuel"));
    await db.insert(randomMatches).values({
      roundId,
      competitionId,
      teamA: JSON.stringify(data.teamA),
      teamB: JSON.stringify(data.teamB),
      gameMode: data.gameMode || null,
      map: data.map || null,
    });
    return (await this.listRounds(competitionId)).find((r) => r.id === roundId)!;
  },

  /**
   * Publie les affrontements des poules : pour chaque poule, forme des trios et
   * crée le round-robin (toutes les paires de trios) → chacun joue au sein de sa
   * poule (intra). En mode « inter », tire globalement en mélangeant les poules.
   */
  async generatePoules(competitionId: string, opts: { scope?: "intra" | "inter"; balanceElo?: boolean } = {}): Promise<RoundView> {
    const parts = await this.listParticipants(competitionId);
    const elos = opts.balanceElo ? await eloMap() : undefined;
    const roundId = await this.createEmptyRound(competitionId, opts.scope === "inter" ? "Poules — inter" : "Poules — intra");

    const makeMatchups = async (ids: string[]) => {
      const trios = formTrios(ids, !!opts.balanceElo, elos);
      // Round-robin : toutes les paires de trios de ce groupe.
      for (let i = 0; i < trios.length; i++) {
        for (let j = i + 1; j < trios.length; j++) {
          await db.insert(randomMatches).values({
            roundId, competitionId,
            teamA: JSON.stringify(trios[i]),
            teamB: JSON.stringify(trios[j]),
          });
        }
      }
    };

    if (opts.scope === "inter") {
      await makeMatchups(parts.map((p) => p.playerId));
    } else {
      const byPoule = new Map<string, string[]>();
      for (const p of parts) {
        const key = (p.poolLabel ?? "").trim();
        if (!key) continue;
        if (!byPoule.has(key)) byPoule.set(key, []);
        byPoule.get(key)!.push(p.playerId);
      }
      for (const ids of Array.from(byPoule.values())) await makeMatchups(ids);
    }
    return (await this.listRounds(competitionId)).find((r) => r.id === roundId)!;
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
        gameMode: m.gameMode ?? null,
        map: m.map ?? null,
        datetime: m.datetime ? new Date(m.datetime).toISOString() : null,
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

  /** Mode/map/date d'un affrontement (le mode peut varier ; la map/date se choisissent après le tirage). */
  async setMatchMeta(matchId: string, meta: { gameMode?: string | null; map?: string | null; datetime?: string | null }): Promise<RandomMatch | undefined> {
    const patch: Record<string, unknown> = {};
    if (meta.gameMode !== undefined) patch.gameMode = meta.gameMode || null;
    if (meta.map !== undefined) patch.map = meta.map || null;
    if (meta.datetime !== undefined) patch.datetime = meta.datetime ? new Date(meta.datetime) : null;
    if (Object.keys(patch).length === 0) return undefined;
    const [row] = await db.update(randomMatches).set(patch).where(eq(randomMatches.id, matchId)).returning();
    return row;
  },

  /** Suppressions pour ajustement (même après création). */
  async deleteMatch(matchId: string): Promise<void> {
    await db.delete(randomMatches).where(eq(randomMatches.id, matchId));
  },
  async deleteRound(roundId: string): Promise<void> {
    await db.delete(randomMatches).where(eq(randomMatches.roundId, roundId));
    await db.delete(randomRounds).where(eq(randomRounds.id, roundId));
  },

  /** Modes et maps déjà saisis (toutes compétitions) → auto-complétion. */
  async suggestions(): Promise<{ modes: string[]; maps: string[] }> {
    const roundModes = await db.select({ gameMode: randomRounds.gameMode }).from(randomRounds);
    const matchRows = await db.select({ gameMode: randomMatches.gameMode, map: randomMatches.map }).from(randomMatches);
    const modes = new Set<string>();
    const maps = new Set<string>();
    for (const r of roundModes) if (r.gameMode) modes.add(r.gameMode);
    for (const m of matchRows) { if (m.gameMode) modes.add(m.gameMode); if (m.map) maps.add(m.map); }
    return {
      modes: Array.from(modes).sort((a, b) => a.localeCompare(b)),
      maps: Array.from(maps).sort((a, b) => a.localeCompare(b)),
    };
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
