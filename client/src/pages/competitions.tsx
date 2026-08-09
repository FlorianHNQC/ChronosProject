import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Trophy, Archive } from "lucide-react";
import type { Competition } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  league: "Ligue", tournament: "Tournoi", swiss: "Suisse",
  round_robin: "Round robin", groups: "Poules", scrim: "Scrim", event: "Événement",
};

function CompetitionCard({ c, archived = false }: { c: Competition; archived?: boolean }) {
  return (
    <Link href={`/competitions/${c.id}`} className="block">
    <Card className={`p-4 hover-elevate ${archived ? "opacity-90" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{c.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{TYPE_LABELS[c.type] ?? c.type}</Badge>
            {c.isCompetitive ? <Badge variant="outline">Compétitive</Badge> : null}
            {c.affectsElo ? <Badge variant="outline">Elo</Badge> : null}
          </div>
        </div>
        {archived ? (
          <Badge variant="secondary" className="shrink-0">Archivée</Badge>
        ) : (
          <Badge className="shrink-0">En cours</Badge>
        )}
      </div>
      {archived && c.closedAt ? (
        <div className="mt-3 text-xs text-muted-foreground">
          Clôturée le {new Date(c.closedAt).toLocaleDateString("fr-FR")}
        </div>
      ) : null}
    </Card>
    </Link>
  );
}

/**
 * Vue publique des compétitions : celles en cours et l'historique (archivées).
 * Les brouillons ne sont pas exposés. Les données archivées sont historiques.
 */
export function CompetitionsPage() {
  const { data: comps, isLoading } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });

  const active = (comps ?? []).filter((c) => c.status === "active");
  const archived = (comps ?? []).filter((c) => c.status === "archived");

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Compétitions"
        icon={Trophy}
        description="Ligues et tournois de la communauté Chronos."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="mb-8 animate-fade-in-up animate-delay-100">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Trophy className="h-5 w-5 text-primary" /> En cours
            </h2>
            {active.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Aucune compétition en cours"
                description="Les compétitions actives apparaîtront ici dès qu'une édition sera lancée."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((c) => <CompetitionCard key={c.id} c={c} />)}
              </div>
            )}
          </section>

          <section className="animate-fade-in-up animate-delay-200">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Archive className="h-5 w-5 text-muted-foreground" /> Historique
            </h2>
            {archived.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="Aucune édition archivée"
                description="Les compétitions clôturées seront conservées ici comme historique."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((c) => <CompetitionCard key={c.id} c={c} archived />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default CompetitionsPage;
