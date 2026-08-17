import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { UserRound } from "lucide-react";
import type { Team, Match } from "@shared/schema";

type Row = { team: Team; j: number; v: number; n: number; d: number; bp: number; bc: number; pts: number };
type RosterMember = { playerId: string; pseudo: string; avatarUrl: string | null; isCaptain: boolean | null };

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
    if (m.winnerId === m.teamHomeId) { h.v++; h.pts += 3; a.d++; }
    else if (m.winnerId === m.teamAwayId) { a.v++; a.pts += 3; h.d++; }
    else if (sh > sa) { h.v++; h.pts += 3; a.d++; }
    else if (sh < sa) { a.v++; a.pts += 3; h.d++; }
    else { h.n++; a.n++; h.pts++; a.pts++; }
  }
  return Array.from(rec.values()).sort(
    (x, y) => y.pts - x.pts || (y.bp - y.bc) - (x.bp - x.bc) || y.v - x.v || x.team.name.localeCompare(y.team.name),
  );
}

/**
 * Phase de poules : chaque poule (regroupement d'équipes, champ pool_label)
 * affiche son classement round-robin ET la composition de chaque équipe
 * (joueurs), pour qu'on voie clairement qui est dans quelle poule.
 */
export function CompetitionGroups({ teams, matches }: { teams: Team[]; matches: Match[] }) {
  const poules = useMemo(() => {
    const by = new Map<string, Team[]>();
    for (const t of teams) {
      const key = (t.poolLabel ?? "").trim();
      if (!key) continue;
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(t);
    }
    return Array.from(by.entries())
      .map(([label, list]) => ({ label, teams: list }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
  }, [teams]);

  const unassigned = useMemo(() => teams.filter((t) => !(t.poolLabel ?? "").trim()), [teams]);

  if (poules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune poule définie. Un admin peut affecter chaque équipe à une poule dans la gestion de la compétition (onglet Équipes).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {poules.map((p) => (
        <PouleCard key={p.label} label={p.label} teams={p.teams} matches={matches} />
      ))}
      {unassigned.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sans poule : {unassigned.map((t) => t.name).join(", ")}
        </p>
      )}
    </div>
  );
}

function PouleCard({ label, teams, matches }: { label: string; teams: Team[]; matches: Match[] }) {
  const rows = standings(teams, matches);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">Poule {label}</span>
        <span className="text-xs text-muted-foreground">{teams.length} équipes</span>
      </div>

      {/* Classement de la poule */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium py-1.5 pl-2 w-8">#</th>
              <th className="text-left font-medium py-1.5">Équipe</th>
              <th className="text-center font-medium py-1.5 w-10">J</th>
              <th className="text-center font-medium py-1.5 w-10">V</th>
              <th className="text-center font-medium py-1.5 w-10">N</th>
              <th className="text-center font-medium py-1.5 w-10">D</th>
              <th className="text-center font-medium py-1.5 w-14">Diff</th>
              <th className="text-center font-medium py-1.5 w-12 pr-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team.id} className="border-b last:border-0">
                <td className="py-1.5 pl-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 font-medium truncate">
                  <Link href={`/equipes/${r.team.id}`} className="hover:text-primary hover:underline">{r.team.name}</Link>
                </td>
                <td className="py-1.5 text-center tabular-nums">{r.j}</td>
                <td className="py-1.5 text-center tabular-nums">{r.v}</td>
                <td className="py-1.5 text-center tabular-nums">{r.n}</td>
                <td className="py-1.5 text-center tabular-nums">{r.d}</td>
                <td className="py-1.5 text-center tabular-nums text-muted-foreground">{r.bp - r.bc > 0 ? "+" : ""}{r.bp - r.bc}</td>
                <td className="py-1.5 text-center font-bold tabular-nums pr-2">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Composition : équipes et leurs joueurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teams.map((t) => <PouleTeam key={t.id} team={t} />)}
      </div>
    </Card>
  );
}

function PouleTeam({ team }: { team: Team }) {
  const { data: roster } = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", team.id, "roster"],
    queryFn: async () => (await apiRequest("GET", `/api/teams/${team.id}/roster`)).json(),
  });
  return (
    <div className="border rounded-lg p-2.5">
      <Link href={`/equipes/${team.id}`} className="flex items-center gap-2 mb-2 group w-fit">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="h-6 w-6 rounded object-cover" />
        ) : null}
        <span className="font-semibold text-sm group-hover:text-primary">{team.name}</span>
        <span className="text-xs text-muted-foreground">[{team.tag}]</span>
      </Link>
      <div className="flex flex-wrap gap-2">
        {(roster ?? []).map((m) => (
          <Link key={m.playerId} href={`/joueurs/${m.playerId}`} className="flex items-center gap-1.5 group">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-6 w-6 rounded object-cover bg-muted ring-1 ring-border" />
            ) : (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center ring-1 ring-border"><UserRound className="h-3.5 w-3.5 text-muted-foreground" /></div>
            )}
            <span className="text-xs group-hover:text-primary">{m.pseudo}</span>
          </Link>
        ))}
        {(roster ?? []).length === 0 && <span className="text-xs text-muted-foreground">Effectif vide.</span>}
      </div>
    </div>
  );
}

export default CompetitionGroups;
