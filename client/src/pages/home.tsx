import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Sparkles, CalendarDays, BarChart3, Users, Trophy, UserRound } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import type { Competition, Player, Tier } from "@shared/schema";

const TILES = [
  { href: "/hydra", label: "Hydra — classement", icon: Sparkles },
  { href: "/calendrier", label: "Calendrier & résultats", icon: CalendarDays },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/equipes", label: "Équipes", icon: Users },
  { href: "/competitions", label: "Compétitions", icon: Trophy },
];

export function HomePage() {
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });

  const top = useMemo(
    () => [...(players ?? [])].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0)).slice(0, 8),
    [players],
  );
  const activeComp = (comps ?? []).find((c) => c.status === "active");

  return (
    <div className="w-full px-6 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">CHRONOS</h1>
        <p className="text-muted-foreground mt-1">Plateforme de la scène compétitive Brawl Stars.</p>
        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <span className="px-3 py-1 rounded-md bg-muted">{players?.length ?? 0} joueurs</span>
          <span className="px-3 py-1 rounded-md bg-muted">{comps?.length ?? 0} compétitions</span>
          {activeComp && (
            <Link href="/competitions" className="px-3 py-1 rounded-md bg-primary/10 text-primary">
              En cours : {activeComp.name}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 cursor-pointer">
              <t.icon className="h-6 w-6 text-primary" />
              <span className="font-semibold">{t.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Meilleurs joueurs</h2>
      <div className="flex flex-wrap gap-3">
        {top.map((p) => {
          const tier = tierForElo(p.elo ?? null, tiers ?? []);
          return (
            <Link key={p.id} href={`/joueurs/${p.id}`}>
              <div className="w-[92px] flex flex-col items-center text-center cursor-pointer">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.pseudo} className="h-16 w-16 rounded-lg object-cover bg-muted ring-1 ring-border" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border"><UserRound className="h-8 w-8 text-muted-foreground" /></div>
                )}
                <span className="mt-1 text-xs font-semibold leading-tight break-words w-full">{p.pseudo}</span>
                {tier && <span className="text-[10px] font-bold px-1.5 rounded text-white mt-0.5" style={{ backgroundColor: tier.color ?? "#666" }}>{tier.code}</span>}
              </div>
            </Link>
          );
        })}
        {top.length === 0 && <p className="text-sm text-muted-foreground">Aucun joueur pour l'instant.</p>}
      </div>
    </div>
  );
}

export default HomePage;
