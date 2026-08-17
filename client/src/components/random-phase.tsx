import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Trophy, LayoutGrid, Swords, UserRound } from "lucide-react";
import { PlayerPoules } from "@/components/player-poules";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null; gameMode: string | null; map: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

/** Vue publique d'un tournoi à équipes aléatoires : affrontements (+ poules) et classement, en onglets. */
export function RandomPhase({ competitionId }: { competitionId: string }) {
  const [tab, setTab] = useState<"matchs" | "classement">("matchs");
  const { data: rounds } = useQuery<RoundView[]>({
    queryKey: ["/api/random", competitionId, "rounds"],
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/rounds`)).json(),
  });
  const { data: board } = useQuery<LeaderRow[]>({
    queryKey: ["/api/random", competitionId, "leaderboard"],
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/leaderboard`)).json(),
  });
  const { data: participants } = useQuery<PoolPlayer[]>({
    queryKey: ["/api/random", competitionId, "participants"],
    queryFn: async () => (await apiRequest("GET", `/api/random/${competitionId}/participants`)).json(),
  });
  const hasPoules = (participants ?? []).some((p) => (p.poolLabel ?? "").trim());

  const TABS = [
    { key: "matchs" as const, label: "Affrontements", icon: Swords },
    { key: "classement" as const, label: "Classement", icon: Trophy },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "matchs" ? (
        <div className="space-y-8">
          {hasPoules && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" /> Poules</h3>
              <PlayerPoules entrants={participants ?? []} records={board ?? []} />
            </div>
          )}

          {[...(rounds ?? [])].reverse().map((r) => (
            <div key={r.id}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold">Tour {r.roundNumber}</h3>
                {r.gameMode && <span className="text-xs bg-muted rounded px-2 py-0.5">{r.gameMode}</span>}
                {r.bans && <span className="text-xs text-muted-foreground">Bans : {r.bans}</span>}
              </div>
              <div className="space-y-2">
                {r.matches.map((m) => <PublicMatch key={m.id} m={m} />)}
                {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement.</p>}
              </div>
            </div>
          ))}
          {(rounds ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun tour pour l'instant.</p>}
        </div>
      ) : (
        <Leaderboard board={board ?? []} />
      )}
    </div>
  );
}

function Side({ players, accent, won }: { players: PoolPlayer[]; accent: string; won: boolean }) {
  return (
    <div className={"flex-1 min-w-[9rem] rounded-lg border p-2 " + (won ? "ring-2" : "")} style={won ? { borderColor: accent } : undefined}>
      <div className="flex flex-col gap-1">
        {players.map((p) => (
          <Link key={p.playerId} href={`/joueurs/${p.playerId}`} className="flex items-center gap-1.5 group">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.pseudo} className="h-6 w-6 rounded object-cover bg-muted ring-1 ring-border shrink-0" />
            ) : (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center ring-1 ring-border shrink-0"><UserRound className="h-3.5 w-3.5 text-muted-foreground" /></div>
            )}
            <span className="text-sm truncate group-hover:text-primary">{p.pseudo}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PublicMatch({ m }: { m: MatchView }) {
  const done = !!m.winner;
  return (
    <Card className="p-3">
      {(m.gameMode || m.map) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {m.gameMode && <span className="px-1.5 py-0.5 rounded bg-muted">{m.gameMode}</span>}
          {m.map && <span className="px-1.5 py-0.5 rounded bg-muted">{m.map}</span>}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <Side players={m.teamA} accent="#3BA7E2" won={m.winner === "a"} />
        <div className="flex flex-col items-center justify-center shrink-0 px-1">
          <span className="font-mono text-sm">{done ? `${m.scoreA} – ${m.scoreB}` : "vs"}</span>
        </div>
        <Side players={m.teamB} accent="#E2683B" won={m.winner === "b"} />
      </div>
    </Card>
  );
}

function Leaderboard({ board }: { board: LeaderRow[] }) {
  if (board.length === 0) return <p className="text-sm text-muted-foreground">Aucun résultat pour l'instant.</p>;
  return (
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
          {board.map((r, i) => (
            <tr key={r.playerId} className="border-b last:border-0 hover:bg-muted/40">
              <td className="py-2 pl-2 text-muted-foreground">{i + 1}</td>
              <td className="py-2 font-medium">
                <Link href={`/joueurs/${r.playerId}`} className="hover:text-primary hover:underline">{r.pseudo}</Link>
              </td>
              <td className="py-2 text-center tabular-nums">{r.wins}</td>
              <td className="py-2 text-center tabular-nums">{r.losses}</td>
              <td className="py-2 text-center tabular-nums text-muted-foreground">{r.gamesWon}–{r.gamesLost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RandomPhase;
