import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserRound } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import type { Player, Tier } from "@shared/schema";

/**
 * Console admin Hydra — réglage manuel de l'Elo des joueurs.
 * En attendant que les matchs pilotent l'Elo, on l'ajuste ici ; le tier est
 * recalculé et l'évolution journalisée (visible dans le changelog Hydra).
 */
export function HydraAdminPage() {
  const { toast } = useToast();
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Hydra — réglage de l'Elo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Le tier est dérivé de l'Elo. Chaque modification est enregistrée dans le
        changelog.
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
        <span
          className="text-xs font-bold px-2 py-0.5 rounded text-white shrink-0"
          style={{ backgroundColor: previewTier.color ?? "#666" }}
        >
          {previewTier.code}
        </span>
      )}
      <Input
        type="number"
        value={elo}
        onChange={(e) => setElo(e.target.value)}
        className="w-24 h-9"
      />
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "…" : "Définir"}
      </Button>
    </Card>
  );
}

export default HydraAdminPage;
