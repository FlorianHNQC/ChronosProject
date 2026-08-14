import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserRound, RefreshCw } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import { RANKS, seedEloFromRank } from "@shared/rankElo";
import type { Competition, Player, Tier } from "@shared/schema";

/**
 * Console admin Hydra — recalcul de l'Elo depuis les résultats + réglage manuel.
 */
export function HydraAdminPage() {
  const { toast } = useToast();
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">Hydra — Elo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Le tier est dérivé de l'Elo. Recalcule l'Elo depuis les résultats, ou ajuste-le à la main.
      </p>

      <RecomputeCard comps={comps ?? []} onDone={() => {
        queryClient.invalidateQueries({ queryKey: ["/api/players"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hydra/changelog"] });
      }} />

      <EloParamsCard />

      <h2 className="font-semibold mb-1">Elo de départ par joueur</h2>
      <p className="text-xs text-muted-foreground mb-3">
        L'évaluation préliminaire de chaque joueur. Enregistrer relance automatiquement le recalcul pour l'appliquer.
      </p>
      <div className="space-y-2">
        {(players ?? []).map((p) => (
          <EloRow key={p.id} player={p} tiers={tiers ?? []} onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/players"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hydra/changelog"] });
            toast({ title: "Elo mis à jour", description: p.pseudo });
          }} />
        ))}
        {(!players || players.length === 0) && (
          <p className="text-sm text-muted-foreground">Aucun joueur. Ajoutez-en d'abord.</p>
        )}
      </div>
    </div>
  );
}

function RecomputeCard({ comps, onDone }: { comps: Competition[]; onDone: () => void }) {
  const { toast } = useToast();
  const [k, setK] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  const run = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/recompute-elo", {
        k: k.trim() ? Number(k) : undefined,
        competitionId: competitionId || undefined,
      })).json(),
    onSuccess: (r: { players: number; matches: number; k: number }) => {
      onDone();
      toast({ title: "Elo recalculé", description: `${r.matches} matchs traités · ${r.players} joueurs · K=${r.k}` });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 mb-8">
      <h2 className="font-semibold mb-1">Recalcul depuis les résultats</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Chaque joueur part de son <b>Elo de départ</b> ; on rejoue les matchs des compétitions comptant pour l'Elo
        (résultat via le vainqueur + rosters), avec un K <b>adaptatif</b> par défaut. Laisse K vide pour l'adaptatif,
        ou fixe une valeur pour forcer un K unique.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">K</label>
        <Input type="number" value={k} onChange={(e) => setK(e.target.value)} placeholder="auto" className="w-20 h-9" />
        <label className="text-sm text-muted-foreground">Périmètre</label>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Toutes les compétitions</option>
          {comps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" />{run.isPending ? "Calcul…" : "Recalculer l'Elo"}
        </Button>
      </div>
    </Card>
  );
}

type EloParams = { base: number; provisionalGames: number; kProvisional: number; kBase: number; kStableElo: number; kStable: number; priorGames: number };
const PARAM_FIELDS: { key: keyof EloParams; label: string; hint: string }[] = [
  { key: "base", label: "Elo de départ (défaut)", hint: "Base d'un joueur non évalué" },
  { key: "provisionalGames", label: "Matchs provisoires", hint: "Avant fin du calibrage" },
  { key: "kProvisional", label: "K provisoire", hint: "Calibrage rapide" },
  { key: "kBase", label: "K standard", hint: "Régime normal" },
  { key: "kStableElo", label: "Seuil « confirmé »", hint: "Elo où l'on stabilise" },
  { key: "kStable", label: "K confirmé", hint: "Haut de classement" },
  { key: "priorGames", label: "Confiance du rang", hint: "Ancrage vers l'Elo de départ (0 = aucun)" },
];

