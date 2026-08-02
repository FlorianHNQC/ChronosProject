import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { useToast } from "@/hooks/use-toast";
import { UserRound, ArrowLeft, Star, Link2, History } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import type { Player, Tier } from "@shared/schema";

type PlayerMatch = {
  matchId: string; datetime: string | null; gameMode: string | null;
  teamId: string; winnerId: string | null;
  kills: number; deaths: number; damage: number; victory: boolean;
  noteFinale: number; notePerf: number; impact: number;
};
type PlayerTeam = { teamId: string; name: string; tag: string; competitionId: string | null; isCaptain: boolean | null };
type PlayerTagRow = { playerId: string; tagId: string; label: string; color: string | null };

const HISTORY_PAGE = 15;

async function fetchMe(): Promise<{ role: string } | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: me } = useQuery<{ role: string } | null>({
    queryKey: ["/api/auth/me"], queryFn: fetchMe, retry: false, staleTime: 60_000,
  });
  const isAdmin = me?.role === "admin";

  const { data: player, isLoading: playerLoading } = useQuery<Player>({
    queryKey: ["/api/players", id, "one"],
    queryFn: async () => (await apiRequest("GET", `/api/players/${id}`)).json(),
  });
  const { data: history } = useQuery<PlayerMatch[]>({
    queryKey: ["/api/players", id, "matches"],
    queryFn: async () => (await apiRequest("GET", `/api/players/${id}/matches`)).json(),
  });
  const { data: teams } = useQuery<PlayerTeam[]>({
    queryKey: ["/api/players", id, "teams"],
    queryFn: async () => (await apiRequest("GET", `/api/players/${id}/teams`)).json(),
  });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: allTags } = useQuery<PlayerTagRow[]>({ queryKey: ["/api/player-tags"] });

  const tags = (allTags ?? []).filter((t) => t.playerId === id);
  const tier = tierForElo(player?.elo ?? null, tiers ?? []);

  const agg = useMemo(() => {
    const h = history ?? [];
    if (h.length === 0) return null;
    const sum = (f: (m: PlayerMatch) => number) => h.reduce((a, m) => a + f(m), 0);
    const wins = h.filter((m) => m.victory).length;
    return {
      played: h.length, wins,
      kills: sum((m) => m.kills), deaths: sum((m) => m.deaths), damage: sum((m) => m.damage),
      avgNote: sum((m) => m.noteFinale) / h.length,
      avgImpact: sum((m) => m.impact) / h.length,
    };
  }, [history]);

  const hist = history ?? [];
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [id]);
  const pageCount = Math.max(1, Math.ceil(hist.length / HISTORY_PAGE));
  const safePage = Math.min(page, pageCount);
  const histSlice = hist.slice((safePage - 1) * HISTORY_PAGE, safePage * HISTORY_PAGE);

  return (
    <div className="w-full px-6 py-8">
      <Link href="/joueurs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Joueurs
      </Link>

      {/* En-tête profil */}
      {playerLoading ? (
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-xl" />
          <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-56" /></div>
        </div>
      ) : (
        <div className="mb-4 flex animate-fade-in-up items-center gap-4">
          {player?.avatarUrl ? (
            <img src={player.avatarUrl} alt={player.pseudo} className="h-20 w-20 rounded-xl bg-muted object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted ring-1 ring-border"><UserRound className="h-10 w-10 text-muted-foreground" /></div>
          )}
          <div>
            <h1 className="text-2xl font-bold italic">{player?.pseudo ?? "…"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {tier && (
                <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: tier.color ?? "#666" }}>{tier.code}</span>
              )}
              <span className="text-sm text-muted-foreground">Elo {player?.elo ?? "—"}</span>
              {player?.playerTag && <span className="text-xs text-muted-foreground">{player.playerTag}</span>}
              {tags.map((t) => (
                <span key={t.tagId} className="text-[11px] font-medium" style={{ color: t.color ?? undefined }}>{t.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin uniquement : associer un compte Brawl Stars (préserve l'historique, met à jour l'avatar) */}
      {isAdmin && id && <LinkAccount playerId={id} linked={player?.playerTag ?? null} />}

      {/* Équipes */}
      {(teams ?? []).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(teams ?? []).map((t) => (
            <span key={t.teamId} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
              {t.isCaptain && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
              {t.name} <span className="text-muted-foreground">[{t.tag}]</span>
            </span>
          ))}
        </div>
      )}

      {/* Agrégats */}
      {agg && (
        <div className="mb-8 grid animate-fade-in-up animate-delay-100 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ["Matchs", agg.played],
            ["Victoires", `${agg.wins} (${Math.round((agg.wins / agg.played) * 100)}%)`],
            ["Note moy.", agg.avgNote.toFixed(2)],
            ["Impact moy.", agg.avgImpact.toFixed(2)],
            ["Kills", agg.kills],
            ["Dégâts", agg.damage.toLocaleString("fr-FR")],
          ].map(([label, val]) => (
            <Card key={String(label)} className="p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-bold">{val}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Historique */}
      <div className="animate-fade-in-up animate-delay-200">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <History className="h-5 w-5 text-primary" /> Historique
        </h2>
        {hist.length === 0 ? (
          <EmptyState icon={History} title="Aucun match enregistré" description="Les matchs joués par ce joueur apparaîtront ici." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-xs text-muted-foreground">
                    <th className="py-1.5 text-left">Date</th>
                    <th className="px-2 text-left">Mode</th>
                    <th className="px-2">Rés.</th>
                    <th className="px-2">K</th><th className="px-2">D</th>
                    <th className="px-2">Dég.</th><th className="px-2">Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {histSlice.map((m) => (
                    <tr key={m.matchId} className="border-b text-right last:border-0">
                      <td className="py-1.5 text-left">{m.datetime ? new Date(m.datetime).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="px-2 text-left">{m.gameMode ?? "—"}</td>
                      <td className={"px-2 font-medium " + (m.victory ? "text-green-500" : "text-red-500")}>{m.victory ? "V" : "D"}</td>
                      <td className="px-2">{m.kills}</td>
                      <td className="px-2">{m.deaths}</td>
                      <td className="px-2">{m.damage.toLocaleString("fr-FR")}</td>
                      <td className="px-2 font-semibold">{m.noteFinale.toFixed(2)}</td>
                      <td className="px-2"><Link href={`/matchs/${m.matchId}`} className="text-primary hover:underline">détail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

/** Contrôle admin : lier / mettre à jour le compte Brawl Stars du joueur. */
function LinkAccount({ playerId, linked }: { playerId: string; linked: string | null }) {
  const { toast } = useToast();
  const [tag, setTag] = useState("");

  const link = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/players/${playerId}/link`, { tag })).json(),
    onSuccess: () => {
      setTag("");
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "one"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      toast({ title: "Compte associé", description: "Pseudo et avatar synchronisés." });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="mb-6 max-w-lg p-3">
      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        {linked ? `Compte lié : ${linked} — ré-associer / mettre à jour :` : "Admin — associer un compte Brawl Stars (l'historique est conservé) :"}
      </div>
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) link.mutate(); }}>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-muted-foreground">#</span>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="2PP0LG" className="h-9 pl-7 uppercase" />
        </div>
        <Button type="submit" size="sm" disabled={link.isPending || !tag.trim()}>
          {link.isPending ? "…" : "Lier"}
        </Button>
      </form>
    </Card>
  );
}

export default PlayerProfilePage;
