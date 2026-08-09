import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, Trophy } from "lucide-react";
import type { Match } from "@shared/schema";

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: "À venir", className: "bg-muted text-muted-foreground" },
  live: { label: "En direct", className: "bg-destructive text-destructive-foreground border-transparent" },
  completed: { label: "Terminé", className: "bg-primary/15 text-primary border-primary/25" },
  cancelled: { label: "Annulé", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
};

type TeamName = (id: string | null) => string;

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function latestMatchDate(matches: Match[]): Date | null {
  let latest: number | null = null;
  for (const m of matches) {
    if (!m.datetime) continue;
    const t = new Date(m.datetime).getTime();
    if (latest === null || t > latest) latest = t;
  }
  return latest === null ? null : new Date(latest);
}

/**
 * Vue calendrier (grille mensuelle) des matchs d'une compétition — reprise du
 * design leaguebs : cellules avec les rencontres du jour, jour courant en pastille
 * dorée, et un pop-up (Dialog) listant les matchs du jour au clic. Reste au clic
 * d'un match → sa fiche.
 */
export function MatchCalendar({ matches, teamName }: { matches: Match[]; teamName: TeamName }) {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = latestMatchDate(matches) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<{ label: string; list: Match[] } | null>(null);
  const [, navigate] = useLocation();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const byDay = useMemo(() => {
    const m = new Map<string, Match[]>();
    for (const mt of matches) {
      if (!mt.datetime) continue;
      const k = keyOf(new Date(mt.datetime));
      const arr = m.get(k);
      if (arr) arr.push(mt);
      else m.set(k, [mt]);
    }
    m.forEach((arr) => {
      arr.sort((a, b) => new Date(a.datetime ?? 0).getTime() - new Date(b.datetime ?? 0).getTime());
    });
    return m;
  }, [matches]);

  const cells = useMemo(() => {
    const startDay = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const out: { day: number; current: boolean; date: Date }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      out.push({ day: prevDays - i, current: false, date: new Date(year, month - 1, prevDays - i) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, current: true, date: new Date(year, month, d) });
    }
    let n = 1;
    while (out.length < 42) out.push({ day: n, current: false, date: new Date(year, month + 1, n++) });
    return out;
  }, [year, month]);

  const now = new Date();
  const isToday = (d: Date) =>
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  return (
    <div className="animate-fade-in-up animate-delay-100">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Mois précédent" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="min-w-[150px] text-center text-lg font-semibold capitalize">{MONTHS[month]} {year}</span>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
            Aujourd'hui
          </Button>
        </div>
        <Button variant="outline" size="icon" aria-label="Mois suivant" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DOW.map((d) => (
            <div key={d} className="border-r border-border p-2 text-center text-xs font-semibold uppercase text-muted-foreground last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const list = c.current ? byDay.get(keyOf(c.date)) ?? [] : [];
            const weekend = i % 7 >= 5;
            const clickable = list.length > 0;
            return (
              <div
                key={i}
                onClick={clickable ? () => setSelected({ label: `${c.day} ${MONTHS[month]} ${year}`, list }) : undefined}
                className={[
                  "min-h-[110px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                  c.current ? "" : "bg-muted/20",
                  weekend && c.current ? "bg-muted/10" : "",
                  clickable ? "cursor-pointer hover-elevate" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    !c.current ? "text-muted-foreground/40" : isToday(c.date) ? "bg-primary text-primary-foreground" : weekend ? "text-primary" : "text-foreground",
                  ].join(" ")}
                >
                  {c.day}
                </span>
                <div className="mt-1 space-y-1">
                  {list.slice(0, 2).map((m) => <MatchChip key={m.id} m={m} teamName={teamName} />)}
                  {list.length > 2 && (
                    <div className="px-1 text-[11px] text-muted-foreground">+{list.length - 2} match…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 capitalize">
              <CalendarDays className="h-5 w-5 text-primary" /> {selected?.label}
              <span className="text-sm font-normal text-muted-foreground">· {selected?.list.length}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {selected?.list.map((m) => (
              <DayMatchRow
                key={m.id}
                m={m}
                teamName={teamName}
                onClick={() => { setSelected(null); navigate(`/matchs/${m.id}`); }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchChip({ m, teamName }: { m: Match; teamName: TeamName }) {
  const done = m.status === "completed";
  const time = m.datetime
    ? new Date(m.datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className={`truncate rounded-md border px-1.5 py-0.5 text-[11px] ${done ? "border-border bg-muted/50" : "border-primary/25 bg-primary/15"}`}>
      {time && <span className={done ? "text-muted-foreground" : "text-primary"}>{time} </span>}
      <span className="font-medium">{teamName(m.teamHomeId)}</span>
      <span className="text-muted-foreground"> · </span>
      <span className="font-medium">{teamName(m.teamAwayId)}</span>
    </div>
  );
}

function DayMatchRow({ m, teamName, onClick }: { m: Match; teamName: TeamName; onClick: () => void }) {
  const st = STATUS[m.status ?? "upcoming"] ?? STATUS.upcoming;
  const done = m.status === "completed";
  const hasScore = m.scoreHome != null && m.scoreAway != null;
  const homeWon = done && m.winnerId != null && m.winnerId === m.teamHomeId;
  const awayWon = done && m.winnerId != null && m.winnerId === m.teamAwayId;
  const nameCls = (won: boolean, lost: boolean) =>
    won ? "font-semibold text-primary" : lost ? "text-muted-foreground" : "font-medium";
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover-elevate">
      <Badge variant="outline" className={`shrink-0 ${st.className}`}>{st.label}</Badge>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
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
      <span className="w-20 shrink-0 truncate text-right text-xs text-muted-foreground">{m.gameMode ?? ""}</span>
    </button>
  );
}

export default MatchCalendar;
