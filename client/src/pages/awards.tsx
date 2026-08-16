import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHero } from "@/components/page-hero";
import { Trophy } from "lucide-react";
import { AwardTile, type AwardCard } from "@/components/award-tile";

/** Palmarès : awards de cérémonie, groupés par compétition (plus récente d'abord), animés. */
export function AwardsPage() {
  const { data: cards } = useQuery<AwardCard[]>({ queryKey: ["/api/palmares"] });

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { name: string; cards: AwardCard[] }>();
    for (const c of cards ?? []) {
      const key = c.competitionId ?? "none";
      if (!map.has(key)) {
        map.set(key, { name: c.competitionName ?? "Sans compétition", cards: [] });
        order.push(key);
      }
      map.get(key)!.cards.push(c);
    }
    return order.map((k) => map.get(k)!);
  }, [cards]);

  return (
    <div className="w-full px-6 py-8">
      <PageHero title="Récompenses" subtitle="Palmarès des cérémonies" settingKey="hero_recompenses" defaultImage="/images/recompenses.webp" />

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune récompense pour l'instant.</p>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{g.name}</h2>
              <span className="text-xs text-muted-foreground">· {g.cards.length} récompenses</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {g.cards.map((c, i) => (
                <AwardTile key={c.id} card={c} index={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default AwardsPage;
