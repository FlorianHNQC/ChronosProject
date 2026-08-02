import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { Award, UserRound, Medal } from "lucide-react";

type AwardRow = { id: string; label: string; pseudo: string | null; avatarUrl: string | null; justification: string | null };

const WEEKLY_PAGE = 10;

/**
 * Récompenses : awards de saison (par catégorie) et hebdomadaires (par date).
 */
export function AwardsPage() {
  const { data, isLoading } = useQuery<{ weekly: AwardRow[]; season: AwardRow[] }>({ queryKey: ["/api/awards"] });
  const weekly = data?.weekly ?? [];
  const season = data?.season ?? [];

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [weekly.length]);
  const pageCount = Math.max(1, Math.ceil(weekly.length / WEEKLY_PAGE));
  const safePage = Math.min(page, pageCount);
  const weeklySlice = weekly.slice((safePage - 1) * WEEKLY_PAGE, safePage * WEEKLY_PAGE);

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Récompenses"
        icon={Award}
        description="Palmarès de la saison et joueurs de la semaine."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          <section className="mb-10 animate-fade-in-up animate-delay-100">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Medal className="h-5 w-5 text-primary" /> Awards de saison
            </h2>
            {season.length === 0 ? (
              <EmptyState icon={Medal} title="Aucun award de saison" description="Les récompenses de saison seront décernées à la clôture." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {season.map((a) => (
                  <Card key={a.id} className="flex items-center gap-3 p-4 hover-elevate">
                    {a.avatarUrl ? (
                      <img src={a.avatarUrl} alt={a.pseudo ?? ""} className="h-12 w-12 rounded-lg bg-muted object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted"><UserRound className="h-6 w-6 text-muted-foreground" /></div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{a.label}</div>
                      <div className="truncate font-bold">{a.pseudo ?? "—"}</div>
                      {a.justification && <div className="truncate text-xs text-muted-foreground">{a.justification}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="animate-fade-in-up animate-delay-200">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Award className="h-5 w-5 text-primary" /> Joueur de la semaine
            </h2>
            {weekly.length === 0 ? (
              <EmptyState icon={Award} title="Aucun award hebdomadaire" description="Le joueur de la semaine sera mis en avant ici chaque semaine." />
            ) : (
              <>
                <div className="space-y-2">
                  {weeklySlice.map((a) => (
                    <Card key={a.id} className="flex items-center gap-3 p-3 hover-elevate">
                      {a.avatarUrl ? (
                        <img src={a.avatarUrl} alt={a.pseudo ?? ""} className="h-9 w-9 rounded bg-muted object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded bg-muted"><UserRound className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{a.pseudo ?? "—"}</div>
                        {a.justification && <div className="truncate text-xs text-muted-foreground">{a.justification}</div>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{a.label}</span>
                    </Card>
                  ))}
                </div>
                <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AwardsPage;
