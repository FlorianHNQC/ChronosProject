import { useMemo } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { UserRound } from "lucide-react";

export type PouleEntrant = { playerId: string; pseudo: string; avatarUrl: string | null; poolLabel?: string | null };
export type PouleRecord = { playerId: string; wins: number; losses: number; gamesWon: number; gamesLost: number };

/**
 * Poules de JOUEURS (tournoi solo/aléatoire) : chaque poule liste ses joueurs
 * avec leur bilan individuel (V/D), classés. Les joueurs s'affrontant au sein
 * d'une même poule, on voit clairement qui est où.
 */
export function PlayerPoules({ entrants, records }: { entrants: PouleEntrant[]; records?: PouleRecord[] }) {
  const rec = useMemo(() => new Map((records ?? []).map((r) => [r.playerId, r])), [records]);

  const poules = useMemo(() => {
    const by = new Map<string, PouleEntrant[]>();
    for (const e of entrants) {
      const key = (e.poolLabel ?? "").trim();
      if (!key) continue;
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(e);
    }
    return Array.from(by.entries())
      .map(([label, list]) => ({
        label,
        players: [...list].sort((a, b) => {
          const ra = rec.get(a.playerId), rb = rec.get(b.playerId);
          return (rb?.wins ?? 0) - (ra?.wins ?? 0) || a.pseudo.localeCompare(b.pseudo);
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
  }, [entrants, rec]);

  const unassigned = entrants.filter((e) => !(e.poolLabel ?? "").trim());

  if (poules.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune poule définie pour les joueurs.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {poules.map((p) => (
        <Card key={p.label} className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">Poule {p.label}</span>
            <span className="text-xs text-muted-foreground">{p.players.length} joueurs</span>
          </div>
          <div className="space-y-1">
            {p.players.map((pl, i) => {
              const r = rec.get(pl.playerId);
              return (
                <div key={pl.playerId} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  {pl.avatarUrl ? (
                    <img src={pl.avatarUrl} alt={pl.pseudo} className="h-6 w-6 rounded object-cover bg-muted ring-1 ring-border" />
                  ) : (
                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center ring-1 ring-border"><UserRound className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  )}
                  <Link href={`/joueurs/${pl.playerId}`} className="text-sm flex-1 truncate hover:text-primary hover:underline">{pl.pseudo}</Link>
                  {r && <span className="text-xs tabular-nums text-muted-foreground">{r.wins}V · {r.losses}D</span>}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {unassigned.length > 0 && (
        <p className="text-xs text-muted-foreground sm:col-span-2">Sans poule : {unassigned.map((e) => e.pseudo).join(", ")}</p>
      )}
    </div>
  );
}

export default PlayerPoules;
