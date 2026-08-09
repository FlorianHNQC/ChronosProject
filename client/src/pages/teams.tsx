import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { CompetitionSelect } from "@/components/competition-select";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { Star, UserRound, Users } from "lucide-react";
import type { Competition, Team } from "@shared/schema";

type RosterMember = {
  playerId: string; pseudo: string; avatarUrl: string | null;
  playerTag: string | null; elo: number | null; isCaptain: boolean | null;
};

const PAGE_SIZE = 8;

/**
 * Vue publique des équipes d'une compétition, avec leurs effectifs.
 */
export function TeamsPage({ competitionId: fixedId }: { competitionId?: string } = {}) {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [selectedId, setSelectedId] = useState("");
  const competitionId = fixedId ?? selectedId;
  const [page, setPage] = useState(1);

  // Sélectionne par défaut la première compétition active (sinon la première).
  useEffect(() => {
    if (fixedId || selectedId || !comps || comps.length === 0) return;
    const active = comps.find((c) => c.status === "active") ?? comps[0];
    if (active) setSelectedId(active.id);
  }, [comps, selectedId, fixedId]);

  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });

  useEffect(() => setPage(1), [competitionId]);
  const list = teams ?? [];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageSlice = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Équipes"
        icon={Users}
        actions={
          fixedId ? undefined : (
            <CompetitionSelect competitions={comps ?? []} value={selectedId} onValueChange={setSelectedId} />
          )
        }
      />

      {competitionId && isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucune équipe pour cette compétition"
          description="Les équipes engagées et leurs effectifs apparaîtront ici."
        />
      ) : (
        <>
          <div className="grid animate-fade-in-up animate-delay-100 grid-cols-1 gap-3 md:grid-cols-2">
            {pageSlice.map((t) => <PublicTeamCard key={t.id} team={t} />)}
          </div>
          <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />
        </>
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
    <Card className="p-4 hover-elevate">
      <div className="mb-3 flex items-center gap-2">
        {team.logoUrl && <img src={team.logoUrl} alt={team.name} className="h-7 w-7 rounded object-cover" />}
        <span className="font-semibold">{team.name}</span>
        <span className="text-xs text-muted-foreground">[{team.tag}]</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {(roster ?? []).map((m) => (
          <div key={m.playerId} className="flex w-[68px] flex-col items-center text-center">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-12 w-12 rounded-lg bg-muted object-cover ring-1 ring-border" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                <UserRound className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <span className="mt-1 flex w-full items-center justify-center gap-0.5 break-words text-xs font-medium leading-tight">
              {m.isCaptain && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />}
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
