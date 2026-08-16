import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompetitionMatchesPanel } from "@/components/admin/competition-matches-panel";
import type { Competition } from "@shared/schema";

/**
 * Console admin — matchs d'une compétition. Le contenu réel vit dans
 * CompetitionMatchesPanel, réutilisé par la page de gestion d'une compétition.
 */
export function MatchesAdminPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Matchs</h1>

      <div className="mb-6">
        <label className="text-sm text-muted-foreground mr-2">Compétition :</label>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">— choisir —</option>
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!competitionId ? (
        <p className="text-sm text-muted-foreground">Choisissez une compétition.</p>
      ) : (
        <CompetitionMatchesPanel competitionId={competitionId} />
      )}
    </div>
  );
}

export default MatchesAdminPage;
