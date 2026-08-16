import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shuffle, X, Trophy } from "lucide-react";
import type { Player } from "@shared/schema";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };

/**
 * Panneau tournoi à équipes aléatoires : pool, tirage 3v3 par tour, classement
 * individuel. Réutilisé par « Tournoi aléatoire » et par la page de gestion.
 */
export function RandomTournamentPanel({ competitionId: cid }: { competitionId: string }) {
  const { toast } = useToast();
  const { data: allPlayers } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const get = <T,>(path: string) => ({
    queryKey: ["/api/random", cid, path],
    enabled: !!cid,
    queryFn: async (): Promise<T> => (await apiRequest("GET", `/api/random/${cid}/${path}`)).json(),
  });
  const { data: pool } = useQuery<PoolPlayer[]>(get<PoolPlayer[]>("participants"));
  const { data: rounds } = useQuery<RoundView[]>(get<RoundView[]>("rounds"));
  const { data: board } = useQuery<LeaderRow[]>(get<LeaderRow[]>("leaderboard"));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/random", cid, "participants"] });
    queryClient.invalidateQueries({ queryKey: ["/api/random", cid, "rounds"] });
    queryClient.invalidateQueries({ queryKey: ["/api/random", cid, "leaderboard"] });
  };

  const [addId, setAddId] = useState("");
  const addP = useMutation({
    mutationFn: () => apiRequest("POST", `/api/random/${cid}/participants`, { playerId: addId }),
    onSuccess: () => { setAddId(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const rmP = useMutation({
    mutationFn: (pid: string) => apiRequest("DELETE", `/api/random/${cid}/participants/${pid}`),
    onSuccess: invalidate,
  });

  const [present, setPresent] = useState<Set<string>>(new Set());
  const [gameMode, setGameMode] = useState("");
  const [bans, setBans] = useState("");
  useEffect(() => { setPresent(new Set((pool ?? []).map((p) => p.playerId))); }, [pool]);
  const toggle = (id: string) => setPresent((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const draw = useMutation({
    mutationFn: () => apiRequest("POST", `/api/random/${cid}/rounds`, { playerIds: Array.from(present), gameMode, bans }),
    onSuccess: () => { setGameMode(""); setBans(""); invalidate(); toast({ title: "Tour tiré" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const setResult = useMutation({
    mutationFn: (v: { id: string; scoreA: number; scoreB: number }) => apiRequest("PATCH", `/api/random/matches/${v.id}`, { scoreA: v.scoreA, scoreB: v.scoreB }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const poolIds = useMemo(() => new Set((pool ?? []).map((p) => p.playerId)), [pool]);
  const addable = useMemo(() => [...(allPlayers ?? [])].filter((p) => !poolIds.has(p.id)).sort((a, b) => a.pseudo.localeCompare(b.pseudo)), [allPlayers, poolIds]);

  return (
    <div>
      {/* Pool */}
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-2">Pool de joueurs ({pool?.length ?? 0})</h2>
        <div className="flex items-center gap-2 mb-3">
          <select value={addId} onChange={(e) => setAddId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">— ajouter un joueur —</option>
            {addable.map((p) => <option key={p.id} value={p.id}>{p.pseudo}</option>)}
          </select>
          <Button size="sm" disabled={!addId || addP.isPending} onClick={() => addP.mutate()}>Ajouter</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(pool ?? []).map((p) => (
            <span key={p.playerId} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
              {p.pseudo}
              <button onClick={() => rmP.mutate(p.playerId)}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      </Card>

      {/* Tirage */}
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-2">Tirer un tour</h2>
        <p className="text-xs text-muted-foreground mb-2">Coche les joueurs présents ({present.size} sélectionnés). Il faut au moins 6 présents.</p>
        <div className="flex flex-wrap gap-1.5 mb-3 max-h-40 overflow-y-auto">
          {(pool ?? []).map((p) => {
            const on = present.has(p.playerId);
            return (
              <button key={p.playerId} onClick={() => toggle(p.playerId)}
                className={"text-xs px-2 py-1 rounded " + (on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {p.pseudo}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input value={gameMode} onChange={(e) => setGameMode(e.target.value)} placeholder="Mode du jour (ex. Gem Grab)" className="w-52 h-9" />
          <Input value={bans} onChange={(e) => setBans(e.target.value)} placeholder="Bans (ex. Piper, Edgar)" className="w-52 h-9" />
          <Button size="sm" disabled={present.size < 6 || draw.isPending} onClick={() => draw.mutate()}>
            <Shuffle className="h-4 w-4 mr-1" /> Tirer le tour
          </Button>
        </div>
      </Card>

      {/* Classement individuel */}
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Classement individuel</h2>
        {(board ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun résultat pour l'instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1.5 pl-1 w-8">#</th><th className="text-left py-1.5">Joueur</th>
                <th className="text-center py-1.5 w-12">V</th><th className="text-center py-1.5 w-12">D</th>
                <th className="text-center py-1.5 w-16">Manches</th>
              </tr>
            </thead>
            <tbody>
              {(board ?? []).map((r, i) => (
                <tr key={r.playerId} className="border-b last:border-0">
                  <td className="py-1.5 pl-1 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 font-medium">{r.pseudo}</td>
                  <td className="py-1.5 text-center tabular-nums">{r.wins}</td>
                  <td className="py-1.5 text-center tabular-nums">{r.losses}</td>
                  <td className="py-1.5 text-center tabular-nums text-muted-foreground">{r.gamesWon}–{r.gamesLost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Tours */}
      {[...(rounds ?? [])].reverse().map((r) => (
        <Card key={r.id} className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h3 className="font-semibold">Tour {r.roundNumber}</h3>
            {r.gameMode && <span className="text-xs bg-muted rounded px-2 py-0.5">{r.gameMode}</span>}
            {r.bans && <span className="text-xs text-muted-foreground">Bans : {r.bans}</span>}
          </div>
          <div className="space-y-2">
            {r.matches.map((m) => <MatchRow key={m.id} m={m} onSave={(a, b) => setResult.mutate({ id: m.id, scoreA: a, scoreB: b })} />)}
            {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement (pas assez de joueurs).</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function MatchRow({ m, onSave }: { m: MatchView; onSave: (a: number, b: number) => void }) {
  const [a, setA] = useState(String(m.scoreA));
  const [b, setB] = useState(String(m.scoreB));
  const names = (t: PoolPlayer[]) => t.map((p) => p.pseudo).join(" · ");
  return (
    <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2">
      <span className={"flex-1 text-sm text-right truncate " + (m.winner === "a" ? "font-bold" : "")}>{names(m.teamA)}</span>
      <Input type="number" value={a} onChange={(e) => setA(e.target.value)} className="w-14 h-8 text-center" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" value={b} onChange={(e) => setB(e.target.value)} className="w-14 h-8 text-center" />
      <span className={"flex-1 text-sm truncate " + (m.winner === "b" ? "font-bold" : "")}>{names(m.teamB)}</span>
      <Button size="sm" variant="outline" onClick={() => onSave(Number(a) || 0, Number(b) || 0)}>OK</Button>
    </div>
  );
}

export default RandomTournamentPanel;
