import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { UserRound, ArrowLeft, BarChart3, Trophy } from "lucide-react";
import type { Match, Team } from "@shared/schema";

type MatchStat = {
  playerId: string; pseudo: string; teamId: string;
  kills: number; deaths: number; damage: number; goals: number; assists: number;
  starPlayer: boolean; notePerf: number; impact: number; noteFinale: number;
};

const STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: "À venir", className: "bg-muted text-muted-foreground" },
  live: { label: "En direct", className: "bg-destructive text-destructive-foreground border-transparent" },
  completed: { label: "Terminé", className: "bg-primary/15 text-primary border-primary/25" },
  cancelled: { label: "Annulé", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
};

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: match, isLoading: matchLoading } = useQuery<Match>({
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
  const st = STATUS[match?.status ?? "upcoming"] ?? STATUS.upcoming;
  const hasScore = match?.scoreHome != null && match?.scoreAway != null;
  const homeWon = done && match?.winnerId != null && match.winnerId === match.teamHomeId;
  const awayWon = done && match?.winnerId != null && match.winnerId === match.teamAwayId;
  const nameCls = (won: boolean, lost: boolean) =>
    won ? "text-primary" : lost ? "text-muted-foreground" : "";

  return (
    <div className="w-full px-6 py-8">
      <Link href="/calendrier" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Calendrier
      </Link>

      {matchLoading ? (
        <Skeleton className="mb-8 h-28 w-full" />
      ) : match ? (
        <Card className="mb-8 animate-fade-in-up overflow-hidden p-6">
          <div className="mb-3 flex justify-center">
            <Badge variant="outline" className={st.className}>{st.label}</Badge>
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className={`flex-1 text-right text-lg font-bold sm:text-xl ${nameCls(!!homeWon, !!awayWon)}`}>
              {homeWon && <Trophy className="mr-1 inline h-4 w-4 align-[-2px] text-primary" />}
              {teamName(match.teamHomeId)}
            </span>
            <span className="shrink-0 rounded-md bg-muted px-4 py-1 font-mono text-2xl">
              {hasScore ? `${match.scoreHome} – ${match.scoreAway}` : done ? "—" : "vs"}
            </span>
            <span className={`flex-1 text-lg font-bold sm:text-xl ${nameCls(!!awayWon, !!homeWon)}`}>
              {teamName(match.teamAwayId)}
              {awayWon && <Trophy className="ml-1 inline h-4 w-4 align-[-2px] text-primary" />}
            </span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {match.gameMode ? `${match.gameMode} · ` : ""}
            {match.datetime ? new Date(match.datetime).toLocaleDateString("fr-FR") : ""}
          </p>
        </Card>
      ) : null}

      {(stats ?? []).length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Aucune statistique enregistrée"
          description="Les statistiques par joueur de ce match apparaîtront ici une fois saisies."
        />
      ) : (
        <div className="grid animate-fade-in-up animate-delay-100 grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map(([teamId, list]) => (
            <div key={teamId}>
              <h2 className="mb-2 font-semibold">{teamName(teamId)}</h2>
              <Card className="p-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-right text-xs text-muted-foreground">
                        <th className="py-1.5 pl-1 text-left">Joueur</th>
                        <th className="px-1.5">K</th><th className="px-1.5">D</th>
                        <th className="px-1.5">Dég.</th><th className="px-1.5">Perf</th>
                        <th className="px-1.5">Imp.</th><th className="px-1.5">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.sort((a, b) => b.noteFinale - a.noteFinale).map((s) => (
                        <tr key={s.playerId} className="border-b text-right last:border-0">
                          <td className="py-1.5 pl-1 text-left">
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
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchDetailPage;
