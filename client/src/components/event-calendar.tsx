import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";

export type CalEvent = {
  id: string;
  datetime: string | null;
  status: string;   // upcoming | live | completed | cancelled → couleur
  chip: string;     // libellé court pour la case du mois (heure incluse si voulu)
  href?: string;    // cible au clic (chip + agenda)
  card: ReactNode;  // grande carte pour la vue liste
};

const STATUS: Record<string, string> = {
  upcoming: "#8B93A7", live: "#E23B3B", completed: "#2E7D32", cancelled: "#B45309",
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

/**
 * Calendrier générique : vue « Calendrier » (grille mensuelle) et « Liste »
 * (agenda groupé par date). Agnostique du type d'événement — chaque événement
 * fournit son libellé court (chip) et sa grande carte.
 */
export function EventCalendar({ events, emptyLabel = "Aucun événement." }: { events: CalEvent[]; emptyLabel?: string }) {
  const [view, setView] = useState<"calendrier" | "liste">("calendrier");
  const [cursor, setCursor] = useState<Date | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (cursor || events.length === 0) return;
    const now = Date.now();
    const dated = events.filter((e) => e.datetime).map((e) => new Date(e.datetime as string));
    if (dated.length === 0) { setCursor(new Date()); return; }
    const up = dated.filter((d) => d.getTime() >= now).sort((a, b) => a.getTime() - b.getTime());
    const base = up[0] ?? [...dated].sort((a, b) => b.getTime() - a.getTime())[0];
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [events, cursor]);

  const byDay = useMemo(() => {
    const g = new Map<string, CalEvent[]>();
    for (const e of events) { const k = dayKey(e.datetime); if (!g.has(k)) g.set(k, []); g.get(k)!.push(e); }
    for (const list of Array.from(g.values()))
      list.sort((a, b) => (a.datetime ? new Date(a.datetime).getTime() : 0) - (b.datetime ? new Date(b.datetime).getTime() : 0));
    return g;
  }, [events]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: CalEvent[] = [], pa: CalEvent[] = [];
    for (const e of events) {
      const isPast = e.status === "completed" || e.status === "cancelled" || (e.datetime ? new Date(e.datetime).getTime() < now - DAY_MS : true);
      (isPast ? pa : up).push(e);
    }
    const ts = (e: CalEvent) => (e.datetime ? new Date(e.datetime).getTime() : 0);
    const groupBy = (list: CalEvent[], dir: 1 | -1) => {
      const g = new Map<string, CalEvent[]>();
      for (const e of list) { const k = dayKey(e.datetime); if (!g.has(k)) g.set(k, []); g.get(k)!.push(e); }
      // Tri chronologique au sein d'un jour, dans le même sens que les jours.
      for (const items of Array.from(g.values())) items.sort((a, b) => dir * (ts(a) - ts(b)));
      // Jours sans date (clé "0000-00-00") toujours en dernier.
      const rank = (k: string) => (k === "0000-00-00" ? Infinity : 0);
      return Array.from(g.entries()).sort((a, b) => rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -dir : a[0] > b[0] ? dir : 0));
    };
    return { upcoming: groupBy(up, 1), past: groupBy(pa, -1) };
  }, [events]);

  const month = cursor ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const undated = byDay.get("0000-00-00") ?? [];

  const eventChip = (e: CalEvent) => (
    <button key={e.id} onClick={() => e.href && navigate(e.href)} title={e.chip}
      className="w-full text-left text-[11px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 text-white hover:opacity-90"
      style={{ backgroundColor: STATUS[e.status] ?? STATUS.upcoming, cursor: e.href ? "pointer" : "default" }}>
      {e.chip}
    </button>
  );

  const renderAgenda = (groups: [string, CalEvent[]][]) =>
    groups.map(([key, list]) => (
      <div key={key} className="mb-6">
        <div className="text-sm font-semibold text-primary capitalize mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> {dayLabel(key)} <span className="text-muted-foreground font-normal">· {list.length}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {list.map((e) => <div key={e.id}>{e.card}</div>)}
        </div>
      </div>
    ));

  if (events.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

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
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-semibold capitalize min-w-[10rem] text-center">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Aujourd'hui</Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border border rounded-lg overflow-hidden">
            {WEEKDAYS.map((d) => <div key={d} className="bg-muted/50 text-center text-xs font-medium py-1.5 capitalize">{d}</div>)}
            {monthCells.map((d, i) => {
              const inMonth = d.getMonth() === month.getMonth();
              const key = dayKey(d);
              const isToday = key === dayKey(new Date());
              const evs = byDay.get(key) ?? [];
              return (
                <div key={i} className={"bg-background min-h-[92px] p-1 " + (inMonth ? "" : "opacity-40")}>
                  <div className={"text-xs mb-0.5 " + (isToday ? "font-bold text-primary" : "text-muted-foreground")}>{d.getDate()}</div>
                  {evs.slice(0, 3).map(eventChip)}
                  {evs.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{evs.length - 3} autres</div>}
                </div>
              );
            })}
          </div>

          {undated.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold mb-2">Date à définir <span className="text-muted-foreground font-normal">· {undated.length}</span></h3>
              <div className="flex gap-3 overflow-x-auto pb-2">{undated.map((e) => <div key={e.id}>{e.card}</div>)}</div>
            </div>
          )}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && <section className="mb-8"><h2 className="font-semibold mb-3">À venir</h2>{renderAgenda(upcoming)}</section>}
          {past.length > 0 && <section><h2 className="font-semibold mb-3">Résultats & matchs passés</h2>{renderAgenda(past)}</section>}
        </>
      )}
    </div>
  );
}

export default EventCalendar;
