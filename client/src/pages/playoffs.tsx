import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bracket } from "@/components/bracket";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { CompetitionSelect } from "@/components/competition-select";
import { EmptyState } from "@/components/empty-state";
import { Trophy, LayoutList } from "lucide-react";
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
  const { data: series, isLoading: seriesLoading } = useQuery<PlayoffSeries[]>({
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

  const hasSeries = (series ?? []).length > 0;

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Playoffs"
        icon={Trophy}
        actions={
          <CompetitionSelect competitions={comps ?? []} value={competitionId} onValueChange={setCompetitionId} />
        }
      />

      {competitionId && seriesLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !hasSeries ? (
        <EmptyState
          icon={LayoutList}
          title="Pas encore de bracket"
          description="La grille des playoffs s'affichera ici une fois les séries initialisées pour cette compétition."
        />
      ) : (
        <Bracket series={series ?? []} teamName={teamName} />
      )}
    </div>
  );
}

export default PlayoffsPage;
