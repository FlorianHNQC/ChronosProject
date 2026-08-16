import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { ArrowLeft, UserRound, Star, Trophy } from "lucide-react";
import type { Team, Match, Competition } from "@shared/schema";

type RosterMember = {
  playerId: string; pseudo: string; avatarUrl: string | null;
  playerTag: string | null; elo: number | null; isCaptain: boolean | null;
};

/** Profil public d'une équipe : identité, effectif, compétition, bilan de matchs. */
export function TeamProfilePage() {
  const { id = "" } = useParams();

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/teams", id, "one"],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${id}`)).json(),
  });
  const { data: roster } = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", id, "roster"],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${id}/roster`)).json(),
  });
  const { data: comp } = useQuery<Competition>({
    queryKey: ["/api/competitions", team?.competitionId],
    enabled: !!team?.competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/competitions/${team!.competitionId}`)).json(),
  });
  const { data: matches } = useQuery<Match[]>({
    queryKey: ["/api/matches", team?.competitionId],
    enabled: !!team?.competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/matches?competitionId=${team!.competitionId}`)).json(),
  });

  const teamMatches = useMemo(
    () => (matches ?? []).filter((m) => m.teamHomeId === id || m.teamAwayId === id),
    [matches, id],
  );
  const record = useMemo(() => {
    let w = 0, l = 0, d = 0;
    for (const m of teamMatches) {
      if (m.status !== "completed") continue;
      if (!m.winnerId) { d++; continue; }
      if (m.winnerId === id) w++; else l++;
    }
    return { w, l, d, played: w + l + d };
  }, [teamMatches, id]);

  return (
    <div className="w-full px-6 py-8">
      <Link href="/equipes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Équipes
      </Link>

      <div className="flex items-center gap-4 mb-6">
        {team?.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="h-20 w-20 rounded-xl object-cover bg-muted ring-1 ring-border" />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border">
            <Trophy className="h-9 w-9 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{team?.name ?? "Équipe"}</h1>
            {team?.tag && <span className="text-sm text-muted-foreground">[{team.tag}]</span>}
          </div>
          {comp && (
            <Link href={`/competitions/${comp.id}`} className="text-sm text-primary hover:underline">
              {comp.name}
            </Link>
          )}
          {record.played > 0 && (
            <div className="text-sm text-muted-foreground mt-1">
              Bilan : <span className="text-green-500 font-medium">{record.w}V</span>
              {record.d > 0 && <> · {record.d}N</>}
              {" · "}<span className="text-red-500 font-medium">{record.l}D</span>
            </div>
          )}
        </div>
      </div>

      {/* Effectif */}
      <h2 className="font-semibold mb-3">Effectif</h2>
      <div className="flex flex-wrap gap-4 mb-8">
        {(roster ?? []).map((m) => (
          <Link key={m.playerId} href={`/joueurs/${m.playerId}`} className="w-[84px] flex flex-col items-center text-center group">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-[76px] w-[76px] rounded-lg object-cover bg-muted ring-1 ring-border transition-all group-hover:ring-2 group-hover:ring-primary" />
            ) : (
              <div className="h-[76px] w-[76px] rounded-lg bg-muted flex items-center justify-center ring-1 ring-border transition-all group-hover:ring-2 group-hover:ring-primary">
                <UserRound className="h-9 w-9 text-muted-foreground" />
              </div>
            )}
            <span className="mt-1 text-xs font-semibold leading-tight break-words w-full group-hover:text-primary flex items-center justify-center gap-0.5">
              {m.isCaptain && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
              {m.pseudo}
            </span>
            {m.elo != null && <span className="text-[10px] text-muted-foreground">Elo {m.elo}</span>}
          </Link>
        ))}
        {(roster ?? []).length === 0 && <p className="text-sm text-muted-foreground">Effectif vide.</p>}
      </div>

      {/* Matchs */}
      {teamMatches.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">Matchs</h2>
          <div className="space-y-2">
            {teamMatches.map((m) => {
              const isHome = m.teamHomeId === id;
              const done = m.status === "completed";
              const won = m.winnerId === id;
              return (
                <Card key={m.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">
                    {m.datetime ? new Date(m.datetime).toLocaleDateString("fr-FR") : "à définir"}
                  </span>
                  <span className="flex-1">{isHome ? "Domicile" : "Extérieur"}</span>
                  <span className="font-mono">{done ? `${m.scoreHome ?? 0} – ${m.scoreAway ?? 0}` : "vs"}</span>
                  {done && (
                    <span className={"text-xs font-bold w-6 text-center " + (won ? "text-green-500" : m.winnerId ? "text-red-500" : "text-muted-foreground")}>
                      {won ? "V" : m.winnerId ? "D" : "N"}
                    </span>
                  )}
                  <Link href={`/matchs/${m.id}`} className="text-primary hover:underline text-xs">détail</Link>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default TeamProfilePage;
