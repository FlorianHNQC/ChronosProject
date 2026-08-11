import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { PageHero } from "@/components/page-hero";
import type { Player } from "@shared/schema";

/**
 * Annuaire public des joueurs (§8/§11 du CDC).
 * Pseudo + avatar synchronisés via l'API Brawl Stars ; tier/Elo affichés
 * quand le moteur de classement sera en place.
 */
export function PlayersPage() {
  const [q, setQ] = useState("");
  const [, navigate] = useLocation();
  const { data: players, isLoading, error } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const filtered = useMemo(() => {
    if (!players) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return players;
    return players.filter(
      (p) =>
        p.pseudo.toLowerCase().includes(needle) ||
        (p.playerTag ?? "").toLowerCase().includes(needle),
    );
  }, [players, q]);

  return (
    <div className="w-full px-6 py-8">
      <PageHero title="Joueurs" subtitle="Annuaire" image="/images/joueurs.webp" />
      <div className="flex items-center justify-end gap-4 mb-6">
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un pseudo ou un tag…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Erreur de chargement : {(error as Error).message}
        </p>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun joueur pour l'instant. Ajoutez-en depuis la console d'administration.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <Card key={p.id} onClick={() => navigate(`/joueurs/${p.id}`)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
            {p.avatarUrl ? (
              <img
                src={p.avatarUrl}
                alt={p.pseudo}
                className="h-12 w-12 rounded-md object-cover bg-muted"
                loading="lazy"
              />
            ) : (
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                <UserRound className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{p.pseudo}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.playerTag ?? "—"}
                {p.nationality ? ` · ${p.nationality}` : ""}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {p.elo ?? "—"}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PlayersPage;
