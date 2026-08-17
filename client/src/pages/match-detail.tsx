import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { UserRound, ArrowLeft } from "lucide-react";
import { MetaBadges } from "@/lib/bs-catalog";
import type { Match, Team } from "@shared/schema";

type MatchStat = {
  playerId: string; pseudo: string; teamId: string;
  kills: number; deaths: number; damage: number; goals: number; assists: number;
  starPlayer: boolean; notePerf: number; impact: number; noteFinale: number;
};

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: match } = useQuery<Match>({
    queryKey: ["/api/matches", id, "one"],
    queryFn: async () => (await apiRequest("GET", `/api/matches/${id}`)).json(),
  });
  const { data: stats } = useQuery<MatchStat[]>({
    queryKey: ["/api/matches", id, "stats"],
    queryFn: async () => (await apiRequest("GET", `/api/matches/${id}/stats`)).json(),
  });
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", match?.competitionId],
    enabled: !!match?.competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${match!.competitionId}`)).json(),
  });

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return (tid: string | null) => (tid ? m.get(tid) ?? "?" : "?");
  }, [teams]);

  const groups = useMemo(() => {
    const m = new Map<string, MatchStat[]>();
    for (const s of stats ?? []) {
      if (!m.has(s.teamId)) m.set(s.teamId, []);
      m.get(s.teamId)!.push(s);
    }
    return Array.from(m.entries());
  }, [stats]);

  const done = match?.status === "completed";

  return (
    <div className="w-full px-6 py-8">
      <Link href="/calendrier" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Calendrier
      </Link>

      {match && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="font-bold text-lg text-right flex-1">{teamName(match.teamHomeId)}</span>
          <span className="font-mono text-xl px-3">{done ? `${match.scoreHome ?? 0} – ${match.scoreAway ?? 0}` : "vs"}</span>
          <span className="font-bold text-lg flex-1">{teamName(match.teamAwayId)}</span>
        </div>
      )}
      {match && (
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          <MetaBadges gameMode={match.gameMode} map={match.map} />
          {match.datetime && <span className="text-xs text-muted-foreground">{new Date(match.datetime).toLocaleDateString("fr-FR")}</span>}
        </div>
      )}

      {(stats ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune statistique enregistrée pour ce match.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map(([teamId, list]) => (
            <div key={teamId}>
              <h2 className="font-semibold mb-2">{teamName(teamId)}</h2>
              <Card className="p-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-right border-b">
                      <th className="text-left py-1.5 pl-1">Joueur</th>
                      <th className="px-1.5">K</th><th className="px-1.5">D</th>
                      <th className="px-1.5">Dég.</th><th className="px-1.5">Perf</th>
                      <th className="px-1.5">Imp.</th><th className="px-1.5">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.sort((a, b) => b.noteFinale - a.noteFinale).map((s) => (
                      <tr key={s.playerId} className="border-b last:border-0 text-right">
                        <td className="text-left py-1.5 pl-1">
                          <Link href={`/joueurs/${s.playerId}`} className="inline-flex items-center gap-1.5 hover:underline">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            {s.pseudo}{s.starPlayer ? " ⭐" : ""}
                          </Link>
                        </td>
                        <td className="px-1.5">{s.kills}</td>
                        <td className="px-1.5">{s.deaths}</td>
                        <td className="px-1.5">{s.damage.toLocaleString("fr-FR")}</td>
                        <td className="px-1.5">{s.notePerf.toFixed(1)}</td>
                        <td className="px-1.5">{s.impact.toFixed(1)}</td>
                        <td className="px-1.5 font-semibold">{s.noteFinale.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchDetailPage;
