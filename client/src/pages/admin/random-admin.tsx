import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RandomTournamentPanel } from "@/components/admin/random-tournament-panel";
import type { Competition } from "@shared/schema";

/**
 * Console admin — tournoi à équipes aléatoires. Le contenu réel vit dans
 * RandomTournamentPanel, réutilisé par la page de gestion d'une compétition.
 */
export function RandomAdminPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [cid, setCid] = useState("");
  useEffect(() => { if (!cid && comps && comps.length) setCid(comps[0].id); }, [comps, cid]);

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">Tournoi à équipes aléatoires</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Pool de joueurs, tirage automatique de trios 3v3 par tour, classement individuel. Non lié à l'Elo.
      </p>

      <select value={cid} onChange={(e) => setCid(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm mb-6">
        {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {cid && <RandomTournamentPanel competitionId={cid} />}
    </div>
  );
}

export default RandomAdminPage;
