import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserRound, Ban, HelpCircle, Eye, X, Clock } from "lucide-react";
import { useBsCatalog, BrawlerIcon } from "@/lib/bs-catalog";
import type { Match, Team } from "@shared/schema";

type PlayerLite = { playerId: string; pseudo: string; avatarUrl: string | null };
export type VisualSide = { name: string; logo?: string | null; players: PlayerLite[]; won: boolean };

/**
 * Vue « draft » d'un affrontement : map au centre, joueurs des deux camps sur les
 * côtés (avatar au-dessus, pseudo dessous), heure en évidence, bans en bas.
 * `expandable` ajoute un œil qui ouvre un popup agrandi (utile là où il n'y a pas
 * de page de détail, ex. affrontements aléatoires).
 */
export function MatchVisualView({
  mapName, modeName, a, b, score, bans = [], detailHref, subtitle, time, mapHidden = false, large = false, expandable = false, className = "",
}: {
  mapName?: string | null;
  modeName?: string | null;
  a: VisualSide;
  b: VisualSide;
  score?: { a: number; b: number } | null;
  bans?: string[];
  detailHref?: string;
  subtitle?: string | null;
  time?: string | null;
  mapHidden?: boolean;
  large?: boolean;
  expandable?: boolean;
  className?: string;
}) {
  const { mapByName, modeByName } = useBsCatalog();
  const [open, setOpen] = useState(false);
  const mapInfo = mapName ? mapByName.get(mapName.trim().toLowerCase()) : undefined;
  const modeInfo = modeName ? modeByName.get(modeName.trim().toLowerCase()) : undefined;
  const banList = bans.filter(Boolean);

  const inner = (lg: boolean) => {
    const mapW = lg ? "w-[210px]" : "w-[118px]";
    const av = lg ? 56 : 44;
    return (
      <>
        {/* Bandeau mode + map */}
        {detailHref ? (
          <Link href={detailHref} className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2 hover:bg-muted/60">
            {modeInfo?.imageUrl && <img src={modeInfo.imageUrl} alt="" className="h-5 w-5 object-contain" />}
            <span className="font-semibold text-sm truncate">{mapHidden ? "Map cachée" : (mapName || "Map à définir")}</span>
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-background/60 border-b px-3 py-2">
            {modeInfo?.imageUrl && <img src={modeInfo.imageUrl} alt="" className="h-5 w-5 object-contain" />}
            <span className="font-semibold text-sm truncate">{mapHidden ? "Map cachée" : (mapName || "Map à définir")}</span>
          </div>
        )}

        {/* Heure — mise en évidence (donnée clé) */}
        {time && (
          <div className="flex items-center justify-center gap-1.5 bg-primary/10 text-primary font-bold text-sm px-3 py-1.5 border-b">
            <Clock className="h-4 w-4" /> {time}
          </div>
        )}

        <div className="flex items-start justify-between gap-1 p-3">
          <SideColumn side={a} accent="#2f6fed" av={av} />
          <div className={"flex flex-col items-center justify-start shrink-0 " + mapW}>
            <div className="w-full aspect-[3/5] rounded-lg overflow-hidden bg-muted ring-1 ring-border flex items-center justify-center">
              {mapHidden ? (
                <HelpCircle className="h-1/3 w-1/3 text-muted-foreground/60" />
              ) : mapInfo?.imageUrl ? (
                <img src={mapInfo.imageUrl} alt={mapName ?? ""} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-1">{mapName || "?"}</span>
              )}
            </div>
            <div className="mt-2 font-mono text-sm">
              {score ? (
                <span><b className={a.won ? "text-primary" : ""}>{score.a}</b> – <b className={b.won ? "text-primary" : ""}>{score.b}</b></span>
              ) : (
                <span className="text-muted-foreground">vs</span>
              )}
            </div>
            {subtitle && <div className="mt-1 text-[11px] text-muted-foreground text-center">{subtitle}</div>}
          </div>
          <SideColumn side={b} accent="#e2483b" av={av} />
        </div>

        {banList.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 border-t bg-background/60 px-3 py-2">
            <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
            {banList.map((x, i) => <BrawlerIcon key={x + i} name={x} size={lg ? 34 : 28} />)}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className={"relative rounded-xl border bg-card overflow-hidden shrink-0 " + className}>
        {expandable && (
          <button type="button" onClick={() => setOpen(true)} title="Agrandir le match"
            className="absolute top-1.5 right-1.5 z-10 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75">
            <Eye className="h-4 w-4" />
          </button>
        )}
        {inner(large)}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute -top-3 -right-3 z-10 h-8 w-8 rounded-full bg-card border flex items-center justify-center hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
            <div className="rounded-xl border bg-card overflow-hidden w-[440px] max-w-[94vw] shadow-2xl">{inner(true)}</div>
          </div>
        </div>
      )}
    </>
  );
}

function SideColumn({ side, accent, av }: { side: VisualSide; accent: string; av: number }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: av + 22 }}>
      <div className="flex items-center gap-1 max-w-full">
        {side.logo && <img src={side.logo} alt="" className="h-4 w-4 rounded object-cover shrink-0" />}
        <span className="font-semibold text-xs truncate" style={side.won ? { color: accent } : undefined}>{side.name}</span>
      </div>
      <div className="flex flex-col items-center gap-3.5">
        {side.players.map((m) => (
          <Link key={m.playerId} href={`/joueurs/${m.playerId}`} className="flex flex-col items-center gap-1 group w-full">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.pseudo} style={{ width: av, height: av, boxShadow: `inset 0 0 0 2px ${accent}66` }} className="rounded-lg object-cover bg-muted ring-1 ring-border" />
            ) : (
              <div style={{ width: av, height: av }} className="rounded-lg bg-muted flex items-center justify-center ring-1 ring-border"><UserRound className="h-1/2 w-1/2 text-muted-foreground" /></div>
            )}
            <span className="text-[11px] leading-tight text-center break-words w-full group-hover:text-primary">{m.pseudo}</span>
          </Link>
        ))}
        {side.players.length === 0 && <span className="text-[11px] text-muted-foreground text-center">à définir</span>}
      </div>
    </div>
  );
}

type RosterMember = { playerId: string; pseudo: string; avatarUrl: string | null; isCaptain: boolean | null };

/** Visuel d'un match d'équipe : résout rosters + logos + bans, puis rend MatchVisualView. */
export function MatchVisual({ match, homeName, awayName, bans, detailHref, expandable, className = "" }: {
  match: Match; homeName: string; awayName: string; bans?: string[]; detailHref?: string; expandable?: boolean; className?: string;
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
  const time = match.datetime
    ? new Date(match.datetime as unknown as string).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <MatchVisualView
      mapName={match.map}
      modeName={match.gameMode}
      mapHidden={!!match.mapHidden}
      time={time}
      a={{ name: homeName, logo: homeTeam.data?.logoUrl ?? null, players: homeRoster.data ?? [], won: done && match.winnerId === match.teamHomeId }}
      b={{ name: awayName, logo: awayTeam.data?.logoUrl ?? null, players: awayRoster.data ?? [], won: done && match.winnerId === match.teamAwayId }}
      score={done ? { a: match.scoreHome ?? 0, b: match.scoreAway ?? 0 } : null}
      bans={banList}
      detailHref={detailHref}
      expandable={expandable}
      className={className}
    />
  );
}

export default MatchVisual;
