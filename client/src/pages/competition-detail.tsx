import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchCalendar } from "@/components/match-calendar";
import { CompetitionStandings, scoringFromCompetition } from "@/components/competition-standings";
import { Bracket } from "@/components/bracket";
import { RandomPhase } from "@/components/random-phase";
import { CompetitionAwards } from "@/components/competition-awards";
import { CompetitionGroups } from "@/components/competition-groups";
import { ChevronLeft, CalendarDays, Trophy, GitBranch, List, ListOrdered, Shuffle, Award, LayoutGrid } from "lucide-react";
import type { Competition, Team, Match, Conference, PlayoffSeries } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  league: "Ligue", tournament: "Tournoi", swiss: "Suisse",
  round_robin: "Round robin", groups: "Poules", scrim: "Scrim", event: "Événement",
};
const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", active: "Active", archived: "Archivée" };

type Phase = "saison" | "poules" | "playoffs" | "aleatoire" | "recompenses";
type RandomRoundLite = { id: string };

/** Détail d'une compétition : ses phases (saison, playoffs) déduites des données. */
export function CompetitionDetailPage() {
  const { id = "" } = useParams();

  const { data: comp } = useQuery<Competition>({
    queryKey: ["/api/competitions", id],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/competitions/${id}`)).json(),
  });
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", id],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${id}`)).json(),
  });
  const { data: matches } = useQuery<Match[]>({
    queryKey: ["/api/matches", id],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/matches?competitionId=${id}`)).json(),
  });
  const { data: conferences } = useQuery<Conference[]>({ queryKey: ["/api/conferences"] });
  const { data: series } = useQuery<PlayoffSeries[]>({
    queryKey: ["/api/playoffs", id],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/playoffs?competitionId=${id}`)).json(),
  });

  const { data: randomRounds } = useQuery<RandomRoundLite[]>({
    queryKey: ["/api/random", id, "rounds"],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/random/${id}/rounds`)).json(),
  });

  const hasRandom = (randomRounds ?? []).length > 0;
  const hasPoules = (teams ?? []).some((t) => (t.poolLabel ?? "").trim());
  // En format aléatoire, la "saison" par équipes fixes n'a pas de sens.
  const hasSeason = !hasRandom && ((matches ?? []).length > 0 || (teams ?? []).length > 0);
  const hasPlayoffs = (series ?? []).length > 0;
  const isArchived = comp?.status === "archived";

  const phases = useMemo(() => {
    const list: { key: Phase; label: string; icon: typeof CalendarDays }[] = [];
    if (hasRandom) list.push({ key: "aleatoire", label: "Aléatoire", icon: Shuffle });
    if (hasPoules) list.push({ key: "poules", label: "Poules", icon: LayoutGrid });
    if (hasSeason) list.push({ key: "saison", label: "Saison", icon: Trophy });
    if (hasPlayoffs) list.push({ key: "playoffs", label: "Playoffs", icon: GitBranch });
    if (isArchived) list.push({ key: "recompenses", label: "Récompenses", icon: Award });
    return list;
  }, [hasRandom, hasPoules, hasSeason, hasPlayoffs, isArchived]);

  const [phase, setPhase] = useState<Phase | null>(null);
  const active = phase ?? phases[0]?.key ?? null;

  const teamNameById = useMemo(() => {
    const m = new Map((teams ?? []).map((t) => [t.id, t.name]));
    return (tid: string | null, label: string | null) => (tid ? m.get(tid) ?? label ?? "?" : label ?? "à définir");
  }, [teams]);

  return (
    <div className="w-full px-6 py-8">
      <Link href="/competitions" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Compétitions
      </Link>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">{comp?.name ?? "Compétition"}</h1>
        {comp && (
          <span className="text-xs px-2 py-0.5 rounded bg-muted">{STATUS_LABELS[comp.status ?? "draft"] ?? comp.status}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">{comp ? TYPE_LABELS[comp.type] ?? comp.type : ""}</p>

      {phases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune phase à afficher pour cette compétition.</p>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b mb-6">
            {phases.map((p) => (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                className={
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                  (active === p.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <p.icon className="h-4 w-4" /> {p.label}
              </button>
            ))}
          </div>

          {active === "saison" && (
            <SeasonPhase matches={matches ?? []} teams={teams ?? []} conferences={conferences ?? []} comp={comp} />
          )}
          {active === "poules" && <CompetitionGroups teams={teams ?? []} matches={matches ?? []} />}
          {active === "playoffs" && <PlayoffPhase series={series ?? []} teamName={teamNameById} />}
          {active === "aleatoire" && id && <RandomPhase competitionId={id} />}
          {active === "recompenses" && id && <CompetitionAwards competitionId={id} />}
        </>
      )}
    </div>
  );
}

/** Phase de saison : classement (par défaut) ou calendrier. */
function SeasonPhase({ matches, teams, conferences, comp }: { matches: Match[]; teams: Team[]; conferences: Conference[]; comp?: Competition }) {
  const [view, setView] = useState<"classement" | "calendrier">("classement");
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === "classement" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("classement")}>
            <ListOrdered className="h-4 w-4 mr-1" /> Classement
          </Button>
          <Button variant={view === "calendrier" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("calendrier")}>
            <CalendarDays className="h-4 w-4 mr-1" /> Calendrier
          </Button>
        </div>
      </div>
      {view === "classement" ? (
        <CompetitionStandings
          teams={teams}
          matches={matches}
          conferences={conferences}
          scoring={scoringFromCompetition(comp)}
        />
      ) : (
        <MatchCalendar matches={matches} teams={teams} />
      )}
    </div>
  );
}

/** Phase playoffs : bracket vertical (bas → haut) ou liste des séries. */
function PlayoffPhase({
  series,
  teamName,
}: {
  series: PlayoffSeries[];
  teamName: (id: string | null, label: string | null) => string;
}) {
  const [view, setView] = useState<"bracket" | "liste">("bracket");
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === "bracket" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("bracket")}>
            <GitBranch className="h-4 w-4 mr-1" /> Bracket
          </Button>
          <Button variant={view === "liste" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("liste")}>
            <List className="h-4 w-4 mr-1" /> Liste
          </Button>
        </div>
      </div>

      {view === "bracket" ? (
        <Bracket series={series} teamName={teamName} vertical />
      ) : (
        <div className="space-y-2">
          {series.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 p-3">
              <span className="text-xs text-muted-foreground w-24 shrink-0 capitalize">{s.round}</span>
              <span className="font-medium truncate text-right flex-1">{teamName(s.teamAId, s.teamALabel)}</span>
              <span className="font-mono text-sm shrink-0">{s.teamAWins ?? 0} – {s.teamBWins ?? 0}</span>
              <span className="font-medium truncate flex-1">{teamName(s.teamBId, s.teamBLabel)}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">BO{s.bestOf}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompetitionDetailPage;
