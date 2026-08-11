import { useMemo } from "react";
import type { Team, Match, Conference } from "@shared/schema";

type Row = { team: Team; j: number; v: number; n: number; d: number; bp: number; bc: number; pts: number };

/**
 * Classement de saison : bilan de chaque équipe calculé sur TOUS ses matchs
 * terminés de la compétition (inter-conférences inclus). L'affichage est groupé
 * par conférence (façon NBA), qui sert de présentation, pas de règle de format.
 */
export function CompetitionStandings({
  teams,
  matches,
  conferences,
}: {
  teams: Team[];
  matches: Match[];
  conferences: Conference[];
}) {
  const rows = useMemo(() => {
    const ids = new Set(teams.map((t) => t.id));
    const rec = new Map<string, Row>();
    for (const t of teams) rec.set(t.id, { team: t, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, pts: 0 });
    for (const m of matches) {
      if (m.status !== "completed" || !m.teamHomeId || !m.teamAwayId) continue;
      if (!ids.has(m.teamHomeId) || !ids.has(m.teamAwayId)) continue;
      const h = rec.get(m.teamHomeId);
      const a = rec.get(m.teamAwayId);
      if (!h || !a) continue;
      const sh = m.scoreHome ?? 0;
      const sa = m.scoreAway ?? 0;
      h.j++; a.j++; h.bp += sh; h.bc += sa; a.bp += sa; a.bc += sh;
      // Le vainqueur est stocké dans winnerId (les scores ne sont pas toujours renseignés).
      if (m.winnerId === m.teamHomeId) { h.v++; h.pts += 3; a.d++; }
      else if (m.winnerId === m.teamAwayId) { a.v++; a.pts += 3; h.d++; }
      else if (sh > sa) { h.v++; h.pts += 3; a.d++; }
      else if (sh < sa) { a.v++; a.pts += 3; h.d++; }
      else { h.n++; a.n++; h.pts++; a.pts++; }
    }
    return rec;
  }, [teams, matches]);

  const sortRows = (list: Row[]) =>
    [...list].sort(
      (x, y) => y.pts - x.pts || (y.bp - y.bc) - (x.bp - x.bc) || y.v - x.v || x.team.name.localeCompare(y.team.name),
    );

  const groups = useMemo(() => {
    const confMap = new Map(conferences.map((c) => [c.id, c]));
    const byConf = new Map<string, Row[]>();
    for (const r of Array.from(rows.values())) {
      const key = r.team.conferenceId ?? "__none";
      if (!byConf.has(key)) byConf.set(key, []);
      byConf.get(key)!.push(r);
    }
    const keys = Array.from(byConf.keys());
    const hasConf = keys.some((k) => k !== "__none");
    if (!hasConf) {
      return [{ id: "all", name: "Classement", color: null as string | null, rows: sortRows(byConf.get("__none") ?? []) }];
    }
    return keys
      .map((k) => {
        const conf = k === "__none" ? null : confMap.get(k) ?? null;
        return {
          id: k,
          name: conf?.name ?? (k === "__none" ? "Sans conférence" : "Conférence"),
          color: conf?.color ?? null,
          rows: sortRows(byConf.get(k) ?? []),
        };
      })
      .sort((a, b) => (a.id === "__none" ? 1 : b.id === "__none" ? -1 : a.name.localeCompare(b.name)));
  }, [rows, conferences]);

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune équipe.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.id}>
          {g.id !== "all" && (
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {g.color && <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />}
              {g.name}
            </h3>
          )}
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
                {g.rows.map((r, i) => (
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
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Victoire = 3 pts · Nul = 1 pt · Défaite = 0.</p>
    </div>
  );
}

export default CompetitionStandings;
