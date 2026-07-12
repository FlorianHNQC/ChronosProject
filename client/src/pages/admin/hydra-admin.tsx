import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserRound, RefreshCw } from "lucide-react";
import { tierForElo } from "@shared/tiers";
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

      <h2 className="font-semibold mb-3">Réglage manuel</h2>
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
  const [k, setK] = useState("24");
  const [competitionId, setCompetitionId] = useState("");

  const run = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/recompute-elo", {
        k: Number(k) || 24,
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
        Repart d'une base neutre (1000) et rejoue les matchs ayant des stats, avec une mise à jour de type Elo par équipe. Le facteur K se règle par essais.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">K</label>
        <Input type="number" value={k} onChange={(e) => setK(e.target.value)} className="w-20 h-9" />
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

function EloRow({ player, tiers, onSaved }: { player: Player; tiers: Tier[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [elo, setElo] = useState<string>(String(player.elo ?? 1000));

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/players/${player.id}/elo`, { elo: Number(elo) }),
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const previewTier = tierForElo(Number(elo), tiers);

  return (
    <Card className="flex items-center gap-3 p-2.5">
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
      <Input type="number" value={elo} onChange={(e) => setElo(e.target.value)} className="w-24 h-9" />
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "…" : "Définir"}
      </Button>
    </Card>
  );
}

export default HydraAdminPage;
