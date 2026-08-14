import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

/** Vue publique d'un tournoi à équipes aléatoires : classement individuel + tours. */
export function RandomPhase({ competitionId }: { competitionId: string }) {
  const { data: rounds } = useQuery<RoundView[]>({
    queryKey: ["/api/random", competitionId, "rounds"],
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/rounds`)).json(),
  });
  const { data: board } = useQuery<LeaderRow[]>({
    queryKey: ["/api/random", competitionId, "leaderboard"],
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/leaderboard`)).json(),
  });

  const names = (t: PoolPlayer[]) => t.map((p) => p.pseudo).join(" · ");

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Classement individuel</h3>
        {(board ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun résultat pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 pl-2 w-8">#</th><th className="text-left py-2">Joueur</th>
                  <th className="text-center py-2 w-12">V</th><th className="text-center py-2 w-12">D</th>
                  <th className="text-center py-2 w-20">Manches</th>
                </tr>
              </thead>
              <tbody>
                {(board ?? []).map((r, i) => (
                  <tr key={r.playerId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pl-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium">{r.pseudo}</td>
                    <td className="py-2 text-center tabular-nums">{r.wins}</td>
                    <td className="py-2 text-center tabular-nums">{r.losses}</td>
                    <td className="py-2 text-center tabular-nums text-muted-foreground">{r.gamesWon}–{r.gamesLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {[...(rounds ?? [])].reverse().map((r) => (
        <div key={r.id}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold">Tour {r.roundNumber}</h3>
            {r.gameMode && <span className="text-xs bg-muted rounded px-2 py-0.5">{r.gameMode}</span>}
            {r.bans && <span className="text-xs text-muted-foreground">Bans : {r.bans}</span>}
          </div>
          <div className="space-y-2">
            {r.matches.map((m) => {
              const done = !!m.winner;
              return (
                <Card key={m.id} className="flex items-center gap-3 p-3">
                  <span className={"flex-1 text-sm text-right truncate " + (m.winner === "a" ? "font-bold" : "")}>{names(m.teamA)}</span>
                  <span className="font-mono text-sm shrink-0">{done ? `${m.scoreA} – ${m.scoreB}` : "vs"}</span>
                  <span className={"flex-1 text-sm truncate " + (m.winner === "b" ? "font-bold" : "")}>{names(m.teamB)}</span>
                </Card>
              );
            })}
            {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default RandomPhase;
