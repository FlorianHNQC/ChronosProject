import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { UserRound } from "lucide-react";
import { PageHero } from "@/components/page-hero";

type AwardRow = { id: string; label: string; pseudo: string | null; avatarUrl: string | null; justification: string | null };

/**
 * Récompenses : awards de saison (par catégorie) et hebdomadaires (par date).
 */
export function AwardsPage() {
  const { data } = useQuery<{ weekly: AwardRow[]; season: AwardRow[] }>({ queryKey: ["/api/awards"] });
  const weekly = data?.weekly ?? [];
  const season = data?.season ?? [];

  return (
    <div className="w-full px-6 py-8">
      <PageHero title="Récompenses" subtitle="Palmarès" settingKey="hero_recompenses" defaultImage="/images/recompenses.webp" />

      <section className="mb-10">
        <h2 className="font-semibold mb-3">Awards de saison</h2>
        {season.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun award de saison.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {season.map((a) => (
              <Card key={a.id} className="p-4 flex items-center gap-3">
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.pseudo ?? ""} className="h-12 w-12 rounded-lg object-cover bg-muted" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center"><UserRound className="h-6 w-6 text-muted-foreground" /></div>
                )}
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-primary font-semibold">{a.label}</div>
                  <div className="font-bold truncate">{a.pseudo ?? "—"}</div>
                  {a.justification && <div className="text-xs text-muted-foreground truncate">{a.justification}</div>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Joueur de la semaine</h2>
        {weekly.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun award hebdomadaire.</p>
        ) : (
          <div className="space-y-2">
            {weekly.map((a) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.pseudo ?? ""} className="h-9 w-9 rounded object-cover bg-muted" />
                ) : (
                  <div className="h-9 w-9 rounded bg-muted flex items-center justify-center"><UserRound className="h-5 w-5 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.pseudo ?? "—"}</div>
                  {a.justification && <div className="text-xs text-muted-foreground truncate">{a.justification}</div>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{a.label}</span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default AwardsPage;
