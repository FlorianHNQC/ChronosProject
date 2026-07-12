import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bracket } from "@/components/bracket";
import { Trophy } from "lucide-react";
import type { Competition, PlayoffSeries, Team } from "@shared/schema";

/**
 * Playoffs d'une compétition, affichés en grille (bracket).
 */
export function PlayoffsPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const pick = comps.find((c) => c.status === "active") ?? comps.find((c) => c.status === "archived") ?? comps[0];
    if (pick) setCompetitionId(pick.id);
  }, [comps, competitionId]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });
  const { data: series } = useQuery<PlayoffSeries[]>({
    queryKey: ["/api/playoffs", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/playoffs?competitionId=${competitionId}`)).json(),
  });

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return (id: string | null, label: string | null) =>
      id ? m.get(id) ?? label ?? "?" : label ?? "À déterminer";
  }, [teams]);

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Playoffs</h1>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Bracket series={series ?? []} teamName={teamName} />
    </div>
  );
}

export default PlayoffsPage;
