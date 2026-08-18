import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { buildMatchEvents } from "@/components/match-calendar";
import { EventCalendar, type CalEvent } from "@/components/event-calendar";
import { MatchVisualView } from "@/components/match-visual";
import { PageHero } from "@/components/page-hero";
import type { Competition, Match, Team } from "@shared/schema";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null };
type RMatch = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null; gameMode: string | null; map: string | null; mapHidden: boolean; datetime: string | null };
type RRound = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; matches: RMatch[] };

const splitBans = (s: string | null | undefined): string[] => (s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const fmtT = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const trio = (t: PoolPlayer[]) => t.map((p) => p.pseudo).join(" · ");

/**
 * Calendrier & résultats — sélecteur de compétition + calendrier générique.
 * Fusionne les matchs d'équipe et les affrontements de tournoi aléatoire.
 */
export function MatchesPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const pick = comps.find((c) => c.status === "active") ?? comps[0];
    if (pick) setCompetitionId(pick.id);
  }, [comps, competitionId]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });
  const { data: matches } = useQuery<Match[]>({
    queryKey: ["/api/matches", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/matches?competitionId=${competitionId}`)).json(),
  });
  const { data: rounds } = useQuery<RRound[]>({
    queryKey: ["/api/random", competitionId, "rounds"],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/rounds`)).json(),
  });

  const events: CalEvent[] = useMemo(() => {
    const teamEvents = buildMatchEvents(matches ?? [], teams ?? []);
    const randomEvents: CalEvent[] = (rounds ?? []).flatMap((r) =>
      r.matches.map((m) => {
        const bans = splitBans(r.bans);
        const t = m.datetime ? fmtT(m.datetime) : "";
        const done = !!m.winner;
        return {
          id: m.id,
          datetime: m.datetime,
          status: done ? "completed" : "upcoming",
          chip: `${t ? t + " " : ""}${trio(m.teamA)} ${done ? `${m.scoreA}-${m.scoreB}` : "vs"} ${trio(m.teamB)}`,
          card: (
            <MatchVisualView className="w-[340px]" expandable
              mapName={m.map} modeName={m.gameMode} mapHidden={m.mapHidden}
              time={m.datetime ? new Date(m.datetime).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null}
              a={{ name: "Équipe A", players: m.teamA, won: m.winner === "a" }}
              b={{ name: "Équipe B", players: m.teamB, won: m.winner === "b" }}
              score={done ? { a: m.scoreA, b: m.scoreB } : null}
              bans={bans}
            />
          ),
        } as CalEvent;
      }),
    );
    return [...teamEvents, ...randomEvents];
  }, [matches, teams, rounds]);

  return (
    <div className="w-full px-6 py-8">
      <PageHero title="Calendrier & résultats" subtitle="Matchs à venir et passés" settingKey="hero_calendrier" defaultImage="/images/calendrier.webp" />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <EventCalendar events={events} emptyLabel="Aucun match." />
    </div>
  );
}

export default MatchesPage;
