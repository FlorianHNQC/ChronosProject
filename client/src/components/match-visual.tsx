import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserRound, Ban } from "lucide-react";
import { useBsCatalog, BrawlerIcon } from "@/lib/bs-catalog";
import type { Match, Team } from "@shared/schema";

type RosterMember = { playerId: string; pseudo: string; avatarUrl: string | null; isCaptain: boolean | null };

/**
 * Grand visuel d'un match : la map au centre (image de layout), les joueurs des
 * deux équipes sur les côtés (« Picks »), le score, et — si la compétition a des
 * bans — les brawlers bannis en bas. Inspiré des écrans de draft Brawl Stars.
 */
export function MatchVisual({ match, homeName, awayName, bans, detailHref, className = "" }: {
  match: Match; homeName: string; awayName: string; bans?: string[]; detailHref?: string; className?: string;
}) {
  const { mapByName, modeByName } = useBsCatalog();

  const homeRoster = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", match.teamHomeId, "roster"],
    enabled: !!match.teamHomeId,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${match.teamHomeId}/roster`)).json(),
  });
  const awayRoster = useQuery<RosterMember[]>({
    queryKey: ["/api/teams", match.teamAwayId, "roster"],
    enabled: !!match.teamAwayId,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${match.teamAwayId}/roster`)).json(),
  });
  const homeTeam = useQuery<Team>({
    queryKey: ["/api/teams", match.teamHomeId, "one"],
    enabled: !!match.teamHomeId,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${match.teamHomeId}`)).json(),
  });
  const awayTeam = useQuery<Team>({
    queryKey: ["/api/teams", match.teamAwayId, "one"],
    enabled: !!match.teamAwayId,
    queryFn: async () => (await apiRequest("GET", `/api/teams/${match.teamAwayId}`)).json(),
  });

  const mapInfo = match.map ? mapByName.get(match.map.trim().toLowerCase()) : undefined;
  const modeInfo = match.gameMode ? modeByName.get(match.gameMode.trim().toLowerCase()) : undefined;

  // Bans : override explicite, sinon bans de playoffs des deux équipes.
  const banList = useMemo(() => {
    if (bans && bans.length) return bans.filter(Boolean);
    const t = [homeTeam.data, awayTeam.data].filter(Boolean) as Team[];
    return t.flatMap((x) => [x.playoffBanBrawler1, x.playoffBanBrawler2]).filter((b): b is string => !!b);
  }, [bans, homeTeam.data, awayTeam.data]);

  const done = match.status === "completed";
  const homeWon = match.winnerId === match.teamHomeId;
  const awayWon = match.winnerId === match.teamAwayId;

  return (
    <div className={"rounded-xl border bg-card overflow-hidden shrink-0 " + className}>
      {/* Bandeau mode + map (lien vers le détail si fourni) */}
      {detailHref ? (
        <Link href={detailHref} className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2 hover:bg-muted/60">
          {modeInfo?.imageUrl && <img src={modeInfo.imageUrl} alt="" className="h-5 w-5 object-contain" />}
          <span className="font-semibold text-sm truncate">{match.map || "Map à définir"}</span>
        </Link>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2">
          {modeInfo?.imageUrl && <img src={modeInfo.imageUrl} alt="" className="h-5 w-5 object-contain" />}
          <span className="font-semibold text-sm truncate">{match.map || "Map à définir"}</span>
        </div>
      )}

      <div className="flex items-stretch gap-2 p-3">
        <TeamColumn name={homeName} roster={homeRoster.data ?? []} logo={homeTeam.data?.logoUrl ?? null} accent="#2f6fed" won={done && homeWon} align="right" />

        {/* Map + score */}
        <div className="flex flex-col items-center justify-center shrink-0 w-[112px]">
          <div className="w-full aspect-[3/5] rounded-lg overflow-hidden bg-muted ring-1 ring-border flex items-center justify-center">
            {mapInfo?.imageUrl ? (
              <img src={mapInfo.imageUrl} alt={match.map ?? ""} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-1">{match.map || "?"}</span>
            )}
          </div>
          <div className="mt-2 font-mono text-sm">
            {done ? (
              <span><b className={homeWon ? "text-primary" : ""}>{match.scoreHome ?? 0}</b> – <b className={awayWon ? "text-primary" : ""}>{match.scoreAway ?? 0}</b></span>
            ) : (
              <span className="text-muted-foreground">vs</span>
            )}
          </div>
        </div>

        <TeamColumn name={awayName} roster={awayRoster.data ?? []} logo={awayTeam.data?.logoUrl ?? null} accent="#e2483b" won={done && awayWon} align="left" />
      </div>

      {/* Bans */}
      {banList.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 border-t bg-background/60 px-3 py-2">
          <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
          {banList.map((b, i) => <BrawlerIcon key={b + i} name={b} size={26} />)}
        </div>
      )}
    </div>
  );
}

function TeamColumn({ name, roster, logo, accent, won, align }: {
  name: string; roster: RosterMember[]; logo: string | null; accent: string; won: boolean; align: "left" | "right";
}) {
  return (
    <div className="flex-1 min-w-[7.5rem]">
      <div className={"flex items-center gap-1.5 mb-2 " + (align === "right" ? "justify-end" : "")}>
        {logo && <img src={logo} alt="" className="h-5 w-5 rounded object-cover" />}
        <span className="font-semibold text-sm truncate" style={won ? { color: accent } : undefined}>{name}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {roster.map((m) => (
          <Link key={m.playerId} href={`/joueurs/${m.playerId}`}
            className={"flex items-center gap-1.5 group " + (align === "right" ? "flex-row-reverse text-right" : "")}>
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} className="h-9 w-9 rounded object-cover bg-muted ring-1 shrink-0" style={{ boxShadow: `inset 0 0 0 2px ${accent}55` }} />
            ) : (
              <div className="h-9 w-9 rounded bg-muted flex items-center justify-center ring-1 ring-border shrink-0"><UserRound className="h-4 w-4 text-muted-foreground" /></div>
            )}
            <span className="text-xs truncate group-hover:text-primary">{m.pseudo}</span>
          </Link>
        ))}
        {roster.length === 0 && <span className="text-xs text-muted-foreground">Effectif à définir</span>}
      </div>
    </div>
  );
}

export default MatchVisual;
