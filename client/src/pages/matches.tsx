import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MatchCalendar } from "@/components/match-calendar";
import type { Competition, Match, Team } from "@shared/schema";

/**
 * Calendrier & résultats — sélecteur de compétition + calendrier réutilisable
 * (vue mois par défaut, bascule liste).
 */
export function MatchesPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const pick = comps.find((c) => c.status === "active") ?? comps[0];
    if (pick) setCompetitionId(pick.id);
  }, [comps, competitionId]);

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

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">Calendrier & résultats</h1>
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <MatchCalendar matches={matches ?? []} teams={teams ?? []} />
    </div>
  );
}

export default MatchesPage;
