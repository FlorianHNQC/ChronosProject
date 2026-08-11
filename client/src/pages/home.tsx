import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import {
  Sparkles, CalendarDays, BarChart3, Users, Trophy, UserRound,
  Swords, Award, Flag, Rocket, ArrowRight, History, Image as ImageIcon,
} from "lucide-react";
import type { Competition, Player, Match, Team } from "@shared/schema";

type AwardRow = { id: string; label: string; pseudo: string | null; avatarUrl: string | null; justification: string | null };
type SettingValue = { key: string; value: string | null };

/** Image de fond par défaut si l'admin n'en a pas défini (à déposer dans client/public/images). */
const DEFAULT_BG = "/images/home-bg.jpg";

/**
 * Grands raccourcis illustrés. Les images sont des fichiers statiques à déposer
 * dans client/public/images/ (servis à /images/...). Si un fichier manque,
 * le panneau reste neutre avec l'icône — aucune option admin nécessaire.
 */
const SHORTCUTS = [
  { href: "/hydra", label: "Hydra", desc: "Classement par tiers", icon: Sparkles, img: "/images/hydra.jpg" },
  { href: "/calendrier", label: "Calendrier & résultats", desc: "Matchs à venir et passés", icon: CalendarDays, img: "/images/calendrier.jpg" },
  { href: "/competitions", label: "Compétitions", desc: "Ligues & tournois", icon: Trophy, img: "/images/competitions.jpg" },
  { href: "/equipes", label: "Équipes", desc: "Rosters", icon: Users, img: "/images/equipes.jpg" },
  { href: "/joueurs", label: "Joueurs", desc: "Annuaire", icon: UserRound, img: "/images/joueurs.jpg" },
  { href: "/stats", label: "Statistiques", desc: "Classements & agrégats", icon: BarChart3, img: "/images/stats.jpg" },
  { href: "/recompenses", label: "Récompenses", desc: "Palmarès", icon: Award, img: "/images/recompenses.jpg" },
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
  const { toast } = useToast();
  const { isAdmin } = useMe();

  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: matches } = useQuery<Match[]>({ queryKey: ["/api/matches"] });
  const { data: awards } = useQuery<{ weekly: AwardRow[]; season: AwardRow[] }>({ queryKey: ["/api/awards"] });
  const { data: bgSetting } = useQuery<SettingValue>({ queryKey: ["/api/settings/home_bg"] });

  const bg = bgSetting?.value || DEFAULT_BG;

  const [editingBg, setEditingBg] = useState(false);
  const [bgInput, setBgInput] = useState("");
  const saveBg = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings/home_bg", { value: bgInput.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/home_bg"] });
      setEditingBg(false);
      toast({ title: "Image de fond mise à jour" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

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
    <div className="w-full px-6 py-8 max-w-6xl mx-auto">
      {/* Hero centré sur image de fond discrète (changeable par l'admin) */}
      <section className="relative overflow-hidden rounded-2xl border mb-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${bg}")` }}
          aria-hidden
        />
        {/* Voile épais : l'image reste à peine visible. */}
        <div className="absolute inset-0 bg-background/85" aria-hidden />
        <div className="relative text-center px-6 py-16 sm:py-20">
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">CHRONOS</h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            La scène compétitive Brawl Stars de la communauté.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-5 text-sm">
            <span className="px-3 py-1 rounded-md bg-muted/80 backdrop-blur">{players?.length ?? 0} joueurs</span>
            <span className="px-3 py-1 rounded-md bg-muted/80 backdrop-blur">{teams?.length ?? 0} équipes</span>
            <span className="px-3 py-1 rounded-md bg-muted/80 backdrop-blur">{comps?.length ?? 0} compétitions</span>
            {activeComp && (
              <Link href="/competitions" className="px-3 py-1 rounded-md bg-primary/15 text-primary font-medium">
                En cours : {activeComp.name}
              </Link>
            )}
          </div>

          {isAdmin && (
            <div className="mt-6">
              {editingBg ? (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Input
                    value={bgInput}
                    onChange={(e) => setBgInput(e.target.value)}
                    placeholder="URL ou chemin de l'image (ex. /images/home-bg.jpg)"
                    className="w-72 max-w-full"
                  />
                  <Button size="sm" disabled={saveBg.isPending} onClick={() => saveBg.mutate()}>
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingBg(false)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBgInput(bgSetting?.value ?? "");
                    setEditingBg(true);
                  }}
                >
                  <ImageIcon className="h-4 w-4 mr-1" /> Changer l'image de fond
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Grands raccourcis illustrés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="group overflow-hidden flex items-stretch h-24 hover:border-primary/50 transition-colors cursor-pointer">
              <div
                className="relative w-28 shrink-0 bg-muted bg-cover bg-center"
                style={{ backgroundImage: `url("${s.img}")` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/70" />
                <s.icon className="absolute bottom-1.5 left-1.5 h-5 w-5 text-white/90 drop-shadow" />
              </div>
              <div className="p-4 flex-1 flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Fil d'actualité */}
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
