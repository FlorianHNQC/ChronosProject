import { useMemo } from "react";
import type { PlayoffSeries } from "@shared/schema";

/**
 * Grille de bracket réutilisable : colonnes par tour, séries en boîtes, le
 * vainqueur mis en évidence. Générique — prend n'importe quel jeu de séries
 * et une fonction de résolution de nom d'équipe.
 */
export function Bracket({
  series,
  teamName,
}: {
  series: PlayoffSeries[];
  teamName: (id: string | null, label: string | null) => string;
}) {
  const rounds = useMemo(() => {
    const byRound = new Map<string, PlayoffSeries[]>();
    for (const s of series) {
      const r = s.round || "—";
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(s);
    }
    // Tours ordonnés : le plus de séries d'abord (tours amont), puis par position.
    return Array.from(byRound.entries())
      .map(([round, list]) => ({
        round,
        list: [...list].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)),
        minPos: Math.min(...list.map((s) => s.bracketPosition ?? 0)),
      }))
      .sort((a, b) => b.list.length - a.list.length || a.minPos - b.minPos);
  }, [series]);

  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune série.</p>;
  }

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map(({ round, list }) => (
        <div key={round} className="flex flex-col justify-around gap-6 min-w-[230px]">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold capitalize">{round}</div>
          {list.map((s) => (
            <SeriesBox key={s.id} s={s} teamName={teamName} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SeriesBox({ s, teamName }: { s: PlayoffSeries; teamName: (id: string | null, label: string | null) => string }) {
  const aWin = !!s.winnerId && s.winnerId === s.teamAId;
  const bWin = !!s.winnerId && s.winnerId === s.teamBId;
  const line = (win: boolean, name: string, score: number | null) => (
    <div className={"flex items-center justify-between px-3 py-1.5 " + (win ? "font-bold" : "")}>
      <span className="truncate flex items-center gap-1.5">
        {win && <span className="inline-block w-1 h-4 rounded bg-primary" />}
        {name}
      </span>
      <span className="font-mono ml-2 tabular-nums">{score ?? 0}</span>
    </div>
  );
  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      {line(aWin, teamName(s.teamAId, s.teamALabel), s.teamAWins)}
      <div className="border-t" />
      {line(bWin, teamName(s.teamBId, s.teamBLabel), s.teamBWins)}
      <div className="text-[10px] text-muted-foreground px-3 py-1 border-t bg-muted/30">
        BO{s.bestOf}{s.status && s.status !== "pending" ? ` · ${s.status}` : ""}
      </div>
    </div>
  );
}

export default Bracket;
