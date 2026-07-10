import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, Plus, UserRound } from "lucide-react";
import type { Player } from "@shared/schema";

/**
 * Console admin — ajout de joueurs par tag Brawl Stars.
 * Le back interroge l'API officielle, résout l'avatar via Brawlify et
 * enregistre le profil. Rappel : le token API est verrouillé par IP.
 */
export function PlayersAdminPage() {
  const { toast } = useToast();
  const [tag, setTag] = useState("");
  const [nationality, setNationality] = useState("");

  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/players"] });

  const addPlayer = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/players", {
        tag,
        nationality: nationality || undefined,
      });
      return res.json();
    },
    onSuccess: (p: Player) => {
      toast({ title: "Joueur ajouté", description: `${p.pseudo} (${p.playerTag})` });
      setTag("");
      setNationality("");
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const resync = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/players/${id}/resync`),
    onSuccess: () => {
      toast({ title: "Resynchronisé" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/players/${id}`),
    onSuccess: () => {
      toast({ title: "Supprimé" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Joueurs — administration</h1>

      <Card className="p-4 mb-8">
        <h2 className="font-semibold mb-3">Ajouter par tag Brawl Stars</h2>
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tag.trim()) addPlayer.mutate();
          }}
        >
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="#2PP0LG"
            className="sm:flex-1"
          />
          <Input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Nat. (BJ)"
            maxLength={2}
            className="sm:w-28"
          />
          <Button type="submit" disabled={addPlayer.isPending || !tag.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {addPlayer.isPending ? "Ajout…" : "Ajouter"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Le tag est l'identifiant du profil in-game (ex. #2PP0LG). Nécessite un
          token API valide et une IP autorisée.
        </p>
      </Card>

      <h2 className="font-semibold mb-3">Joueurs enregistrés ({players?.length ?? 0})</h2>
      <div className="space-y-2">
        {(players ?? []).map((p) => (
          <Card key={p.id} className="flex items-center gap-3 p-2.5">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.pseudo} className="h-9 w-9 rounded object-cover bg-muted" />
            ) : (
              <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                <UserRound className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{p.pseudo}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.playerTag ?? "—"}
                {p.nationality ? ` · ${p.nationality}` : ""}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              title="Resynchroniser"
              disabled={resync.isPending}
              onClick={() => resync.mutate(p.id)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Supprimer"
              disabled={remove.isPending}
              onClick={() => remove.mutate(p.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
        {(!players || players.length === 0) && (
          <p className="text-sm text-muted-foreground">Aucun joueur enregistré.</p>
        )}
      </div>
    </div>
  );
}

export default PlayersAdminPage;
