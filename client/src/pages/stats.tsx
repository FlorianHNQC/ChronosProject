import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CompetitionSelect } from "@/components/competition-select";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { BarChart3, UserRound } from "lucide-react";
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

const PAGE_SIZE = 25;

/**
 * Classements de statistiques par joueur (agrégés depuis match_player_stats).
 */
export function StatsPage() {
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [competitionId, setCompetitionId] = useState("");
  const [sortKey, setSortKey] = useState<keyof PlayerAgg>("avgNoteFinale");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (competitionId || !comps || comps.length === 0) return;
    const active = comps.find((c) => c.status === "active") ?? comps[0];
    if (active) setCompetitionId(active.id);
  }, [comps, competitionId]);

  const { data: stats, isLoading } = useQuery<PlayerAgg[]>({
    queryKey: ["/api/stats/season", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/stats/season?competitionId=${competitionId}`)).json(),
  });

  const rows = useMemo(() => {
    const list = [...(stats ?? [])];
    list.sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));
    return list;
  }, [stats, sortKey]);

  // Changer de compétition ou de tri renvoie en page 1.
  useEffect(() => setPage(1), [competitionId, sortKey]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(offset, offset + PAGE_SIZE);

  const num = (n: number) => (Number.isFinite(n) ? n : 0);
  const fx = (n: number) => num(n).toFixed(2);
  const kd = (k: number, d: number) => (k / Math.max(d, 1)).toFixed(2);

  // En-tête de colonne cliquable pour trier (les colonnes présentes dans SORTS).
  const sortableKeys = new Set<keyof PlayerAgg>(SORTS.map((s) => s.key));
  const Th = ({ col, label, k }: { col?: keyof PlayerAgg; label: string; k?: string }) => {
    const sortable = col && sortableKeys.has(col);
    const active = col && sortKey === col;
    return (
      <th
        className={`px-2 py-2 text-right ${sortable ? "cursor-pointer select-none hover:text-foreground" : ""} ${active ? "text-primary" : ""} ${k ?? ""}`}
        onClick={sortable ? () => setSortKey(col!) : undefined}
      >
        {label}{active ? " ▾" : ""}
      </th>
    );
  };

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Classements de stats"
        icon={BarChart3}
        actions={
          <>
            <CompetitionSelect competitions={comps ?? []} value={competitionId} onValueChange={setCompetitionId} />
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as keyof PlayerAgg)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {competitionId && isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Aucune statistique pour cette compétition"
          description="Les classements par joueur apparaîtront ici une fois des stats de match enregistrées."
        />
      ) : (
        <>
          <div className="animate-fade-in-up animate-delay-100 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-10 py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Joueur</th>
                  <Th col="matchesPlayed" label="M" k="w-10" />
                  <Th col="avgNoteFinale" label="Note" />
                  <Th col="avgNotePerf" label="Perf" />
                  <Th col="avgImpact" label="Impact" />
                  <Th col="totalKills" label="K" />
                  <th className="px-2 py-2 text-right">D</th>
                  <th className="px-2 py-2 text-right">K/D</th>
                  <Th col="totalDamage" label="Dégâts" />
                  <th className="px-2 py-2 text-right">Buts</th>
                  <th className="px-2 py-2 text-right">Ast</th>
                  <Th col="totalStarPlayer" label="MVP" />
                  <th className="px-2 py-2 text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p, i) => (
                  <tr
                    key={p.playerId}
                    onClick={() => navigate(`/joueurs/${p.playerId}`)}
                    className="cursor-pointer border-b hover:bg-muted/40"
                  >
                    <td className="py-1.5 pr-2 text-muted-foreground">{offset + i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.pseudo} className="h-7 w-7 rounded bg-muted object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-muted"><UserRound className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <span className="font-medium">{p.pseudo}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">{p.matchesPlayed}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fx(p.avgNoteFinale)}</td>
                    <td className="px-2 py-1.5 text-right">{fx(p.avgNotePerf)}</td>
                    <td className="px-2 py-1.5 text-right">{fx(p.avgImpact)}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalKills}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalDeaths}</td>
                    <td className="px-2 py-1.5 text-right">{kd(p.totalKills, p.totalDeaths)}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalDamage.toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalGoals}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalAssists}</td>
                    <td className="px-2 py-1.5 text-right">{p.totalStarPlayer}</td>
                    <td className="px-2 py-1.5 text-right">
                      {p.matchesPlayed ? Math.round((p.wins / p.matchesPlayed) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default StatsPage;
