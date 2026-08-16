import { useQuery } from "@tanstack/react-query";
import { AwardTile, type AwardCard } from "@/components/award-tile";

/** Récompenses d'une compétition (vue lecture, réutilise les tuiles animées). */
export function CompetitionAwards({ competitionId }: { competitionId: string }) {
  const { data: cards } = useQuery<AwardCard[]>({ queryKey: ["/api/palmares"] });
  const list = (cards ?? []).filter((c) => c.competitionId === competitionId);

  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune récompense pour cette compétition.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {list.map((c, i) => <AwardTile key={c.id} card={c} index={i} />)}
    </div>
  );
}

export default CompetitionAwards;
