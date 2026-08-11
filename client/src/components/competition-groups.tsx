import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { List, LayoutGrid, ChevronLeft } from "lucide-react";
import type { Team, Match, Conference } from "@shared/schema";

type Row = { team: Team; j: number; v: number; n: number; d: number; bp: number; bc: number; pts: number };

function standings(teamsInPoule: Team[], matches: Match[]): Row[] {
  const ids = new Set(teamsInPoule.map((t) => t.id));
  const rec = new Map<string, Row>();
  for (const t of teamsInPoule) rec.set(t.id, { team: t, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, pts: 0 });
  for (const m of matches) {
    if (m.status !== "completed" || !m.teamHomeId || !m.teamAwayId) continue;
    if (!ids.has(m.teamHomeId) || !ids.has(m.teamAwayId)) continue;
    const h = rec.get(m.teamHomeId);
    const a = rec.get(m.teamAwayId);
    if (!h || !a) continue;
    const sh = m.scoreHome ?? 0;
    const sa = m.scoreAway ?? 0;
    h.j++; a.j++; h.bp += sh; h.bc += sa; a.bp += sa; a.bc += sh;
    if (sh > sa) { h.v++; h.pts += 3; a.d++; }
    else if (sh < sa) { a.v++; a.pts += 3; h.d++; }
    else { h.n++; a.n++; h.pts++; a.pts++; }
  }
  return Array.from(rec.values()).sort(
    (x, y) => y.pts - x.pts || (y.bp - y.bc) - (x.bp - x.bc) || y.v - x.v || x.team.name.localeCompare(y.team.name),
  );
}

/**
 * Phase de poules : liste des poules (= conférences ayant des équipes dans la
 * compétition) ; en cliquant sur une poule, sa grille de classement (V/N/D +
 * points), avec bascule vers la liste des matchs de la poule.
 */
export function CompetitionGroups({
  conferences,
  teams,
  matches,
}: {
  conferences: Conference[];
  teams: Team[];
  matches: Match[];
}) {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"grille" | "liste">("grille");

  const poules = useMemo(() => {
    const byConf = new Map<string, Team[]>();
    for (const t of teams) {
      if (!t.conferenceId) continue;
      if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
      byConf.get(t.conferenceId)!.push(t);
    }
    const nameOf = new Map(conferences.map((c) => [c.id, c]));
    return Array.from(byConf.entries()).map(([id, list]) => ({
      id,
      conf: nameOf.get(id) ?? null,
      teams: list,
    }));
  }, [teams, conferences]);

  const teamName = useMemo(() => {
    const m = new Map(teams.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);

  if (poules.length === 0) {
    return <p className="text-sm text-muted-foreground">Pas de poules pour cette compétition.</p>;
  }

  // Vue « liste des poules »
  if (!selected) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {poules.map((p) => (
          <Card
            key={p.id}
            className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => { setSelected(p.id); setView("grille"); }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: p.conf?.color ?? "#888" }} />
              <span className="font-semibold">{p.conf?.name ?? "Poule"}</span>
              <span className="text-xs text-muted-foreground ml-auto">{p.teams.length} équipes</span>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const poule = poules.find((p) => p.id === selected);
  if (!poule) return null;
  const rows = standings(poule.teams, matches);
  const ids = new Set(poule.teams.map((t) => t.id));
  const pouleMatches = matches.filter(
    (m) => m.teamHomeId && m.teamAwayId && ids.has(m.teamHomeId) && ids.has(m.teamAwayId),
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Poules
        </Button>
        <span className="font-semibold flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: poule.conf?.color ?? "#888" }} />
          {poule.conf?.name ?? "Poule"}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === "grille" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("grille")}>
            <LayoutGrid className="h-4 w-4 mr-1" /> Classement
          </Button>
          <Button variant={view === "liste" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("liste")}>
            <List className="h-4 w-4 mr-1" /> Matchs
          </Button>
        </div>
      </div>

      {view === "grille" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left font-medium py-2 pl-2 w-8">#</th>
                <th className="text-left font-medium py-2">Équipe</th>
                <th className="text-center font-medium py-2 w-10">J</th>
                <th className="text-center font-medium py-2 w-10">V</th>
                <th className="text-center font-medium py-2 w-10">N</th>
                <th className="text-center font-medium py-2 w-10">D</th>
                <th className="text-center font-medium py-2 w-14">Diff</th>
                <th className="text-center font-medium py-2 w-12 pr-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pl-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium truncate">{r.team.name}</td>
                  <td className="py-2 text-center tabular-nums">{r.j}</td>
                  <td className="py-2 text-center tabular-nums">{r.v}</td>
                  <td className="py-2 text-center tabular-nums">{r.n}</td>
                  <td className="py-2 text-center tabular-nums">{r.d}</td>
                  <td className="py-2 text-center tabular-nums text-muted-foreground">{r.bp - r.bc > 0 ? "+" : ""}{r.bp - r.bc}</td>
                  <td className="py-2 text-center font-bold tabular-nums pr-2">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground mt-2">Victoire = 3 pts · Nul = 1 pt · Défaite = 0.</p>
        </div>
      ) : pouleMatches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun match dans cette poule.</p>
      ) : (
        <div className="space-y-2">
          {pouleMatches.map((m) => {
            const done = m.status === "completed";
            return (
              <Card key={m.id} onClick={() => navigate(`/matchs/${m.id}`)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
                <span className="font-medium truncate text-right flex-1">{teamName(m.teamHomeId)}</span>
                <span className="font-mono text-sm shrink-0">{done ? `${m.scoreHome ?? 0} – ${m.scoreAway ?? 0}` : "vs"}</span>
                <span className="font-medium truncate flex-1">{teamName(m.teamAwayId)}</span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CompetitionGroups;
