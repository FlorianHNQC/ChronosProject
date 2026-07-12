import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { CalendarDays } from "lucide-react";
import type { Competition, Match, Team } from "@shared/schema";

const STATUS: Record<string, { label: string; color: string }> = {
  upcoming: { label: "À venir", color: "#8B93A7" },
  live: { label: "En direct", color: "#E23B3B" },
  completed: { label: "Terminé", color: "#2E7D32" },
  cancelled: { label: "Annulé", color: "#B45309" },
};

const DAY_MS = 86400000;
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

/**
 * Calendrier & résultats — agenda regroupé par date (à venir puis passés).
 */
export function MatchesPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");
  const [, navigate] = useLocation();

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

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return (id: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: Match[] = [];
    const pa: Match[] = [];
    for (const m of matches ?? []) {
      const isPast = m.status === "completed" || m.status === "cancelled" ||
        (m.datetime ? new Date(m.datetime).getTime() < now - DAY_MS : true);
      (isPast ? pa : up).push(m);
    }
    const groupBy = (list: Match[], dir: 1 | -1) => {
      const g = new Map<string, Match[]>();
      for (const m of list) {
        const k = dayKey(m.datetime);
        if (!g.has(k)) g.set(k, []);
        g.get(k)!.push(m);
      }
      return Array.from(g.entries()).sort((a, b) => (a[0] < b[0] ? -dir : a[0] > b[0] ? dir : 0));
    };
    return { upcoming: groupBy(up, 1), past: groupBy(pa, -1) };
  }, [matches]);

  const renderRow = (m: Match) => {
    const st = STATUS[m.status ?? "upcoming"] ?? STATUS.upcoming;
    const done = m.status === "completed";
    return (
      <Card key={m.id} onClick={() => navigate(`/matchs/${m.id}`)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
        <span className="text-xs px-2 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: st.color }}>{st.label}</span>
        <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
          <span className="font-medium truncate text-right flex-1">{teamName(m.teamHomeId)}</span>
          <span className="font-mono text-sm shrink-0">{done ? `${m.scoreHome ?? 0} – ${m.scoreAway ?? 0}` : "vs"}</span>
          <span className="font-medium truncate flex-1">{teamName(m.teamAwayId)}</span>
        </div>
        <div className="text-xs text-muted-foreground text-right shrink-0 w-24">{m.gameMode ?? ""}</div>
      </Card>
    );
  };

  const renderAgenda = (groups: [string, Match[]][]) =>
    groups.map(([key, list]) => (
      <div key={key} className="mb-5">
        <div className="text-sm font-semibold text-primary capitalize mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> {dayLabel(key)} <span className="text-muted-foreground font-normal">· {list.length}</span>
        </div>
        <div className="space-y-2">{list.map(renderRow)}</div>
      </div>
    ));

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">Calendrier & résultats</h1>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {(matches ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun match pour cette compétition.</p>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-3">À venir</h2>
          {renderAgenda(upcoming)}
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Résultats & matchs passés</h2>
          {renderAgenda(past)}
        </section>
      )}
    </div>
  );
}

export default MatchesPage;
