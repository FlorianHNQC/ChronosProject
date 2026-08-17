import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { MetaBadges } from "@/lib/bs-catalog";
import type { Match, Team } from "@shared/schema";

const STATUS: Record<string, { label: string; color: string }> = {
  upcoming: { label: "À venir", color: "#8B93A7" },
  live: { label: "En direct", color: "#E23B3B" },
  completed: { label: "Terminé", color: "#2E7D32" },
  cancelled: { label: "Annulé", color: "#B45309" },
};
const DAY_MS = 86400000;
const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

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
const timeLabel = (m: Match) =>
  m.datetime && m.hasTime
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(m.datetime))
    : "";

/**
 * Calendrier de matchs réutilisable : vue « Calendrier » (grille mensuelle, par
 * défaut) et vue « Liste » (agenda groupé par date). Prend une liste de matchs
 * et d'équipes ; se recadre sur le mois pertinent.
 */
export function MatchCalendar({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const [view, setView] = useState<"calendrier" | "liste">("calendrier");
  const [cursor, setCursor] = useState<Date | null>(null);
  const [, navigate] = useLocation();

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) m.set(t.id, t.name);
    return (id: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);

  useEffect(() => {
    if (cursor || matches.length === 0) return;
    const now = Date.now();
    const dated = matches.filter((m) => m.datetime).map((m) => new Date(m.datetime as unknown as string));
    if (dated.length === 0) {
      setCursor(new Date());
      return;
    }
    const up = dated.filter((d) => d.getTime() >= now).sort((a, b) => a.getTime() - b.getTime());
    const base = up[0] ?? [...dated].sort((a, b) => b.getTime() - a.getTime())[0];
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [matches, cursor]);

  const byDay = useMemo(() => {
    const g = new Map<string, Match[]>();
    for (const m of matches) {
      const k = dayKey(m.datetime);
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(m);
    }
    for (const list of Array.from(g.values()))
      list.sort((a, b) => (a.datetime ? new Date(a.datetime).getTime() : 0) - (b.datetime ? new Date(b.datetime).getTime() : 0));
    return g;
  }, [matches]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: Match[] = [];
    const pa: Match[] = [];
    for (const m of matches) {
      const isPast =
        m.status === "completed" || m.status === "cancelled" ||
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
        <div className="shrink-0"><MetaBadges gameMode={m.gameMode} map={m.map} /></div>
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

  const month = cursor ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const undated = byDay.get("0000-00-00") ?? [];

  const eventChip = (m: Match) => {
    const st = STATUS[m.status ?? "upcoming"] ?? STATUS.upcoming;
    const done = m.status === "completed";
    const label = `${timeLabel(m) ? timeLabel(m) + " " : ""}${teamName(m.teamHomeId)} ${done ? `${m.scoreHome ?? 0}-${m.scoreAway ?? 0}` : "vs"} ${teamName(m.teamAwayId)}`;
    return (
      <button
        key={m.id}
        onClick={() => navigate(`/matchs/${m.id}`)}
        title={label}
        className="w-full text-left text-[11px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 text-white hover:opacity-90"
        style={{ backgroundColor: st.color }}
      >
        {label}
      </button>
    );
  };

  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun match.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === "calendrier" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("calendrier")}>
            <CalendarDays className="h-4 w-4 mr-1" /> Calendrier
          </Button>
          <Button variant={view === "liste" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("liste")}>
            <List className="h-4 w-4 mr-1" /> Liste
          </Button>
        </div>
      </div>

      {view === "calendrier" ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold capitalize min-w-[10rem] text-center">
              {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Aujourd'hui
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border border rounded-lg overflow-hidden">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-muted/50 text-center text-xs font-medium py-1.5 capitalize">{d}</div>
            ))}
            {monthCells.map((d, i) => {
              const inMonth = d.getMonth() === month.getMonth();
              const key = dayKey(d);
              const isToday = key === dayKey(new Date());
              const events = byDay.get(key) ?? [];
              return (
                <div key={i} className={"bg-background min-h-[92px] p-1 " + (inMonth ? "" : "opacity-40")}>
                  <div className={"text-xs mb-0.5 " + (isToday ? "font-bold text-primary" : "text-muted-foreground")}>{d.getDate()}</div>
                  {events.slice(0, 3).map(eventChip)}
                  {events.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{events.length - 3} autres</div>}
                </div>
              );
            })}
          </div>

          {undated.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold mb-2">Date à définir <span className="text-muted-foreground font-normal">· {undated.length}</span></h3>
              <div className="space-y-2">{undated.map(renderRow)}</div>
            </div>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default MatchCalendar;
