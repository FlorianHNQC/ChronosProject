import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Tier } from "@shared/schema";

/**
 * Console admin — édition des paliers de tiers (seuil d'Elo + couleur).
 * Le regroupement dans Hydra est dérivé de ces seuils.
 */
export function TiersAdminPage() {
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const ordered = [...(tiers ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">Tiers — seuils d'Elo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Un joueur est classé dans le tier dont le seuil d'Elo est le plus haut
        tout en restant sous sa cote.
      </p>
      <div className="space-y-2">
        {ordered.map((t) => (
          <TierRow key={t.id} tier={t} />
        ))}
        {ordered.length === 0 && <p className="text-sm text-muted-foreground">Aucun tier.</p>}
      </div>
    </div>
  );
}

function TierRow({ tier }: { tier: Tier }) {
  const { toast } = useToast();
  const [minElo, setMinElo] = useState(String(tier.minElo));
  const [color, setColor] = useState(tier.color ?? "#666666");

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/tiers/${tier.id}`, { minElo: Number(minElo), color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiers"] });
      toast({ title: "Palier mis à jour", description: tier.code });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="flex items-center gap-3 p-2.5">
      <span
        className="w-14 shrink-0 text-center font-extrabold text-white rounded py-1"
        style={{ backgroundColor: color }}
      >
        {tier.code}
      </span>
      <label className="text-xs text-muted-foreground">Elo min.</label>
      <Input
        type="number"
        value={minElo}
        onChange={(e) => setMinElo(e.target.value)}
        className="w-24 h-9"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-9 w-10 rounded border bg-transparent cursor-pointer"
        title="Couleur"
      />
      <Button size="sm" className="ml-auto" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "…" : "Enregistrer"}
      </Button>
    </Card>
  );
}

export default TiersAdminPage;
