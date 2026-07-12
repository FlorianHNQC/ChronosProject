import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Star, UserRound } from "lucide-react";
import type { Competition, Team } from "@shared/schema";

type RosterMember = {
  playerId: string; pseudo: string; avatarUrl: string | null;
  playerTag: string | null; elo: number | null; isCaptain: boolean | null;
};

/**
 * Vue publique des équipes d'une compétition, avec leurs effectifs.
 */
export function TeamsPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

  // Sélectionne par défaut la première compétition active (sinon la première).
  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const active = comps.find((c) => c.status === "active") ?? comps[0];
    if (active) setCompetitionId(active.id);
  }, [comps, competitionId]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">Équipes</h1>
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {(comps ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {(teams ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune équipe pour cette compétition.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(teams ?? []).map((t) => (
            <PublicTeamCard key={t.id} team={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicTeamCard({ team }: { team: Team }) {
  const { data: roster } = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", team.id, "roster"],
    queryFn: async () => (await apiRequest("GET", `/api/teams/${team.id}/roster`)).json(),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {team.logoUrl && <img src={team.logoUrl} alt={team.name} className="h-7 w-7 rounded object-cover" />}
        <span className="font-semibold">{team.name}</span>
        <span className="text-xs text-muted-foreground">[{team.tag}]</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {(roster ?? []).map((m) => (
          <div key={m.playerId} className="w-[68px] flex flex-col items-center text-center">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-12 w-12 rounded-lg object-cover bg-muted ring-1 ring-border" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border">
                <UserRound className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <span className="mt-1 text-xs font-medium leading-tight break-words w-full flex items-center justify-center gap-0.5">
              {m.isCaptain && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
              {m.pseudo}
            </span>
          </div>
        ))}
        {(roster ?? []).length === 0 && <span className="text-xs text-muted-foreground">Effectif vide.</span>}
      </div>
    </Card>
  );
}

export default TeamsPage;
