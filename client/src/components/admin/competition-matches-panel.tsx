import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Match, Team } from "@shared/schema";

const MATCH_TYPES = [
  { value: "intra", label: "Intra-conférence" },
  { value: "inter", label: "Inter-conférence" },
  { value: "playoff", label: "Playoff" },
];

// Nombre de conférences distinctes représentées par les équipes d'une compétition.
// Les libellés domicile/extérieur et intra/inter n'ont de sens qu'à partir de 2.
function distinctConferences(teams: Team[]): number {
  return new Set((teams ?? []).map((t) => t.conferenceId).filter(Boolean)).size;
}

// Convertit une date ISO/Date en valeur d'input datetime-local (heure locale, sans secondes).
function toLocalInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Panneau de gestion des matchs d'une compétition : création (avec date),
 * (re)programmation et saisie de résultat. Réutilisé par « Matchs (admin) »
 * et par la page de gestion d'une compétition.
 */
export function CompetitionMatchesPanel({ competitionId }: { competitionId: string }) {
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
  const useConferences = distinctConferences(teams ?? []) >= 2;
  const labelA = useConferences ? "Domicile…" : "Équipe A…";
  const labelB = useConferences ? "Extérieur…" : "Équipe B…";

  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [matchType, setMatchType] = useState("intra");
  const [datetime, setDatetime] = useState("");
  const [numGames, setNumGames] = useState("3");
  const [roundsPerGame, setRoundsPerGame] = useState("3");
  const [modifier, setModifier] = useState("");

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/matches", {
      competitionId, teamHomeId: home, teamAwayId: away,
      matchType: useConferences ? matchType : "intra",
      datetime: datetime || null,
      numGames: Number(numGames) || 1,
      roundsPerGame: Number(roundsPerGame) || 1,
      modifier: modifier || null,
    }),
    onSuccess: () => {
      setHome(""); setAway(""); setDatetime(""); setModifier("");
      queryClient.invalidateQueries({ queryKey: ["/api/matches", competitionId] });
      toast({ title: "Match créé" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-3">Nouveau match</h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (home && away) create.mutate(); }}>
          <select value={home} onChange={(e) => setHome(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">{labelA}</option>
            {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="text-muted-foreground text-sm h-9 flex items-center">vs</span>
          <select value={away} onChange={(e) => setAway(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">{labelB}</option>
            {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {useConferences && (
            <select value={matchType} onChange={(e) => setMatchType(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              {MATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
          <label className="text-xs text-muted-foreground">Affrontements
            <Input type="number" min={1} value={numGames} onChange={(e) => setNumGames(e.target.value)} className="w-20 h-9 mt-0.5" /></label>
          <label className="text-xs text-muted-foreground">Manches / affr.
            <Input type="number" min={1} value={roundsPerGame} onChange={(e) => setRoundsPerGame(e.target.value)} className="w-20 h-9 mt-0.5" /></label>
          <label className="text-xs text-muted-foreground">Modificateurs
            <Input value={modifier} onChange={(e) => setModifier(e.target.value)} placeholder="ex. sans Gadget" className="w-44 h-9 mt-0.5" /></label>
          <label className="text-xs text-muted-foreground">Date &amp; heure
            <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-52 h-9 mt-0.5" /></label>
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
    </div>
  );
}

function MatchRow({ match, competitionId, homeName, awayName }: { match: Match; competitionId: string; homeName: string; awayName: string }) {
  const { toast } = useToast();
  const [sh, setSh] = useState(String(match.scoreHome ?? ""));
  const [sa, setSa] = useState(String(match.scoreAway ?? ""));
  const [dt, setDt] = useState(toLocalInput(match.datetime as unknown as string));

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
  const schedule = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/matches/${match.id}`, { datetime: dt ? new Date(dt).toISOString() : null }),
    onSuccess: () => { invalidate(); toast({ title: "Date enregistrée" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/matches/${match.id}`),
    onSuccess: () => { invalidate(); toast({ title: "Match supprimé" }); },
  });

  const ng = match.numGames ?? 3;
  const rpg = match.roundsPerGame ?? 3;

  return (
    <Card className="p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium flex-1 text-right min-w-[6rem] truncate">{homeName}</span>
        <Input type="number" value={sh} onChange={(e) => setSh(e.target.value)} className="w-14 h-9 text-center" title="Affrontements gagnés" />
        <span className="text-muted-foreground">–</span>
        <Input type="number" value={sa} onChange={(e) => setSa(e.target.value)} className="w-14 h-9 text-center" title="Affrontements gagnés" />
        <span className="font-medium flex-1 min-w-[6rem] truncate">{awayName}</span>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
        <Button size="icon" variant="ghost" onClick={() => del.mutate()} title="Supprimer">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-1 text-xs text-muted-foreground">
        <span>{ng} affrontement{ng > 1 ? "s" : ""} · {rpg} manche{rpg > 1 ? "s" : ""}/affr.</span>
        {match.modifier && <span className="px-1.5 py-0.5 rounded bg-muted">Mod. : {match.modifier}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-1">
        <span className="text-xs text-muted-foreground">Date</span>
        <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="w-52 h-8" />
        <Button size="sm" variant="outline" disabled={schedule.isPending} onClick={() => schedule.mutate()}>Programmer</Button>
      </div>
    </Card>
  );
}

export default CompetitionMatchesPanel;
