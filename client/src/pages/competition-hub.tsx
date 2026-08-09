import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  ArrowLeft, Trophy, CalendarDays, ListTree, Users, BarChart3, Table2,
} from "lucide-react";
import type { Competition } from "@shared/schema";
import { MatchesPage } from "./matches";
import { PlayoffsPage } from "./playoffs";
import { TeamsPage } from "./teams";
import { StatsPage } from "./stats";

const TYPE_LABELS: Record<string, string> = {
  league: "Ligue", tournament: "Tournoi", swiss: "Suisse",
  round_robin: "Round robin", groups: "Poules", scrim: "Scrim", event: "Événement",
};

type TabDef = { slug: string; label: string; icon: typeof Trophy; ready: boolean; blurb: string };

const TABS: TabDef[] = [
  { slug: "classement", label: "Classement", icon: Table2, ready: false, blurb: "Le classement de la phase de groupes / saison régulière." },
  { slug: "calendrier", label: "Calendrier", icon: CalendarDays, ready: true, blurb: "Les matchs à venir et les résultats." },
  { slug: "playoffs", label: "Playoffs", icon: ListTree, ready: true, blurb: "La grille des séries finales." },
  { slug: "equipes", label: "Équipes", icon: Users, ready: true, blurb: "Les équipes engagées et leurs effectifs." },
  { slug: "stats", label: "Stats", icon: BarChart3, ready: true, blurb: "Les classements de statistiques par joueur." },
];

/**
 * Hub d'une compétition : on ENTRE dans une compétition et tout ce qui la
 * concerne (Classement / Calendrier / Playoffs / Équipes / Stats)
 * vit ici, scopé à son id. Les sous-pages sont les pages publiques existantes,
 * alimentées par `competitionId` (leur sélecteur de compétition est masqué).
 */
export function CompetitionHubPage({ id, tab }: { id: string; tab: string }) {
  const { data: comp, isLoading, isError } = useQuery<Competition>({
    queryKey: [`/api/competitions/${id}`],
  });

  const renderBody = () => {
    switch (tab) {
      case "calendrier": return <MatchesPage competitionId={id} />;
      case "playoffs": return <PlayoffsPage competitionId={id} />;
      case "equipes": return <TeamsPage competitionId={id} />;
      case "stats": return <StatsPage competitionId={id} />;
      case "classement": {
        const t = TABS.find((x) => x.slug === tab)!;
        const Icon = t.icon;
        return (
          <div className="px-6 py-8">
            <EmptyState icon={Icon} title={`${t.label} — bientôt`} description={t.blurb} />
          </div>
        );
      }
      default: return <Overview id={id} />;
    }
  };

  if (isError) {
    return (
      <div className="px-6 py-12">
        <EmptyState icon={Trophy} title="Compétition introuvable" description="Cette compétition n'existe pas ou n'est plus disponible." />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="px-6 pt-6">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Compétitions
          </Link>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {comp && (
                  <Badge variant="secondary" className="rounded-full font-medium">
                    {TYPE_LABELS[comp.type] ?? comp.type}
                  </Badge>
                )}
                {comp && <StatusBadge status={comp.status} />}
              </div>
              <h1 className="truncate text-3xl font-bold italic tracking-tight sm:text-4xl">
                {isLoading ? "…" : comp?.name ?? "Compétition"}
              </h1>
            </div>
          </div>

          <nav className="mt-6 flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-border/60">
            <SubNavLink id={id} slug="" label="Vue d'ensemble" active={tab === ""} />
            {TABS.map((t) => (
              <SubNavLink key={t.slug} id={id} slug={t.slug} label={t.label} active={tab === t.slug} />
            ))}
          </nav>
      </div>

      <div key={tab} className="animate-fade-in">{renderBody()}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "active") {
    return (
      <Badge className="gap-1.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> En cours
      </Badge>
    );
  }
  if (status === "archived") {
    return <Badge variant="secondary" className="rounded-full text-muted-foreground">Archivée</Badge>;
  }
  if (!status) return null;
  return <Badge variant="outline" className="rounded-full capitalize">{status}</Badge>;
}

function SubNavLink({ id, slug, label, active }: { id: string; slug: string; label: string; active: boolean }) {
  const href = slug ? `/competitions/${id}/${slug}` : `/competitions/${id}`;
  return (
    <Link
      href={href}
      className={`relative -mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-1 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function Overview({ id }: { id: string }) {
  return (
    <div className="px-6 py-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.slug} href={`/competitions/${id}/${t.slug}`} className="block">
              <Card className="flex h-full items-start gap-3.5 p-4 hover-elevate">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">
                    {t.label}
                    {!t.ready && <span className="ml-2 text-xs font-normal text-muted-foreground">bientôt</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{t.blurb}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default CompetitionHubPage;
