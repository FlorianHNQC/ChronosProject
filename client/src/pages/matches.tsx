import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { CompetitionSelect } from "@/components/competition-select";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { MatchCalendar } from "@/components/match-calendar";
import { useLocation } from "wouter";
import { CalendarDays, Trophy } from "lucide-react";
import type { Competition, Match, Team } from "@shared/schema";

const STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: "À venir", className: "bg-muted text-muted-foreground" },
  live: { label: "En direct", className: "bg-destructive text-destructive-foreground border-transparent" },
  completed: { label: "Terminé", className: "bg-primary/15 text-primary border-primary/25" },
  cancelled: { label: "Annulé", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
};

const DAY_MS = 86400000;
const PAST_PAGE = 20;

function dayKey(d: string | Date | null): string {
  if (!d) return "0000-00-00";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function dayLabel(key: string): string {
  if (key === "0000-00-00") return "Date à définir";
  const dt = new Date(key + "T00:00:00");
  return dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Regroupe une liste déjà triée par jour, en préservant l'ordre d'apparition. */
function groupOrdered(list: Match[]): [string, Match[]][] {
  const out: [string, Match[]][] = [];
  const idx = new Map<string, number>();
  for (const m of list) {
    const k = dayKey(m.datetime);
    let i = idx.get(k);
    if (i === undefined) { i = out.length; idx.set(k, i); out.push([k, []]); }
    out[i][1].push(m);
  }
  return out;
}

/**
 * Calendrier & résultats — agenda regroupé par date (à venir puis passés).
 * Les matchs passés (potentiellement des centaines) sont paginés.
 */
export function MatchesPage({ competitionId: fixedId }: { competitionId?: string } = {}) {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [selectedId, setSelectedId] = useState("");
  const competitionId = fixedId ?? selectedId;
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"calendar" | "agenda">("calendar");
  const [, navigate] = useLocation();

  useEffect(() => {
    if (fixedId || selectedId || !comps || comps.length === 0) return;
    const pick = comps.find((c) => c.status === "active") ?? comps[0];
    if (pick) setSelectedId(pick.id);
  }, [comps, selectedId, fixedId]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });
  const { data: matches, isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/matches?competitionId=${competitionId}`)).json(),
  });

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return (id: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);

  const { upcomingGroups, pastFlat } = useMemo(() => {
    const now = Date.now();
    const up: Match[] = [];
    const pa: Match[] = [];
    for (const m of matches ?? []) {
      const isPast = m.status === "completed" || m.status === "cancelled" ||
        (m.datetime ? new Date(m.datetime).getTime() < now - DAY_MS : true);
      (isPast ? pa : up).push(m);
    }
    up.sort((a, b) => { const ka = dayKey(a.datetime), kb = dayKey(b.datetime); return ka < kb ? -1 : ka > kb ? 1 : 0; });
    pa.sort((a, b) => { const ka = dayKey(a.datetime), kb = dayKey(b.datetime); return ka < kb ? 1 : ka > kb ? -1 : 0; });
    return { upcomingGroups: groupOrdered(up), pastFlat: pa };
  }, [matches]);

  useEffect(() => setPage(1), [competitionId]);
  const pastPageCount = Math.max(1, Math.ceil(pastFlat.length / PAST_PAGE));
  const safePage = Math.min(page, pastPageCount);
  const pastGroups = useMemo(
    () => groupOrdered(pastFlat.slice((safePage - 1) * PAST_PAGE, safePage * PAST_PAGE)),
    [pastFlat, safePage],
  );

  const renderRow = (m: Match) => {
    const st = STATUS[m.status ?? "upcoming"] ?? STATUS.upcoming;
    const done = m.status === "completed";
    const hasScore = m.scoreHome != null && m.scoreAway != null;
    const homeWon = done && m.winnerId != null && m.winnerId === m.teamHomeId;
    const awayWon = done && m.winnerId != null && m.winnerId === m.teamAwayId;
    const nameCls = (won: boolean, lost: boolean) =>
      won ? "font-semibold text-primary" : lost ? "text-muted-foreground" : "font-medium";
    return (
      <Card key={m.id} onClick={() => navigate(`/matchs/${m.id}`)} className="flex cursor-pointer items-center gap-3 p-3 hover-elevate">
        <Badge variant="outline" className={`shrink-0 ${st.className}`}>{st.label}</Badge>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <span className={`flex-1 truncate text-right ${nameCls(homeWon, awayWon)}`}>{teamName(m.teamHomeId)}</span>
          <span className="flex shrink-0 items-center justify-center">
            {hasScore ? (
              <span className="font-mono text-sm">{m.scoreHome} – {m.scoreAway}</span>
            ) : done && (homeWon || awayWon) ? (
              <Trophy className="h-4 w-4 text-primary" />
            ) : (
              <span className="text-sm text-muted-foreground">vs</span>
            )}
          </span>
          <span className={`flex-1 truncate ${nameCls(awayWon, homeWon)}`}>{teamName(m.teamAwayId)}</span>
        </div>
        <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">{m.gameMode ?? ""}</div>
      </Card>
    );
  };

  const renderAgenda = (groups: [string, Match[]][]) =>
    groups.map(([key, list]) => (
      <div key={key} className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold capitalize text-primary">
          <CalendarDays className="h-4 w-4" /> {dayLabel(key)} <span className="font-normal text-muted-foreground">· {list.length}</span>
        </div>
        <div className="space-y-2">{list.map(renderRow)}</div>
      </div>
    ));

  const hasMatches = (matches ?? []).length > 0;

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Calendrier & résultats"
        icon={CalendarDays}
        actions={
          <>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {(["calendar", "agenda"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "calendar" ? "Calendrier" : "Agenda"}
                </button>
              ))}
            </div>
            {!fixedId && (
              <CompetitionSelect competitions={comps ?? []} value={selectedId} onValueChange={setSelectedId} />
            )}
          </>
        }
      />

      {competitionId && matchesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !hasMatches ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucun match pour cette compétition"
          description="Le calendrier et les résultats apparaîtront ici une fois les matchs programmés."
        />
      ) : view === "calendar" ? (
        <MatchCalendar matches={matches ?? []} teamName={teamName} />
      ) : (
        <>
          {upcomingGroups.length > 0 && (
            <section className="mb-8 animate-fade-in-up animate-delay-100">
              <h2 className="mb-3 font-semibold">À venir</h2>
              {renderAgenda(upcomingGroups)}
            </section>
          )}
          {pastFlat.length > 0 && (
            <section className="animate-fade-in-up animate-delay-200">
              <h2 className="mb-3 font-semibold">
                Résultats & matchs passés
                <span className="ml-2 font-normal text-muted-foreground">· {pastFlat.length}</span>
              </h2>
              {renderAgenda(pastGroups)}
              <Pager page={safePage} pageCount={pastPageCount} onPageChange={setPage} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default MatchesPage;
