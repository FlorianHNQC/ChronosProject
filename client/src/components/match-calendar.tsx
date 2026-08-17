import { useMemo } from "react";
import { MatchVisual } from "@/components/match-visual";
import { EventCalendar, type CalEvent } from "@/components/event-calendar";
import type { Match, Team } from "@shared/schema";

const timeLabel = (m: Match) =>
  m.datetime && m.hasTime
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(m.datetime as unknown as string))
    : "";

/** Construit les événements de calendrier à partir de matchs d'équipe. */
export function buildMatchEvents(matches: Match[], teams: Team[]): CalEvent[] {
  const nameMap = new Map<string, string>();
  for (const t of teams) nameMap.set(t.id, t.name);
  const teamName = (id: string | null) => (id ? nameMap.get(id) ?? "?" : "?");
  return matches.map((m) => {
    const done = m.status === "completed";
    const t = timeLabel(m);
    const chip = `${t ? t + " " : ""}${teamName(m.teamHomeId)} ${done ? `${m.scoreHome ?? 0}-${m.scoreAway ?? 0}` : "vs"} ${teamName(m.teamAwayId)}`;
    return {
      id: m.id,
      datetime: (m.datetime as unknown as string) ?? null,
      status: m.status ?? "upcoming",
      chip,
      href: `/matchs/${m.id}`,
      card: <MatchVisual match={m} homeName={teamName(m.teamHomeId)} awayName={teamName(m.teamAwayId)} detailHref={`/matchs/${m.id}`} className="w-[320px]" />,
    };
  });
}

/**
 * Calendrier de matchs d'équipe : construit des événements pour le calendrier
 * générique (grille mensuelle + agenda). Réutilisé par la page Calendrier et la
 * phase Saison d'une compétition.
 */
export function MatchCalendar({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const events = useMemo(() => buildMatchEvents(matches, teams), [matches, teams]);
  return <EventCalendar events={events} emptyLabel="Aucun match." />;
}

export default MatchCalendar;
