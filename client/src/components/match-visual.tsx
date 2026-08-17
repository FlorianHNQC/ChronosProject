import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserRound, Ban, HelpCircle, Maximize2 } from "lucide-react";
import { useBsCatalog, BrawlerIcon } from "@/lib/bs-catalog";
import type { Match, Team } from "@shared/schema";

type PlayerLite = { playerId: string; pseudo: string; avatarUrl: string | null };
export type VisualSide = { name: string; logo?: string | null; players: PlayerLite[]; won: boolean };

/**
 * Vue « draft » d'un affrontement : map au centre, joueurs des deux camps sur les
 * côtés (« Picks »), score, et bans en bas. Purement présentiel (props résolus) —
 * réutilisable pour un match d'équipe comme pour un affrontement aléatoire.
 */
export function MatchVisualView({
  mapName, modeName, a, b, score, bans = [], detailHref, subtitle, mapHidden = false, large = false, onExpand, className = "",
}: {
  mapName?: string | null;
  modeName?: string | null;
  a: VisualSide;
  b: VisualSide;
  score?: { a: number; b: number } | null;
  bans?: string[];
  detailHref?: string;
  subtitle?: string | null;
  mapHidden?: boolean;
  large?: boolean;
  onExpand?: () => void;
  className?: string;
}) {
  const { mapByName, modeByName } = useBsCatalog();
  const mapInfo = mapName ? mapByName.get(mapName.trim().toLowerCase()) : undefined;
  const modeInfo = modeName ? modeByName.get(modeName.trim().toLowerCase()) : undefined;
  const banList = bans.filter(Boolean);
  const mapW = large ? "w-[188px]" : "w-[112px]";

  const Banner = (
    <>
      {modeInfo?.imageUrl && <img src={modeInfo.imageUrl} alt="" className="h-5 w-5 object-contain" />}
      <span className="font-semibold text-sm truncate">{mapHidden ? "Map cachée" : (mapName || "Map à définir")}</span>
    </>
  );

  const MapImage = (
    <div className={"w-full aspect-[3/5] rounded-lg overflow-hidden bg-muted ring-1 ring-border flex items-center justify-center relative"}>
      {mapHidden ? (
        <HelpCircle className="h-1/3 w-1/3 text-muted-foreground/60" />
      ) : mapInfo?.imageUrl ? (
        <img src={mapInfo.imageUrl} alt={mapName ?? ""} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xs text-muted-foreground text-center px-1">{mapName || "?"}</span>
      )}
      {onExpand && (
        <span className="absolute bottom-1 right-1 h-6 w-6 rounded bg-black/50 text-white flex items-center justify-center opacity-80 group-hover/map:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );

  return (
    <div className={"rounded-xl border bg-card overflow-hidden shrink-0 " + className}>
      {detailHref ? (
        <Link href={detailHref} className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2 hover:bg-muted/60">{Banner}</Link>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2">{Banner}</div>
      )}

      <div className="flex items-stretch gap-2 p-3">
        <SideColumn side={a} accent="#2f6fed" align="right" />
        <div className={"flex flex-col items-center justify-center shrink-0 " + mapW}>
          {onExpand ? (
            <button type="button" onClick={onExpand} title="Agrandir" className="w-full group/map">{MapImage}</button>
          ) : MapImage}
          <div className="mt-2 font-mono text-sm">
            {score ? (
              <span><b className={a.won ? "text-primary" : ""}>{score.a}</b> – <b className={b.won ? "text-primary" : ""}>{score.b}</b></span>
            ) : (
              <span className="text-muted-foreground">vs</span>
            )}
          </div>
          {subtitle && <div className="mt-1 text-[11px] text-muted-foreground text-center">{subtitle}</div>}
        </div>
        <SideColumn side={b} accent="#e2483b" align="left" />
      </div>

      {banList.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 border-t bg-background/60 px-3 py-2">
          <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
          {banList.map((x, i) => <BrawlerIcon key={x + i} name={x} size={large ? 32 : 26} />)}
        </div>
      )}
    </div>
  );
}

function SideColumn({ side, accent, align }: { side: VisualSide; accent: string; align: "left" | "right" }) {
  return (
    <div className="flex-1 min-w-[7.5rem]">
      <div className={"flex items-center gap-1.5 mb-2 " + (align === "right" ? "justify-end" : "")}>
        {side.logo && <img src={side.logo} alt="" className="h-5 w-5 rounded object-cover" />}
        <span className="font-semibold text-sm truncate" style={side.won ? { color: accent } : undefined}>{side.name}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {side.players.map((m) => (
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
        {side.players.length === 0 && <span className="text-xs text-muted-foreground">Effectif à définir</span>}
      </div>
    </div>
  );
}

type RosterMember = { playerId: string; pseudo: string; avatarUrl: string | null; isCaptain: boolean | null };

/** Visuel d'un match d'équipe : résout rosters + logos + bans, puis rend MatchVisualView. */
export function MatchVisual({ match, homeName, awayName, bans, detailHref, className = "" }: {
  match: Match; homeName: string; awayName: string; bans?: string[]; detailHref?: string; className?: string;
}) {
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

  const banList = useMemo(() => {
    if (bans && bans.length) return bans.filter(Boolean);
    const t = [homeTeam.data, awayTeam.data].filter(Boolean) as Team[];
    return t.flatMap((x) => [x.playoffBanBrawler1, x.playoffBanBrawler2]).filter((x): x is string => !!x);
  }, [bans, homeTeam.data, awayTeam.data]);

  const done = match.status === "completed";
  return (
    <MatchVisualView
      mapName={match.map}
      modeName={match.gameMode}
      mapHidden={!!match.mapHidden}
      a={{ name: homeName, logo: homeTeam.data?.logoUrl ?? null, players: homeRoster.data ?? [], won: done && match.winnerId === match.teamHomeId }}
      b={{ name: awayName, logo: awayTeam.data?.logoUrl ?? null, players: awayRoster.data ?? [], won: done && match.winnerId === match.teamAwayId }}
      score={done ? { a: match.scoreHome ?? 0, b: match.scoreAway ?? 0 } : null}
      bans={banList}
      detailHref={detailHref}
      className={className}
    />
  );
}

export default MatchVisual;
