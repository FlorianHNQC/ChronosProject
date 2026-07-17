import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Sparkles, CalendarDays, BarChart3, Users, Trophy, UserRound,
  Swords, Award, Flag, Medal, Rocket, ArrowRight, History,
} from "lucide-react";
import type { Competition, Player, Match, Team } from "@shared/schema";

type AwardRow = { id: string; label: string; pseudo: string | null; avatarUrl: string | null; justification: string | null };

/** Raccourcis vers les pages de la communauté (Hydra = simple raccourci, pas de classement ici). */
const SHORTCUTS = [
  { href: "/hydra", label: "Hydra", desc: "Classement par tiers", icon: Sparkles },
  { href: "/calendrier", label: "Calendrier & résultats", desc: "Matchs à venir et passés", icon: CalendarDays },
  { href: "/competitions", label: "Compétitions", desc: "Ligues & tournois", icon: Trophy },
  { href: "/playoffs", label: "Playoffs", desc: "Grille des séries", icon: Medal },
  { href: "/equipes", label: "Équipes", desc: "Rosters", icon: Users },
  { href: "/joueurs", label: "Joueurs", desc: "Annuaire", icon: UserRound },
  { href: "/stats", label: "Statistiques", desc: "Classements & agrégats", icon: BarChart3 },
  { href: "/recompenses", label: "Récompenses", desc: "Palmarès", icon: Award },
];

type Ev = {
  id: string;
  date: Date;
  icon: typeof Swords;
  color: string;
  title: string;
  subtitle?: string;
  href: string;
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
const ts = (v: unknown) => (v ? new Date(v as string).getTime() : 0);

export function HomePage() {
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: matches } = useQuery<Match[]>({ queryKey: ["/api/matches"] });
  const { data: awards } = useQuery<{ weekly: AwardRow[]; season: AwardRow[] }>({ queryKey: ["/api/awards"] });

  const teamName = useMemo(() => {
    const m = new Map((teams ?? []).map((t) => [t.id, t.name]));
    return (id?: string | null) => (id ? m.get(id) ?? "?" : "?");
  }, [teams]);
  const compName = useMemo(() => {
    const m = new Map((comps ?? []).map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? m.get(id) ?? "" : "");
  }, [comps]);

  const activeComp = (comps ?? []).find((c) => c.status === "active");

  const events = useMemo<Ev[]>(() => {
    const evs: Ev[] = [];
    const now = Date.now();

    for (const c of comps ?? []) {
      if (c.createdAt)
        evs.push({ id: `comp-new-${c.id}`, date: new Date(c.createdAt), icon: Rocket, color: "#6366f1", title: "Compétition lancée", subtitle: c.name, href: "/competitions" });
      if (c.closedAt)
        evs.push({ id: `comp-close-${c.id}`, date: new Date(c.closedAt), icon: Flag, color: "#ef4444", title: "Compétition clôturée", subtitle: c.name, href: "/competitions" });
    }

    for (const a of awards?.weekly ?? []) {
      const d = a.label ? new Date(a.label) : null;
      if (d && !isNaN(d.getTime()))
        evs.push({ id: `wk-${a.id}`, date: d, icon: Award, color: "#f59e0b", title: "Joueur de la semaine", subtitle: a.pseudo ?? undefined, href: "/recompenses" });
    }

    // Résultats récents (10 derniers matchs terminés)
    const done = (matches ?? [])
      .filter((m) => m.status === "completed")
      .sort((a, b) => (ts(b.datetime) || ts(b.createdAt)) - (ts(a.datetime) || ts(a.createdAt)))
      .slice(0, 10);
    for (const m of done) {
      const d = m.datetime ? new Date(m.datetime) : m.createdAt ? new Date(m.createdAt) : null;
      if (!d) continue;
      evs.push({
        id: `res-${m.id}`, date: d, icon: Swords, color: "#10b981",
        title: `${teamName(m.teamHomeId)} ${m.scoreHome ?? 0}–${m.scoreAway ?? 0} ${teamName(m.teamAwayId)}`,
        subtitle: compName(m.competitionId) || undefined, href: `/matchs/${m.id}`,
      });
    }

    // Matchs à venir (6 prochains)
    const upcoming = (matches ?? [])
      .filter((m) => m.status !== "completed" && m.status !== "cancelled" && m.datetime && ts(m.datetime) >= now)
      .sort((a, b) => ts(a.datetime) - ts(b.datetime))
      .slice(0, 6);
    for (const m of upcoming) {
      evs.push({
        id: `up-${m.id}`, date: new Date(m.datetime as unknown as string), icon: Swords, color: "#3b82f6",
        title: `${teamName(m.teamHomeId)} vs ${teamName(m.teamAwayId)}`,
        subtitle: compName(m.competitionId) || undefined, href: `/matchs/${m.id}`,
      });
    }

    return evs.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 16);
  }, [comps, awards, matches, teamName, compName]);

  const now = Date.now();

  return (
    <div className="w-full px-6 py-10 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">CHRONOS</h1>
        <p className="text-muted-foreground mt-1">Plateforme de la scène compétitive Brawl Stars.</p>
        <div className="flex flex-wrap gap-2 mt-4 text-sm">
          <span className="px-3 py-1 rounded-md bg-muted">{players?.length ?? 0} joueurs</span>
          <span className="px-3 py-1 rounded-md bg-muted">{teams?.length ?? 0} équipes</span>
          <span className="px-3 py-1 rounded-md bg-muted">{comps?.length ?? 0} compétitions</span>
          {activeComp && (
            <Link href="/competitions" className="px-3 py-1 rounded-md bg-primary/10 text-primary font-medium">
              En cours : {activeComp.name}
            </Link>
          )}
        </div>
      </div>

      {/* Raccourcis communauté */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="group p-4 h-full flex items-start gap-3 hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer">
              <s.icon className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-1">
                  {s.label}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Timeline d'événements */}
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-primary" /> Fil d'actualité
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
      ) : (
        <ol className="relative border-l border-border ml-3">
          {events.map((e) => {
            const future = e.date.getTime() > now;
            return (
              <li key={e.id} className="mb-5 ml-6">
                <span
                  className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background"
                  style={{ backgroundColor: e.color }}
                >
                  <e.icon className="h-3.5 w-3.5 text-white" />
                </span>
                <Link href={e.href}>
                  <Card className="p-3 hover:bg-muted/40 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.title}</span>
                      {future && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">À venir</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(e.date)}
                      {e.subtitle ? ` · ${e.subtitle}` : ""}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default HomePage;
