import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Star, X, UserRound, Image as ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/upload";
import type { Player, Team } from "@shared/schema";

type RosterMember = {
  playerId: string; pseudo: string; avatarUrl: string | null;
  playerTag: string | null; elo: number | null; isCaptain: boolean | null;
};

/**
 * Panneau de gestion des équipes d'une compétition (rosters propres à la
 * compétition, table team_players). Réutilisé par la page « Équipes (admin) »
 * et par la page de gestion d'une compétition.
 */
export function CompetitionTeamsPanel({ competitionId }: { competitionId: string }) {
  const { toast } = useToast();
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");

  const createTeam = useMutation({
    mutationFn: () => apiRequest("POST", "/api/teams", { name, tag, competitionId }),
    onSuccess: () => {
      setName(""); setTag("");
      queryClient.invalidateQueries({ queryKey: ["/api/teams", competitionId] });
      toast({ title: "Équipe créée" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-3">Nouvelle équipe</h2>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (name.trim() && tag.trim()) createTeam.mutate(); }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="flex-1 min-w-[10rem]" />
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="TAG" className="w-28 uppercase" maxLength={10} />
          <Button type="submit" size="sm" disabled={createTeam.isPending || !name.trim() || !tag.trim()}>
            <Plus className="h-4 w-4 mr-1" />Créer
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {(teams ?? []).map((t) => (
          <TeamCard key={t.id} team={t} competitionId={competitionId} />
        ))}
        {(teams ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune équipe dans cette compétition.</p>
        )}
      </div>
    </div>
  );
}

function TeamCard({ team, competitionId }: { team: Team; competitionId: string }) {
  const { toast } = useToast();
  const { data: allPlayers } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: roster } = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", team.id, "roster"],
    queryFn: async () => (await apiRequest("GET", `/api/teams/${team.id}/roster`)).json(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/teams", team.id, "roster"] });
  };
  const invalidateTeams = () => queryClient.invalidateQueries({ queryKey: ["/api/teams", competitionId] });

  const add = useMutation({
    mutationFn: (playerId: string) => apiRequest("POST", `/api/teams/${team.id}/roster`, { playerId }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (playerId: string) => apiRequest("DELETE", `/api/teams/${team.id}/roster/${playerId}`),
    onSuccess: invalidate,
  });
  const captain = useMutation({
    mutationFn: (playerId: string) => apiRequest("POST", `/api/teams/${team.id}/roster/${playerId}/captain`),
    onSuccess: invalidate,
  });
  const removeTeam = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/teams/${team.id}`),
    onSuccess: () => { invalidateTeams(); toast({ title: "Équipe supprimée" }); },
  });
  const setLogo = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadImage(file, { max: 256, quality: 0.85 });
      return apiRequest("PATCH", `/api/teams/${team.id}`, { logoUrl: url });
    },
    onSuccess: () => { invalidateTeams(); toast({ title: "Logo mis à jour" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const inTeam = new Set((roster ?? []).map((r) => r.playerId));
  const available = (allPlayers ?? []).filter((p) => !inTeam.has(p.id));

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <label className="shrink-0 cursor-pointer" title="Changer le logo (image optimisée automatiquement)">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="h-9 w-9 rounded object-cover bg-muted ring-1 ring-border" />
          ) : (
            <div className="h-9 w-9 rounded bg-muted flex items-center justify-center ring-1 ring-border">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" disabled={setLogo.isPending}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo.mutate(f); e.target.value = ""; }} />
        </label>
        <span className="font-semibold">{team.name}</span>
        <span className="text-xs text-muted-foreground">[{team.tag}]</span>
        {setLogo.isPending && <span className="text-xs text-muted-foreground">envoi…</span>}
        <Button size="icon" variant="ghost" className="ml-auto" title="Supprimer l'équipe" onClick={() => removeTeam.mutate()}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {(roster ?? []).map((m) => (
          <div key={m.playerId} className="flex items-center gap-1.5 border rounded-md pl-1 pr-1.5 py-1">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-6 w-6 rounded object-cover bg-muted" />
            ) : (
              <UserRound className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-sm">{m.pseudo}</span>
            <button title="Capitaine" onClick={() => captain.mutate(m.playerId)}>
              <Star className={"h-3.5 w-3.5 " + (m.isCaptain ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
            </button>
            <button title="Retirer" onClick={() => del.mutate(m.playerId)}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
        {(roster ?? []).length === 0 && <span className="text-xs text-muted-foreground">Effectif vide.</span>}
      </div>

      <select
        value=""
        onChange={(e) => { if (e.target.value) add.mutate(e.target.value); }}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        disabled={available.length === 0}
      >
        <option value="">+ Ajouter un joueur</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>{p.pseudo}</option>
        ))}
      </select>
    </Card>
  );
}

export default CompetitionTeamsPanel;
