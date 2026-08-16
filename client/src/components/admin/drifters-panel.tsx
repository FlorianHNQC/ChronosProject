import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Match, Player, Team } from "@shared/schema";

type DrifterRow = {
  id: string; matchId: string; playerId: string; pseudo: string | null;
  fromTeamId: string | null; toTeamId: string | null; currency: string; price: number;
};

/** Engagements de drifter par match, scopé à une compétition (page de gestion). */
export function DriftersPanel({ competitionId }: { competitionId: string }) {
  const { toast } = useToast();
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const [matchId, setMatchId] = useState("");

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });
  const { data: matches } = useQuery<Match[]>({
    queryKey: ["/api/matches", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/matches?competitionId=${competitionId}`)).json(),
  });
  const { data: drifters } = useQuery<DrifterRow[]>({
    queryKey: ["/api/matches", matchId, "drifters"],
    enabled: !!matchId,
    queryFn: async () => (await apiRequest("GET", `/api/matches/${matchId}/drifters`)).json(),
  });

  const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "—";

  const [playerId, setPlayerId] = useState("");
  const [fromTeamId, setFromTeamId] = useState("");
  const [toTeamId, setToTeamId] = useState("");
  const [currency, setCurrency] = useState("tokens");
  const [price, setPrice] = useState("0");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId, "drifters"] });

  const add = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${matchId}/drifters`, { playerId, fromTeamId: fromTeamId || undefined, toTeamId: toTeamId || undefined, currency, price: Number(price) || 0 }),
    onSuccess: () => { setPlayerId(""); setPrice("0"); invalidate(); toast({ title: "Drifter engagé" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/drifters/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Supprimé" }); },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <label className="text-sm text-muted-foreground">Match :</label>
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm max-w-md">
          <option value="">— choisir —</option>
          {(matches ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {teamName(m.teamHomeId)} vs {teamName(m.teamAwayId)} {m.datetime ? `(${new Date(m.datetime).toLocaleDateString("fr-FR")})` : ""}
            </option>
          ))}
        </select>
      </div>

      {matchId && (
        <>
          <Card className="p-4 mb-6">
            <h2 className="font-semibold mb-3">Engager un drifter</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Joueur…</option>
                {(players ?? []).map((p) => <option key={p.id} value={p.id}>{p.pseudo}</option>)}
              </select>
              <select value={fromTeamId} onChange={(e) => setFromTeamId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Depuis…</option>
                {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={toTeamId} onChange={(e) => setToTeamId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Vers…</option>
                {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="tokens">Jetons</option>
                <option value="elo">Elo</option>
                <option value="other">Autre</option>
              </select>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 h-9" placeholder="Tarif" />
              <Button size="sm" disabled={add.isPending || !playerId} onClick={() => add.mutate()}>
                <Plus className="h-4 w-4 mr-1" />Engager
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {(drifters ?? []).map((d) => (
              <Card key={d.id} className="flex items-center gap-3 p-2.5">
                <span className="font-medium flex-1">{d.pseudo}</span>
                <span className="text-xs text-muted-foreground">{teamName(d.fromTeamId)} → {teamName(d.toTeamId)}</span>
                <span className="text-sm">{d.price} {d.currency}</span>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)} title="Supprimer">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
            {(drifters ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun drifter pour ce match.</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default DriftersPanel;
