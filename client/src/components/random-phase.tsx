import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trophy, LayoutGrid, Swords, CalendarDays } from "lucide-react";
import { PlayerPoules } from "@/components/player-poules";
import { MatchVisualView } from "@/components/match-visual";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null; gameMode: string | null; map: string | null; mapHidden: boolean; datetime: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

const splitBans = (s: string | null | undefined): string[] => (s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const fmtTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Vue publique d'un tournoi à équipes aléatoires : affrontements (+ poules) et classement, en onglets. */
export function RandomPhase({ competitionId }: { competitionId: string }) {
  const [tab, setTab] = useState<"matchs" | "calendrier" | "classement">("matchs");

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
    { key: "calendrier" as const, label: "Calendrier", icon: CalendarDays },
    { key: "classement" as const, label: "Classement", icon: Trophy },
  ];

  // Affrontements datés, regroupés par jour (calendrier du tournoi).
  const allWithBans = (rounds ?? []).flatMap((r) => r.matches.map((m) => ({ m, bans: splitBans(r.bans) })));
  const dated = allWithBans.filter((x) => x.m.datetime).sort((x, y) => new Date(x.m.datetime!).getTime() - new Date(y.m.datetime!).getTime());
  const byDay = new Map<string, typeof dated>();
  for (const x of dated) { const k = dayKey(x.m.datetime!); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k)!.push(x); }
  const undatedCount = allWithBans.length - dated.length;
  // À venir d'abord (le plus proche en premier), puis les jours passés.
  const todayKey = dayKey(new Date().toISOString());
  const dayEntries = Array.from(byDay.entries());
  const orderedDays = [
    ...dayEntries.filter(([k]) => k >= todayKey).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    ...dayEntries.filter(([k]) => k < todayKey).sort((a, b) => (a[0] > b[0] ? -1 : 1)),
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
                  <MatchVisualView key={m.id} className="w-full sm:w-[340px]" expandable
                    mapName={m.map} modeName={m.gameMode} mapHidden={m.mapHidden}
                    time={m.datetime ? fmtTime(m.datetime) : null}
                    a={{ name: "Équipe A", players: m.teamA, won: m.winner === "a" }}
                    b={{ name: "Équipe B", players: m.teamB, won: m.winner === "b" }}
                    score={m.winner ? { a: m.scoreA, b: m.scoreB } : null}
                    bans={splitBans(r.bans)}
                  />
                ))}
                {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement.</p>}
              </div>
            </div>
          ))}
          {(rounds ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun tour pour l'instant.</p>}
        </div>
      ) : tab === "calendrier" ? (
        <div className="space-y-8">
          {byDay.size === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun affrontement daté. Ajoute une date sur les affrontements pour les voir ici.</p>
          ) : (
            orderedDays.map(([k, list]) => (
              <div key={k}>
                <div className="text-sm font-semibold text-primary capitalize mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> {dayLabel(list[0].m.datetime!)} <span className="text-muted-foreground font-normal">· {list.length}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {list.map(({ m, bans }) => (
                    <MatchVisualView key={m.id} className="w-full sm:w-[340px]" expandable
                      mapName={m.map} modeName={m.gameMode} mapHidden={m.mapHidden}
                      time={fmtTime(m.datetime!)}
                      a={{ name: "Équipe A", players: m.teamA, won: m.winner === "a" }}
                      b={{ name: "Équipe B", players: m.teamB, won: m.winner === "b" }}
                      score={m.winner ? { a: m.scoreA, b: m.scoreB } : null}
                      bans={bans}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
          {undatedCount > 0 && <p className="text-xs text-muted-foreground">{undatedCount} affrontement(s) sans date (visibles dans l'onglet Affrontements).</p>}
        </div>
      ) : (
        <Leaderboard board={board ?? []} />
      )}
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
