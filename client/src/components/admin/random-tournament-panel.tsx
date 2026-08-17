import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shuffle, X, Trash2, Scale, UserRound, LayoutGrid } from "lucide-react";
import { PlayerPoules } from "@/components/player-poules";
import { ImageSelect, type ImageOption } from "@/components/image-select";
import { useBsCatalog, MetaBadges } from "@/lib/bs-catalog";
import type { Player } from "@shared/schema";

type PoolPlayer = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
type MatchView = { id: string; teamA: PoolPlayer[]; teamB: PoolPlayer[]; scoreA: number; scoreB: number; winner: string | null; gameMode: string | null; map: string | null; datetime: string | null };
type RoundView = { id: string; roundNumber: number; gameMode: string | null; bans: string | null; note: string | null; matches: MatchView[] };
type LeaderRow = { playerId: string; pseudo: string; avatarUrl: string | null; played: number; wins: number; losses: number; gamesWon: number; gamesLost: number };
type Suggestions = { modes: string[]; maps: string[] };

/**
 * Panneau tournoi à équipes aléatoires : pool, tirage 3v3 par tour (aléatoire ou
 * équilibré par Elo), mode par affrontement (commun ou tiré au hasard), maps
 * choisies après coup, classement individuel. Non lié à l'Elo.
 */
