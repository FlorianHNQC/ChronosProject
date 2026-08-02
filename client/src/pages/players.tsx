import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { Search, UserRound, Swords } from "lucide-react";
import { useLocation } from "wouter";
import type { Player } from "@shared/schema";

/** Pseudo des profils créés automatiquement mais non encore liés à un joueur réel. */
const UNKNOWN = "(joueur inconnu)";
const isUnknown = (p: Player) => p.pseudo === UNKNOWN;
const PAGE_SIZE = 24;

/**
 * Annuaire public des joueurs (§8/§11 du CDC).
 * Pseudo + avatar synchronisés via l'API Brawl Stars ; Elo affiché par le moteur de classement.
 * Les profils « inconnus » (non liés) sont masqués par défaut derrière un interrupteur.
 */
export function PlayersPage() {
  const [q, setQ] = useState("");
  const [showUnknown, setShowUnknown] = useState(false);
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const { data: players, isLoading, error } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const knownCount = useMemo(() => (players ?? []).filter((p) => !isUnknown(p)).length, [players]);
  const unknownCount = (players?.length ?? 0) - knownCount;

  const shown = useMemo(() => {
    if (!players) return [];
    const needle = q.trim().toLowerCase();
    return players
      .filter((p) => showUnknown || !isUnknown(p))
      .filter(
        (p) =>
          !needle ||
          p.pseudo.toLowerCase().includes(needle) ||
          (p.playerTag ?? "").toLowerCase().includes(needle),
      );
  }, [players, q, showUnknown]);

  // La recherche / le filtre modifient le nombre de résultats → on revient page 1.
  useEffect(() => setPage(1), [q, showUnknown]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageSlice = shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="w-full px-6 py-8">
      <PageHeader
        title="Joueurs"
        icon={Swords}
        description={
          players
            ? `${knownCount} joueurs référencés${unknownCount ? ` · ${unknownCount} profils non liés` : ""}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {unknownCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch id="show-unknown" checked={showUnknown} onCheckedChange={setShowUnknown} />
                <Label htmlFor="show-unknown" className="whitespace-nowrap text-sm text-muted-foreground">
                  Profils non liés
                </Label>
              </div>
            )}
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un pseudo ou un tag…"
                className="pl-9"
              />
            </div>
          </div>
        }
      />

      {error && (
        <p className="text-sm text-destructive">Erreur de chargement : {(error as Error).message}</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full" />)}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title={q ? "Aucun joueur trouvé" : "Aucun joueur pour l'instant"}
          description={
            q ? "Essayez un autre pseudo ou tag." : "Ajoutez des joueurs depuis la console d'administration."
          }
        />
      ) : (
        <>
          <div className="grid animate-fade-in-up animate-delay-100 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageSlice.map((p) => {
              const unknown = isUnknown(p);
              return (
                <Card
                  key={p.id}
                  onClick={() => navigate(`/joueurs/${p.id}`)}
                  className={`flex cursor-pointer items-center gap-3 p-3 hover-elevate ${unknown ? "opacity-70" : ""}`}
                >
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt={p.pseudo}
                      className="h-12 w-12 rounded-md bg-muted object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                      <UserRound className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.pseudo}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.playerTag ?? "—"}
                      {p.nationality ? ` · ${p.nationality}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-mono">
                    {p.elo ?? "—"}
                  </Badge>
                </Card>
              );
            })}
          </div>
          <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default PlayersPage;
