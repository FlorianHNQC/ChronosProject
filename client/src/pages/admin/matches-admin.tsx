import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Competition, Match, Team } from "@shared/schema";

const MATCH_TYPES = [
  { value: "intra", label: "Intra-conférence" },
  { value: "inter", label: "Inter-conférence" },
  { value: "playoff", label: "Playoff" },
];

/**
 * Console admin — matchs d'une compétition : création et saisie de résultat.
 * La saisie détaillée des stats par joueur viendra avec le module Stats ; la
 * migration importera aussi les stats des anciens matchs.
 */
export function MatchesAdminPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

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

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return (id: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);

  const { toast } = useToast();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [matchType, setMatchType] = useState("intra");
  const [gameMode, setGameMode] = useState("");

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/matches", { competitionId, teamHomeId: home, teamAwayId: away, matchType, gameMode }),
    onSuccess: () => {
      setHome(""); setAway(""); setGameMode("");
      queryClient.invalidateQueries({ queryKey: ["/api/matches", competitionId] });
      toast({ title: "Match créé" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Matchs</h1>

      <div className="mb-6">
        <label className="text-sm text-muted-foreground mr-2">Compétition :</label>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">— choisir —</option>
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!competitionId && <p className="text-sm text-muted-foreground">Choisissez une compétition.</p>}

      {competitionId && (
        <>
          <Card className="p-4 mb-6">
            <h2 className="font-semibold mb-3">Nouveau match</h2>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (home && away) create.mutate(); }}>
              <select value={home} onChange={(e) => setHome(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Domicile…</option>
                {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="text-muted-foreground text-sm">vs</span>
              <select value={away} onChange={(e) => setAway(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Extérieur…</option>
                {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={matchType} onChange={(e) => setMatchType(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {MATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Input value={gameMode} onChange={(e) => setGameMode(e.target.value)} placeholder="Mode (optionnel)" className="w-40" />
              <Button type="submit" size="sm" disabled={create.isPending || !home || !away}>
                <Plus className="h-4 w-4 mr-1" />Créer
              </Button>
            </form>
          </Card>

          <div className="space-y-2">
            {(matches ?? []).map((m) => (
              <MatchRow key={m.id} match={m} competitionId={competitionId} homeName={teamName(m.teamHomeId)} awayName={teamName(m.teamAwayId)} />
            ))}
            {(matches ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun match.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function MatchRow({ match, competitionId, homeName, awayName }: { match: Match; competitionId: string; homeName: string; awayName: string }) {
  const { toast } = useToast();
  const [sh, setSh] = useState(String(match.scoreHome ?? ""));
  const [sa, setSa] = useState(String(match.scoreAway ?? ""));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/matches", competitionId] });

  const save = useMutation({
    mutationFn: () => {
      const h = Number(sh), a = Number(sa);
      const winnerId = h === a ? null : h > a ? match.teamHomeId : match.teamAwayId;
      return apiRequest("PATCH", `/api/matches/${match.id}`, { scoreHome: h, scoreAway: a, winnerId, status: "completed" });
    },
    onSuccess: () => { invalidate(); toast({ title: "Résultat enregistré" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/matches/${match.id}`),
    onSuccess: () => { invalidate(); toast({ title: "Match supprimé" }); },
  });

  return (
    <Card className="flex items-center gap-2 p-2.5 flex-wrap">
      <span className="font-medium flex-1 text-right min-w-[6rem] truncate">{homeName}</span>
      <Input type="number" value={sh} onChange={(e) => setSh(e.target.value)} className="w-14 h-9 text-center" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" value={sa} onChange={(e) => setSa(e.target.value)} className="w-14 h-9 text-center" />
      <span className="font-medium flex-1 min-w-[6rem] truncate">{awayName}</span>
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
      <Button size="icon" variant="ghost" onClick={() => del.mutate()} title="Supprimer">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </Card>
  );
}

export default MatchesAdminPage;
