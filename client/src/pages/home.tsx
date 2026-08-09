import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/pager";
import {
  Sparkles, Trophy, UserRound, Swords, Flag, Rocket, ArrowRight, History,
} from "lucide-react";
import type { Competition, Player, Match, Team } from "@shared/schema";

// Raccourcis alignés sur la nav publique : tout ce qui est propre à une
// compétition (calendrier, playoffs, équipes, stats) se trouve désormais EN
// ENTRANT dans une compétition. Restent au global : Compétitions, Hydra, Joueurs.
const SHORTCUTS = [
  { href: "/competitions", label: "Compétitions", desc: "Ligues & tournois — classement, calendrier, playoffs, équipes", icon: Trophy },
  { href: "/hydra", label: "Hydra", desc: "Le classement par tiers", icon: Sparkles },
  { href: "/joueurs", label: "Joueurs", desc: "L'annuaire de la communauté", icon: UserRound },
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

    // Résultats récents (10 derniers matchs terminés)
    const done = (matches ?? [])
      .filter((m) => m.status === "completed")
      .sort((a, b) => (ts(b.datetime) || ts(b.createdAt)) - (ts(a.datetime) || ts(a.createdAt)))
      .slice(0, 10);
    for (const m of done) {
      const d = m.datetime ? new Date(m.datetime) : m.createdAt ? new Date(m.createdAt) : null;
      if (!d) continue;
      const hasScore = m.scoreHome != null && m.scoreAway != null;
      const loserId = m.winnerId === m.teamHomeId ? m.teamAwayId : m.teamHomeId;
      const title = hasScore
        ? `${teamName(m.teamHomeId)} ${m.scoreHome}–${m.scoreAway} ${teamName(m.teamAwayId)}`
        : m.winnerId
          ? `${teamName(m.winnerId)} bat ${teamName(loserId)}`
          : `${teamName(m.teamHomeId)} vs ${teamName(m.teamAwayId)}`;
      evs.push({
        id: `res-${m.id}`, date: d, icon: Swords, color: "#10b981",
        title,
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

    return evs.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [comps, matches, teamName, compName]);

  const now = Date.now();

  // Pagination du fil d'actualité (évite une page interminable).
  const FEED_PAGE = 6;
  const [feedPage, setFeedPage] = useState(1);
  const feedPageCount = Math.max(1, Math.ceil(events.length / FEED_PAGE));
  const safeFeedPage = Math.min(feedPage, feedPageCount);
  const feedSlice = events.slice((safeFeedPage - 1) * FEED_PAGE, safeFeedPage * FEED_PAGE);

  return (
    <div className="w-full px-6 py-10 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-4xl font-extrabold italic tracking-tight text-primary">CHRONOS</h1>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12 animate-fade-in-up animate-delay-100">
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
      <h2 className="font-semibold mb-4 flex items-center gap-2 animate-fade-in-up animate-delay-200">
        <History className="h-5 w-5 text-primary" /> Fil d'actualité
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
      ) : (
        <>
        <ol className="relative border-l border-border ml-3 animate-fade-in-up animate-delay-300">
          {feedSlice.map((e) => {
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
        <Pager page={safeFeedPage} pageCount={feedPageCount} onPageChange={setFeedPage} />
        </>
      )}
    </div>
  );
}

export default HomePage;
