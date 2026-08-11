import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Trophy, Archive, ChevronRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import type { Competition } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  league: "Ligue", tournament: "Tournoi", swiss: "Suisse",
  round_robin: "Round robin", groups: "Poules", scrim: "Scrim", event: "Événement",
};

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
      <PageHero title="Compétitions" subtitle="Ligues & tournois" image="/images/competitions.webp" />

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <section className="mb-8">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> En cours
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune compétition en cours.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((c) => (
              <Link key={c.id} href={`/competitions/${c.id}`}>
                <Card className="group p-4 cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="font-semibold flex items-center justify-between gap-2">
                    {c.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" /> Historique
        </h2>
        {archived.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune édition archivée pour l'instant.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {archived.map((c) => (
              <Link key={c.id} href={`/competitions/${c.id}`}>
                <Card className="group p-4 opacity-90 cursor-pointer hover:opacity-100 hover:border-primary/50 transition-all">
                  <div className="font-semibold flex items-center justify-between gap-2">
                    {c.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {TYPE_LABELS[c.type] ?? c.type}
                    {c.closedAt ? ` · clôturée le ${new Date(c.closedAt).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default CompetitionsPage;