export function RandomTournamentPanel({ competitionId: cid }: { competitionId: string }) {
  const { toast } = useToast();
  const { data: allPlayers } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: suggestions } = useQuery<Suggestions>({
    queryKey: ["/api/random/suggestions"],
    queryFn: async () => (await apiRequest("GET", "/api/random/suggestions")).json(),
  });
  const { modeOptions: catModes, mapOptions: catMaps } = useBsCatalog();
  // Options : catalogue Brawlify + entrées déjà saisies (repli).
  const modeOptions: ImageOption[] = useMemo(() => {
    const seen = new Set(catModes.map((o) => o.value));
    const extra = (suggestions?.modes ?? []).filter((s) => !seen.has(s)).map((s) => ({ value: s, label: s }));
    return [...catModes, ...extra];
  }, [catModes, suggestions]);
  const mapOptions: ImageOption[] = useMemo(() => {
    const seen = new Set(catMaps.map((o) => o.value));
    const extra = (suggestions?.maps ?? []).filter((s) => !seen.has(s)).map((s) => ({ value: s, label: s }));
    return [...catMaps, ...extra];
  }, [catMaps, suggestions]);

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
    queryClient.invalidateQueries({ queryKey: ["/api/random/suggestions"] });
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
  const setPool = useMutation({
    mutationFn: (v: { pid: string; poolLabel: string }) => apiRequest("PATCH", `/api/random/${cid}/participants/${v.pid}`, { poolLabel: v.poolLabel || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/random", cid, "participants"] }),
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const [present, setPresent] = useState<Set<string>>(new Set());
  const [gameMode, setGameMode] = useState("");
  const [bans, setBans] = useState("");
  const [balanceElo, setBalanceElo] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [drawScope, setDrawScope] = useState<"intra" | "inter">("intra");
  useEffect(() => { setPresent(new Set((pool ?? []).map((p) => p.playerId))); }, [pool]);
  const toggle = (id: string) => setPresent((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const draw = useMutation({
    mutationFn: () => apiRequest("POST", `/api/random/${cid}/rounds`, {
      playerIds: Array.from(present), gameMode, bans, balanceElo, randomMode, pouleScope: drawScope,
    }),
    onSuccess: () => { setGameMode(""); setBans(""); invalidate(); toast({ title: "Tour tiré" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const setResult = useMutation({
    mutationFn: (v: { id: string; scoreA: number; scoreB: number }) => apiRequest("PATCH", `/api/random/matches/${v.id}`, { scoreA: v.scoreA, scoreB: v.scoreB }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const setMeta = useMutation({
    mutationFn: (v: { id: string; gameMode?: string; map?: string; datetime?: string | null }) => apiRequest("PATCH", `/api/random/matches/${v.id}`, { gameMode: v.gameMode, map: v.map, datetime: v.datetime }),
    onSuccess: () => { invalidate(); toast({ title: "Enregistré" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const delMatch = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/random/matches/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Affrontement supprimé" }); },
  });
  const delRound = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/random/${cid}/rounds/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Tour supprimé" }); },
  });

  // Publication des poules (round-robin intra ou tirage inter).
  const [pouleScope, setPouleScope] = useState<"intra" | "inter">("intra");
  const genPoules = useMutation({
    mutationFn: () => apiRequest("POST", `/api/random/${cid}/generate-poules`, { scope: pouleScope, balanceElo }),
    onSuccess: () => { invalidate(); toast({ title: "Poules publiées", description: "Affrontements générés." }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  // Compositeur d'affrontement manuel (sans équipe).
  const [maRound, setMaRound] = useState("");
  const [maA, setMaA] = useState<string[]>([]);
  const [maB, setMaB] = useState<string[]>([]);
  const [maMode, setMaMode] = useState("");
  const [maMap, setMaMap] = useState("");
  const addMatch = useMutation({
    mutationFn: () => apiRequest("POST", `/api/random/${cid}/matches`, {
      roundId: maRound || undefined, teamA: maA, teamB: maB, gameMode: maMode || undefined, map: maMap || undefined,
    }),
    onSuccess: () => { setMaA([]); setMaB([]); setMaMode(""); setMaMap(""); invalidate(); toast({ title: "Affrontement créé" }); },
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
        <div className="flex flex-col gap-1">
          {(pool ?? []).map((p) => (
            <div key={p.playerId} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
              <span className="flex-1 truncate">{p.pseudo}</span>
              <span className="text-xs text-muted-foreground">Poule</span>
              <Input
                defaultValue={p.poolLabel ?? ""}
                placeholder="—"
                className="w-14 h-7 text-center"
                onBlur={(e) => { if ((p.poolLabel ?? "") !== e.target.value.trim()) setPool.mutate({ pid: p.playerId, poolLabel: e.target.value.trim() }); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              <button onClick={() => rmP.mutate(p.playerId)} title="Retirer du pool"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
          ))}
          {(pool ?? []).length === 0 && <span className="text-xs text-muted-foreground">Pool vide.</span>}
        </div>
      </Card>

      {/* Poules de joueurs */}
      {(pool ?? []).some((p) => (p.poolLabel ?? "").trim()) && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h2 className="font-semibold flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> Poules</h2>
            <div className="ml-auto flex items-center gap-2">
              <select value={pouleScope} onChange={(e) => setPouleScope(e.target.value as "intra" | "inter")} className="h-8 rounded-md border bg-background px-2 text-xs">
                <option value="intra">Matchs intra-poule</option>
                <option value="inter">Matchs inter-poules</option>
              </select>
              <Button size="sm" disabled={genPoules.isPending} onClick={() => genPoules.mutate()} title="Générer les affrontements des poules (round-robin)">
                {genPoules.isPending ? "Publication…" : "Publier les poules"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            « Publier » crée les affrontements : en intra, round-robin des trios formés au sein de chaque poule (avec 9 joueurs → 3 trios → 3 matchs). Utilise l'option « Équilibrer par Elo » ci-dessus pour équilibrer les trios.
          </p>
          <PlayerPoules entrants={pool ?? []} records={board ?? []} />
        </Card>
      )}

      {/* Compositeur d'affrontement manuel (sans équipe) */}
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-1">Composer un affrontement</h2>
        <p className="text-xs text-muted-foreground mb-3">Choisis les joueurs de chaque camp — sans créer d'équipe. Pratique pour un match intra-poule précis ou pour faire jouer un trio une 2ᵉ fois.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <SidePicker label="Équipe A" value={maA} onChange={setMaA} pool={pool ?? []} exclude={maB} />
          <SidePicker label="Équipe B" value={maB} onChange={setMaB} pool={pool ?? []} exclude={maA} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Tour</span>
          <select value={maRound} onChange={(e) => setMaRound(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Nouveau tour</option>
            {[...(rounds ?? [])].reverse().map((r) => <option key={r.id} value={r.id}>Tour {r.roundNumber}</option>)}
          </select>
          <div className="w-40"><ImageSelect value={maMode} onChange={setMaMode} options={modeOptions} placeholder="Mode" /></div>
          <div className="w-40"><ImageSelect value={maMap} onChange={setMaMap} options={mapOptions} placeholder="Map" /></div>
          <Button size="sm" disabled={maA.length === 0 || maB.length === 0 || addMatch.isPending} onClick={() => addMatch.mutate()}>
            Créer l'affrontement
          </Button>
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

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select value={drawScope} onChange={(e) => setDrawScope(e.target.value as "intra" | "inter")}
            className="h-8 rounded-md border bg-background px-2 text-xs" title="Intra : on ne mélange jamais deux poules. Inter : tirage global toutes poules confondues.">
            <option value="intra">Intra-poule (pas de mélange)</option>
            <option value="inter">Inter-poules (global)</option>
          </select>
          <button onClick={() => setBalanceElo((v) => !v)}
            className={"inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border " + (balanceElo ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground")}
            title="Former des trios de moyenne d'Elo proche (équilibrage approximatif)">
            <Scale className="h-3.5 w-3.5" /> Équilibrer par Elo
          </button>
          <button onClick={() => setRandomMode((v) => !v)}
            className={"inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border " + (randomMode ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground")}
            title="Chaque affrontement reçoit un mode tiré au hasard parmi les modes déjà utilisés">
            <Shuffle className="h-3.5 w-3.5" /> Mode aléatoire par affrontement
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-52"><ImageSelect value={gameMode} onChange={setGameMode} options={modeOptions} placeholder={randomMode ? "(tiré au hasard)" : "Mode (ex. Gem Grab)"} disabled={randomMode} /></div>
          <Input value={bans} onChange={(e) => setBans(e.target.value)} placeholder="Bans (ex. Piper, Edgar)" className="w-52 h-9" />
          <Button size="sm" disabled={present.size < 6 || draw.isPending} onClick={() => draw.mutate()}>
            <Shuffle className="h-4 w-4 mr-1" /> Tirer le tour
          </Button>
        </div>
      </Card>

      {/* Tours */}
      {[...(rounds ?? [])].reverse().map((r) => (
        <Card key={r.id} className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h3 className="font-semibold">Tour {r.roundNumber}</h3>
            {r.gameMode && <span className="text-xs bg-muted rounded px-2 py-0.5">{r.gameMode}</span>}
            {r.bans && <span className="text-xs text-muted-foreground">Bans : {r.bans}</span>}
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" title="Supprimer le tour"
              onClick={() => { if (confirm(`Supprimer le tour ${r.roundNumber} et ses affrontements ?`)) delRound.mutate(r.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {r.matches.map((m) => (
              <MatchRow key={m.id} m={m} modeOptions={modeOptions} mapOptions={mapOptions}
                onSaveScore={(a, b) => setResult.mutate({ id: m.id, scoreA: a, scoreB: b })}
                onSaveMeta={(mode, map, datetime) => setMeta.mutate({ id: m.id, gameMode: mode, map, datetime })}
                onDelete={() => delMatch.mutate(m.id)} />
            ))}
            {r.matches.length === 0 && <p className="text-sm text-muted-foreground">Aucun affrontement (pas assez de joueurs).</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SidePicker({ label, value, onChange, pool, exclude }: {
  label: string; value: string[]; onChange: (v: string[]) => void; pool: PoolPlayer[]; exclude: string[];
}) {
  const byId = new Map(pool.map((p) => [p.playerId, p]));
  const taken = new Set([...value, ...exclude]);
  const available = pool.filter((p) => !taken.has(p.playerId)).sort((a, b) => a.pseudo.localeCompare(b.pseudo));
  return (
    <div className="border rounded-lg p-2">
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
            {byId.get(id)?.pseudo ?? "?"}
            <button onClick={() => onChange(value.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {value.length === 0 && <span className="text-xs text-muted-foreground">Aucun joueur.</span>}
      </div>
      <select value="" onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }} className="h-8 w-full rounded-md border bg-background px-2 text-sm" disabled={available.length === 0}>
        <option value="">+ Ajouter un joueur</option>
        {available.map((p) => <option key={p.playerId} value={p.playerId}>{p.pseudo}{p.poolLabel ? ` (poule ${p.poolLabel})` : ""}</option>)}
      </select>
    </div>
  );
}

function TeamBlock({ label, players, side, won }: { label: string; players: PoolPlayer[]; side: "a" | "b"; won: boolean }) {
  const accent = side === "a" ? "#3BA7E2" : "#E2683B";
  return (
    <div className={"flex-1 min-w-[9rem] rounded-lg border p-2 " + (won ? "ring-2" : "")} style={won ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: accent }}>{label}</span>
        {won && <span className="text-[10px] font-bold" style={{ color: accent }}>Vainqueur</span>}
      </div>
      <div className="flex flex-col gap-1">
        {players.map((p) => (
          <div key={p.playerId} className="flex items-center gap-1.5">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.pseudo} className="h-6 w-6 rounded object-cover bg-muted ring-1 ring-border shrink-0" />
            ) : (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center ring-1 ring-border shrink-0"><UserRound className="h-3.5 w-3.5 text-muted-foreground" /></div>
            )}
            <span className="text-sm truncate">{p.pseudo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MatchRow({ m, onSaveScore, onSaveMeta, onDelete, modeOptions, mapOptions }: {
  m: MatchView;
  onSaveScore: (a: number, b: number) => void;
  onSaveMeta: (mode: string, map: string, datetime: string | null) => void;
  onDelete: () => void;
  modeOptions: ImageOption[];
  mapOptions: ImageOption[];
}) {
  const [a, setA] = useState(String(m.scoreA));
  const [b, setB] = useState(String(m.scoreB));
  const [mode, setMode] = useState(m.gameMode ?? "");
  const [map, setMap] = useState(m.map ?? "");
  const [dt, setDt] = useState(toLocalInput(m.datetime));
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-background/40">
      <div className="flex items-center justify-between gap-2">
        <MetaBadges gameMode={m.gameMode} map={m.map} />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Supprimer l'affrontement" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Composition claire des deux trios */}
      <div className="flex items-stretch gap-2">
        <TeamBlock label="Équipe A" players={m.teamA} side="a" won={m.winner === "a"} />
        <div className="flex flex-col items-center justify-center gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <Input type="number" value={a} onChange={(e) => setA(e.target.value)} className="w-12 h-8 text-center" />
            <span className="text-muted-foreground">–</span>
            <Input type="number" value={b} onChange={(e) => setB(e.target.value)} className="w-12 h-8 text-center" />
          </div>
          <Button size="sm" variant="outline" className="h-7" onClick={() => onSaveScore(Number(a) || 0, Number(b) || 0)}>Score</Button>
        </div>
        <TeamBlock label="Équipe B" players={m.teamB} side="b" won={m.winner === "b"} />
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="text-xs text-muted-foreground">Mode</span>
        <div className="w-40"><ImageSelect value={mode} onChange={setMode} options={modeOptions} placeholder="Mode" /></div>
        <span className="text-xs text-muted-foreground">Map</span>
        <div className="w-44"><ImageSelect value={map} onChange={setMap} options={mapOptions} placeholder="Map" /></div>
        <span className="text-xs text-muted-foreground">Date</span>
        <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="w-52 h-8" />
        <Button size="sm" variant="outline" onClick={() => onSaveMeta(mode, map, dt ? new Date(dt).toISOString() : null)}>Enregistrer</Button>
      </div>
    </div>
  );
}

export default RandomTournamentPanel;
