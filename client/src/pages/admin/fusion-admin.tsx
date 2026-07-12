import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserRound, Merge } from "lucide-react";
import type { Player } from "@shared/schema";

type Group = { pseudo: string; players: Player[] };

/**
 * Console admin — fusion des doublons de joueurs (issus de l'import sans fusion).
 * Fusionner « source → cible » réassigne tout l'historique vers la cible et
 * supprime la source. Après chaque fusion, l'Elo/les tiers sont recalculés
 * automatiquement (le profil conservé hérite de l'historique de l'autre).
 */
export function FusionAdminPage() {
  const { toast } = useToast();
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/admin/duplicate-suggestions"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const invalidateAll = () => {
    for (const k of [
      ["/api/admin/duplicate-suggestions"], ["/api/players"], ["/api/stats/season"],
      ["/api/player-tags"], ["/api/tiers"], ["/api/hydra/changelog"],
    ]) {
      queryClient.invalidateQueries({ queryKey: k });
    }
  };

  const merge = useMutation({
    mutationFn: (v: { targetId: string; sourceId: string }) => apiRequest("POST", "/api/admin/merge-players", v),
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  // Fusionne, puis déclenche automatiquement le recalcul de l'Elo/tiers.
  const mergeMany = async (targetId: string, sourceIds: string[]) => {
    if (sourceIds.length === 0) return;
    for (const sourceId of sourceIds) {
      await merge.mutateAsync({ targetId, sourceId });
    }
    try {
      await apiRequest("POST", "/api/admin/recompute-elo", {});
    } catch {
      /* le recalcul est best-effort ; la fusion a réussi */
    }
    invalidateAll();
    toast({ title: "Fusion effectuée", description: `${sourceIds.length} profil(s) fusionné(s) · Elo recalculé.` });
  };

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">Fusion des doublons</h1>
      <p className="text-sm text-muted-foreground mb-6">
        La fusion réassigne stats, matchs, rosters et tags vers le profil conservé, supprime l'autre,
        puis recalcule automatiquement l'Elo et les tiers.
      </p>

      <h2 className="font-semibold mb-3">Suggestions (même pseudo)</h2>
      <div className="space-y-3 mb-10">
        {(groups ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun doublon de pseudo détecté.</p>
        )}
        {(groups ?? []).map((g) => (
          <GroupRow key={g.pseudo} group={g} onMerge={mergeMany} busy={merge.isPending} />
        ))}
      </div>

      <h2 className="font-semibold mb-3">Fusion manuelle</h2>
      <ManualMerge players={players ?? []} onMerge={(t, s) => mergeMany(t, [s])} busy={merge.isPending} />
    </div>
  );
}

function PlayerBadge({ p }: { p: Player }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {p.avatarUrl ? (
        <img src={p.avatarUrl} alt={p.pseudo} className="h-6 w-6 rounded object-cover bg-muted" />
      ) : (
        <UserRound className="h-5 w-5 text-muted-foreground" />
      )}
      {p.pseudo}
      {p.playerTag ? <span className="text-xs text-muted-foreground">{p.playerTag}</span> : null}
    </span>
  );
}

function GroupRow({ group, onMerge, busy }: { group: Group; onMerge: (t: string, s: string[]) => void; busy: boolean }) {
  const [keeper, setKeeper] = useState(group.players[0].id);
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {group.players.map((p) => (
          <label key={p.id} className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`keep-${group.pseudo}`} checked={keeper === p.id} onChange={() => setKeeper(p.id)} />
            <PlayerBadge p={p} />
          </label>
        ))}
        <Button
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => onMerge(keeper, group.players.filter((p) => p.id !== keeper).map((p) => p.id))}
        >
          <Merge className="h-4 w-4 mr-1" /> Garder le sélectionné, fusionner les autres
        </Button>
      </div>
    </Card>
  );
}

function ManualMerge({ players, onMerge, busy }: { players: Player[]; onMerge: (t: string, s: string) => void; busy: boolean }) {
  const [target, setTarget] = useState("");
  const [source, setSource] = useState("");
  return (
    <Card className="p-4 flex flex-wrap items-center gap-2 max-w-3xl">
      <span className="text-sm text-muted-foreground">Garder</span>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm min-w-[12rem]">
        <option value="">— cible —</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.pseudo}{p.playerTag ? ` (${p.playerTag})` : ""}</option>)}
      </select>
      <span className="text-sm text-muted-foreground">fusionner</span>
      <select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm min-w-[12rem]">
        <option value="">— source —</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.pseudo}{p.playerTag ? ` (${p.playerTag})` : ""}</option>)}
      </select>
      <Button
        size="sm"
        disabled={busy || !target || !source || target === source}
        onClick={() => onMerge(target, source)}
      >
        Fusionner
      </Button>
    </Card>
  );
}

export default FusionAdminPage;
