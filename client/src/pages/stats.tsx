import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserRound } from "lucide-react";
import type { Competition } from "@shared/schema";

type PlayerAgg = {
  playerId: string; pseudo: string; avatarUrl: string | null;
  matchesPlayed: number; wins: number;
  totalKills: number; totalDeaths: number; totalDamage: number;
  totalGoals: number; totalAssists: number; totalStarPlayer: number;
  avgNoteFinale: number; avgNotePerf: number; avgImpact: number;
};

const SORTS: { key: keyof PlayerAgg; label: string }[] = [
  { key: "avgNoteFinale", label: "Note finale" },
  { key: "avgImpact", label: "Impact" },
  { key: "totalKills", label: "Kills" },
  { key: "totalDamage", label: "Dégâts" },
  { key: "totalStarPlayer", label: "MVP" },
  { key: "matchesPlayed", label: "Matchs" },
];

/**
 * Classements de statistiques par joueur (agrégés depuis match_player_stats).
 */
export function StatsPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");
  const [sortKey, setSortKey] = useState<keyof PlayerAgg>("avgNoteFinale");

  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const active = comps.find((c) => c.status === "active") ?? comps[0];
    if (active) setCompetitionId(active.id);
  }, [comps, competitionId]);

  const { data: stats } = useQuery<PlayerAgg[]>({
    queryKey: ["/api/stats/season", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/stats/season?competitionId=${competitionId}`)).json(),
  });

  const rows = useMemo(() => {
    const list = [...(stats ?? [])];
    list.sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));
    return list;
  }, [stats, sortKey]);

  const num = (n: number) => (Number.isFinite(n) ? n : 0);
  const fx = (n: number) => num(n).toFixed(2);
  const kd = (k: number, d: number) => (k / Math.max(d, 1)).toFixed(2);

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">Classements de stats</h1>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Trier par</span>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as keyof PlayerAgg)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune statistique pour cette compétition.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2 w-10">#</th>
                <th className="py-2 pr-2">Joueur</th>
                <th className="py-2 px-2 text-right">M</th>
                <th className="py-2 px-2 text-right">Note</th>
                <th className="py-2 px-2 text-right">Perf</th>
                <th className="py-2 px-2 text-right">Impact</th>
                <th className="py-2 px-2 text-right">K</th>
                <th className="py-2 px-2 text-right">D</th>
                <th className="py-2 px-2 text-right">K/D</th>
                <th className="py-2 px-2 text-right">Dégâts</th>
                <th className="py-2 px-2 text-right">Buts</th>
                <th className="py-2 px-2 text-right">Ast</th>
                <th className="py-2 px-2 text-right">MVP</th>
                <th className="py-2 px-2 text-right">Win%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.playerId} className="border-b hover:bg-muted/40">
                  <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.pseudo} className="h-7 w-7 rounded object-cover bg-muted" />
                      ) : (
                        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center"><UserRound className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <span className="font-medium">{p.pseudo}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right">{p.matchesPlayed}</td>
                  <td className="py-1.5 px-2 text-right font-semibold">{fx(p.avgNoteFinale)}</td>
                  <td className="py-1.5 px-2 text-right">{fx(p.avgNotePerf)}</td>
                  <td className="py-1.5 px-2 text-right">{fx(p.avgImpact)}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalKills}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalDeaths}</td>
                  <td className="py-1.5 px-2 text-right">{kd(p.totalKills, p.totalDeaths)}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalDamage.toLocaleString("fr-FR")}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalGoals}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalAssists}</td>
                  <td className="py-1.5 px-2 text-right">{p.totalStarPlayer}</td>
                  <td className="py-1.5 px-2 text-right">
                    {p.matchesPlayed ? Math.round((p.wins / p.matchesPlayed) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StatsPage;
