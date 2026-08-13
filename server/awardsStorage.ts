/**
 * Palmarès (awards de cérémonie). Récipiendaire flexible : joueur, équipe, liste
 * de joueurs (best team) ou texte libre. La lecture résout les noms/avatars et
 * l'équipe + conférence de chaque joueur dans la compétition de l'award.
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { awards, players, teams, conferences, teamPlayers, competitions, type Award, type InsertAward } from "@shared/schema";

export type Recipient = {
  playerId: string | null;
  pseudo: string;
  avatarUrl: string | null;
  team: string | null;
  conference: string | null;
  conferenceColor: string | null;
};

export type AwardCard = {
  id: string;
  competitionId: string | null;
  competitionName: string | null;
  competitionOrder: number;
  title: string;
  subtitle: string | null;
  justification: string | null;
  recipientType: string;
  accent: string | null;
  featured: boolean;
  orderIndex: number;
  teamName: string | null;
  teamLogo: string | null;
  recipients: Recipient[];
  freeText: string | null;
  // IDs bruts (pour l'édition admin).
  playerId: string | null;
  teamId: string | null;
  playerIds: string[];
};

export const awardsStore = {
  async list(): Promise<AwardCard[]> {
    const rows = await db.select().from(awards).where(eq(awards.published, true));
    if (rows.length === 0) return [];

    const [pls, tms, confs, tps, comps] = await Promise.all([
      db.select({ id: players.id, pseudo: players.pseudo, avatarUrl: players.avatarUrl }).from(players),
      db.select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl, conferenceId: teams.conferenceId, competitionId: teams.competitionId }).from(teams),
      db.select({ id: conferences.id, name: conferences.name, color: conferences.color }).from(conferences),
      db.select({ playerId: teamPlayers.playerId, teamId: teamPlayers.teamId }).from(teamPlayers),
      db.select({ id: competitions.id, name: competitions.name, createdAt: competitions.createdAt, closedAt: competitions.closedAt }).from(competitions),
    ]);

    const playerMap = new Map(pls.map((p) => [p.id, p]));
    const teamMap = new Map(tms.map((t) => [t.id, t]));
    const confMap = new Map(confs.map((c) => [c.id, c]));
    const compMap = new Map(comps.map((c) => [c.id, c]));
    const rosterMap = new Map<string, string>(); // `${competitionId}:${playerId}` -> teamId
    for (const tp of tps) {
      const t = teamMap.get(tp.teamId);
      if (t?.competitionId) rosterMap.set(`${t.competitionId}:${tp.playerId}`, tp.teamId);
    }

    const resolvePlayer = (playerId: string, competitionId: string | null): Recipient => {
      const p = playerMap.get(playerId);
      let team: string | null = null;
      let conference: string | null = null;
      let conferenceColor: string | null = null;
      if (competitionId) {
        const teamId = rosterMap.get(`${competitionId}:${playerId}`);
        const t = teamId ? teamMap.get(teamId) : undefined;
        if (t) {
          team = t.name;
          const c = t.conferenceId ? confMap.get(t.conferenceId) : undefined;
          if (c) { conference = c.name; conferenceColor = c.color; }
        }
      }
      return { playerId, pseudo: p?.pseudo ?? "?", avatarUrl: p?.avatarUrl ?? null, team, conference, conferenceColor };
    };

    return rows
      .map((a): AwardCard => {
        const comp = a.competitionId ? compMap.get(a.competitionId) : undefined;
        const order = comp ? new Date((comp.closedAt ?? comp.createdAt ?? 0) as string | number | Date).getTime() : 0;
        let recipients: Recipient[] = [];
        let teamName: string | null = null;
        let teamLogo: string | null = null;

        let rawPlayerIds: string[] = [];
        if (a.playerIds) {
          try { rawPlayerIds = JSON.parse(a.playerIds); } catch { rawPlayerIds = []; }
        }
        if (a.recipientType === "player" && a.playerId) {
          recipients = [resolvePlayer(a.playerId, a.competitionId)];
        } else if (a.recipientType === "players") {
          recipients = rawPlayerIds.map((id) => resolvePlayer(id, a.competitionId));
        } else if (a.recipientType === "team" && a.teamId) {
          const t = teamMap.get(a.teamId);
          teamName = t?.name ?? null;
          teamLogo = t?.logoUrl ?? null;
          recipients = tps.filter((tp) => tp.teamId === a.teamId).map((tp) => resolvePlayer(tp.playerId, a.competitionId));
        }

        return {
          id: a.id,
          competitionId: a.competitionId,
          competitionName: comp?.name ?? null,
          competitionOrder: order,
          title: a.title,
          subtitle: a.subtitle,
          justification: a.justification,
          recipientType: a.recipientType,
          accent: a.accent,
          featured: a.featured,
          orderIndex: a.orderIndex,
          teamName,
          teamLogo,
          recipients,
          freeText: a.freeText,
          playerId: a.playerId,
          teamId: a.teamId,
          playerIds: rawPlayerIds,
        };
      })
      .sort((x, y) => y.competitionOrder - x.competitionOrder || x.orderIndex - y.orderIndex);
  },

  create(data: InsertAward): Promise<Award> {
    return db.insert(awards).values(data).returning().then((r) => r[0]);
  },
  async update(id: string, patch: Partial<InsertAward>): Promise<Award | undefined> {
    const [row] = await db.update(awards).set(patch).where(eq(awards.id, id)).returning();
    return row;
  },
  async remove(id: string): Promise<void> {
    await db.delete(awards).where(eq(awards.id, id));
  },
};
