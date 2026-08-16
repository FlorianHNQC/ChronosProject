import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserRound, ArrowLeft, Star, Link2, Pencil } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import { useMe } from "@/hooks/use-me";
import type { Player, Tier } from "@shared/schema";

type PlayerMatch = {
  matchId: string; datetime: string | null; gameMode: string | null;
  teamId: string; winnerId: string | null;
  kills: number; deaths: number; damage: number; victory: boolean;
  noteFinale: number; notePerf: number; impact: number; eloDelta: number | null;
};
type PlayerTeam = { teamId: string; name: string; tag: string; competitionId: string | null; isCaptain: boolean | null };
type PlayerTagRow = {
  playerId: string; tagId: string; label: string; color: string | null;
  family?: "palmares" | "comportement"; awardedAt?: string | null;
};

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: player } = useQuery<Player>({
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

  // Palmarès groupé par année (les tags se réinitialisent chaque saison annuelle).
  const palmaresByYear = useMemo(() => {
    const palmares = tags.filter((t) => t.family !== "comportement");
    const groups = new Map<string, PlayerTagRow[]>();
    for (const t of palmares) {
      const y = t.awardedAt ? String(new Date(t.awardedAt).getFullYear()) : "—";
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(t);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tags]);
  const behaviorTags = tags.filter((t) => t.family === "comportement");

  const { isAdmin } = useMe();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [nationality, setNationality] = useState("");
  const saveProfile = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/players/${id}`, { pseudo, nationality }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players", id, "one"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setEditing(false);
      toast({ title: "Profil mis à jour" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

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

  return (
    <div className="w-full px-6 py-8">
      <Link href="/joueurs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Joueurs
      </Link>

      {/* En-tête profil */}
      <div className="flex items-center gap-4 mb-4">
        {player?.avatarUrl ? (
          <img src={player.avatarUrl} alt={player.pseudo} className="h-20 w-20 rounded-xl object-cover bg-muted ring-1 ring-border" />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border"><UserRound className="h-10 w-10 text-muted-foreground" /></div>
        )}
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo" className="h-9 w-48" />
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Nationalité (ex. BJ)" className="h-9 w-36" />
              <Button size="sm" disabled={saveProfile.isPending || !pseudo.trim()} onClick={() => saveProfile.mutate()}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{player?.pseudo ?? "…"}</h1>
              {isAdmin && (
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier le profil"
                  onClick={() => { setPseudo(player?.pseudo ?? ""); setNationality(player?.nationality ?? ""); setEditing(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {player?.nationality && <span className="text-xs text-muted-foreground">{player.nationality}</span>}
            {tier && (
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: tier.color ?? "#666" }}>{tier.code}</span>
            )}
            <span className="text-sm text-muted-foreground">Elo {player?.elo ?? "—"}</span>
            {player?.playerTag && <span className="text-xs text-muted-foreground">{player.playerTag}</span>}
            {behaviorTags.map((t) => (
              <span key={t.tagId} className="text-[11px] font-medium" style={{ color: t.color ?? undefined }}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Palmarès — groupé par année (réinitialisation annuelle) */}
      {palmaresByYear.length > 0 && (
        <div className="mb-6 space-y-1.5">
          {palmaresByYear.map(([year, list]) => (
            <div key={year} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0 tabular-nums">{year}</span>
              <div className="flex flex-wrap gap-1.5">
                {list.map((t) => (
                  <span key={t.tagId} className="text-[11px] font-medium px-2 py-0.5 rounded text-white" style={{ backgroundColor: t.color ?? "#666" }}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin : associer un compte Brawl Stars (préserve l'historique, met à jour l'avatar) */}
      {id && <LinkAccount playerId={id} linked={player?.playerTag ?? null} />}

      {/* Équipes */}
      {(teams ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(teams ?? []).map((t) => (
            <span key={t.teamId} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
              {t.isCaptain && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
              {t.name} <span className="text-muted-foreground">[{t.tag}]</span>
            </span>
          ))}
        </div>
      )}

      {/* Agrégats */}
      {agg && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-8">
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
      <h2 className="font-semibold mb-2">Historique</h2>
      {(history ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun match enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-right border-b">
                <th className="text-left py-1.5">Date</th>
                <th className="text-left px-2">Mode</th>
                <th className="px-2">Rés.</th>
                <th className="px-2">Elo</th>
                <th className="px-2">K</th><th className="px-2">D</th>
                <th className="px-2">Dég.</th><th className="px-2">Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).map((m) => (
                <tr key={m.matchId} className="border-b last:border-0 text-right">
                  <td className="text-left py-1.5">{m.datetime ? new Date(m.datetime).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="text-left px-2">{m.gameMode ?? "—"}</td>
                  <td className={"px-2 font-medium " + (m.victory ? "text-green-500" : "text-red-500")}>{m.victory ? "V" : "D"}</td>
                  <td className="px-2 font-semibold tabular-nums"><EloDelta delta={m.eloDelta} /></td>
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
      )}
    </div>
  );
}

/** Variation d'Elo d'un match : +X vert, -X rouge, 0 discret (match non compétitif). */
function EloDelta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return <span className="text-muted-foreground" title="Match hors classement Elo">0</span>;
  const pos = delta > 0;
  return (
    <span className={pos ? "text-green-500" : "text-red-500"}>
      {pos ? "+" : ""}{delta}
    </span>
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
    <Card className="p-3 mb-6 max-w-lg">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <Link2 className="h-3.5 w-3.5" />
        {linked ? `Compte lié : ${linked} — ré-associer / mettre à jour :` : "Admin — associer un compte Brawl Stars (l'historique est conservé) :"}
      </div>
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) link.mutate(); }}>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none pointer-events-none">#</span>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="2PP0LG" className="pl-7 uppercase h-9" />
        </div>
        <Button type="submit" size="sm" disabled={link.isPending || !tag.trim()}>
          {link.isPending ? "…" : "Lier"}
        </Button>
      </form>
    </Card>
  );
}

export default PlayerProfilePage;