function EloParamsCard() {
  const { toast } = useToast();
  const { data } = useQuery<EloParams>({ queryKey: ["/api/elo/params"] });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setForm(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/elo/params", Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elo/params"] });
      toast({ title: "Paramètres Elo enregistrés", description: "Relance un recalcul pour les appliquer." });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 mb-8">
      <h2 className="font-semibold mb-1">Paramètres du moteur Elo</h2>
      <p className="text-xs text-muted-foreground mb-3">
        K adaptatif : provisoire (calibrage) → standard → confirmé (stabilité). Après modification, relance un recalcul.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PARAM_FIELDS.map((f) => (
          <label key={f.key} className="text-sm block">
            <span className="text-muted-foreground">{f.label}</span>
            <Input
              type="number"
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="mt-1 h-9"
            />
            <span className="text-[11px] text-muted-foreground">{f.hint}</span>
          </label>
        ))}
      </div>
      <Button size="sm" className="mt-3" disabled={save.isPending} onClick={() => save.mutate()}>
        Enregistrer les paramètres
      </Button>
    </Card>
  );
}

function EloRow({ player, tiers, onSaved }: { player: Player; tiers: Tier[]; onSaved: () => void }) {
  const { toast } = useToast();
  // On règle l'Elo de DÉPART (évaluation préliminaire) ; le recalcul l'applique.
  const [elo, setElo] = useState<string>(String(player.seedElo ?? 1000));
  const [showRank, setShowRank] = useState(false);
  const [rankKey, setRankKey] = useState("");
  const [trophies, setTrophies] = useState("");

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/players/${player.id}/elo`, { elo: Number(elo) }),
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const setMode = useMutation({
    mutationFn: (mode: string) => apiRequest("PATCH", `/api/players/${player.id}`, { modeOverride: mode || null }),
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const previewTier = tierForElo(Number(elo), tiers);
  const suggestion = rankKey ? seedEloFromRank(rankKey, Number(trophies) || 0) : null;

  return (
    <Card className="p-2.5">
      <div className="flex items-center gap-3">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt={player.pseudo} className="h-9 w-9 rounded object-cover bg-muted" />
        ) : (
          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
            <UserRound className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{player.pseudo}</div>
          <div className="text-xs text-muted-foreground truncate">{player.playerTag ?? "—"}</div>
        </div>
        {previewTier && (
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: previewTier.color ?? "#666" }}>
            {previewTier.code}
          </span>
        )}
        <select
          value={player.modeOverride ?? ""}
          onChange={(e) => setMode.mutate(e.target.value)}
          className="h-9 rounded-md border bg-background px-1.5 text-xs shrink-0"
          title="Statut Hydra — Auto = déduit (Rookie si 0 compétition, Réserve si inactif)"
        >
          <option value="">Auto</option>
          <option value="joueurs">Joueurs</option>
          <option value="rookie">Rookie</option>
          <option value="reserve">Réserve</option>
        </select>
        <Input type="number" value={elo} onChange={(e) => setElo(e.target.value)} className="w-24 h-9" />
        <Button size="sm" variant="ghost" onClick={() => setShowRank((s) => !s)} title="Suggérer l'Elo de départ depuis le rang Ranked">
          Rang
        </Button>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "…" : "Définir"}
        </Button>
      </div>

      {showRank && (
        <div className="flex items-center gap-2 mt-2 flex-wrap pl-12 text-sm">
          <span className="text-xs text-muted-foreground">Rang Ranked</span>
          <select value={rankKey} onChange={(e) => setRankKey(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="">—</option>
            {RANKS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">Trophées</span>
          <Input type="number" value={trophies} onChange={(e) => setTrophies(e.target.value)} placeholder="ex. 45000" className="w-28 h-8" />
          <Button size="sm" variant="outline" disabled={suggestion == null} onClick={() => suggestion != null && setElo(String(suggestion))}>
            Suggérer
          </Button>
          {suggestion != null && <span className="text-xs text-muted-foreground">→ {suggestion} Elo de départ</span>}
        </div>
      )}
    </Card>
  );
}

export default HydraAdminPage;
