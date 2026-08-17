import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trophy, LayoutGrid, Swords, X } from "lucide-react";
import { PlayerPoules } from "@/components/player-poules";
import { MatchVisualView } from "@/components/match-visual";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null; gameMode: string | null; map: string | null; mapHidden: boolean; datetime: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

const splitBans = (s: string | null | undefined): string[] => (s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);

/** Vue publique d'un tournoi à équipes aléatoires : affrontements (+ poules) et classement, en onglets. */
export function RandomPhase({ competitionId }: { competitionId: string }) {
  const [tab, setTab] = useState<"matchs" | "classement">("matchs");
  const [detail, setDetail] = useState<{ m: MatchView; bans: string[] } | null>(null);

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
              <div className="flex flex-wrap gap-3">
                {r.matches.map((m) => (
                  <MatchVisualView key={m.id} className="w-[300px]"
                    mapName={m.map} modeName={m.gameMode} mapHidden={m.mapHidden}
                    a={{ name: "Équipe A", players: m.teamA, won: m.winner === "a" }}
                    b={{ name: "Équipe B", players: m.teamB, won: m.winner === "b" }}
                    score={m.winner ? { a: m.scoreA, b: m.scoreB } : null}
                    bans={splitBans(r.bans)}
                    onExpand={() => setDetail({ m, bans: splitBans(r.bans) })}
                  />
                ))}
                {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement.</p>}
              </div>
            </div>
          ))}
          {(rounds ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun tour pour l'instant.</p>}
        </div>
      ) : (
        <Leaderboard board={board ?? []} />
      )}

      {detail && <DetailModal m={detail.m} bans={detail.bans} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailModal({ m, bans, onClose }: { m: MatchView; bans: string[]; onClose: () => void }) {
  const done = !!m.winner;
  const sub = m.datetime ? new Date(m.datetime).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 h-8 w-8 rounded-full bg-card border flex items-center justify-center hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
        <MatchVisualView
          large
          mapName={m.map}
          modeName={m.gameMode}
          mapHidden={m.mapHidden}
          a={{ name: "Équipe A", players: m.teamA, won: m.winner === "a" }}
          b={{ name: "Équipe B", players: m.teamB, won: m.winner === "b" }}
          score={done ? { a: m.scoreA, b: m.scoreB } : null}
          bans={bans}
          subtitle={sub}
          className="w-[460px] max-w-[94vw] shadow-2xl"
        />
      </div>
    </div>
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
