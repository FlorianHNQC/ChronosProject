import { useMemo } from "react";
import { Crown } from "lucide-react";
import type { PlayoffSeries } from "@shared/schema";

/**
 * Grille de bracket réutilisable : colonnes par tour, séries en boîtes, le
 * vainqueur mis en évidence. Générique — prend n'importe quel jeu de séries
 * et une fonction de résolution de nom d'équipe.
 */
const CARD_W = 220; // largeur d'une carte de série
const COL_GAP = 48; // espace horizontal entre colonnes (là où vivent les traits)
const ROW_H = 152;  // hauteur d'un créneau vertical (une feuille) — espace entre séries
const HEADER_H = 30; // bande des libellés de tour

type LNode = { s: PlayoffSeries; x: number; y: number; next: LNode | null };

/**
 * Bracket relié : la topologie (`nextSeriesId`/`nextSeriesSlot`) place chaque
 * série centrée face à ses qualifiés, avec des traits coudés vers la suivante.
 * Générique — s'adapte à n'importe quel arbre (play-in / quarts / demis / finale…).
 */
export function Bracket({
  series,
  teamName,
}: {
  series: PlayoffSeries[];
  teamName: (id: string | null, label: string | null) => string;
}) {
  const layout = useMemo(() => computeLayout(series), [series]);

  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune série.</p>;
  }
  const { nodes, cols, width, height } = layout;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="relative" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
          {nodes.filter((n) => n.next).map((n) => {
            const to = n.next!;
            const x1 = n.x + CARD_W, y1 = n.y, x2 = to.x, y2 = to.y;
            const midX = x1 + COL_GAP / 2;
            return (
              <path key={n.s.id} d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} fill="none" stroke="hsl(var(--border))" strokeWidth={2} />
            );
          })}
        </svg>

        {cols.map((c) => (
          <div
            key={c.col}
            className="absolute text-xs font-semibold uppercase capitalize tracking-wide text-muted-foreground"
            style={{ left: c.col * (CARD_W + COL_GAP), top: 0, width: CARD_W }}
          >
            {c.round.replace(/_/g, " ")}
          </div>
        ))}

        {nodes.map((n) => (
          <div key={n.s.id} className="absolute" style={{ left: n.x, top: n.y, width: CARD_W, transform: "translateY(-50%)" }}>
            <SeriesBox s={n.s} teamName={teamName} />
          </div>
        ))}
      </div>
    </div>
  );
}

function computeLayout(series: PlayoffSeries[]) {
  const byId = new Map(series.map((s) => [s.id, s]));
  const feeders = new Map<string, PlayoffSeries[]>();
  for (const s of series) {
    const nid = s.nextSeriesId;
    if (nid && byId.has(nid)) {
      const arr = feeders.get(nid);
      if (arr) arr.push(s);
      else feeders.set(nid, [s]);
    }
  }

  // Distance à la racine (0 = finale) → colonne (les tours amont à gauche).
  const dist = new Map<string, number>();
  const distOf = (s: PlayoffSeries): number => {
    const cached = dist.get(s.id);
    if (cached !== undefined) return cached;
    const nid = s.nextSeriesId;
    const d = nid && byId.has(nid) ? distOf(byId.get(nid)!) + 1 : 0;
    dist.set(s.id, d);
    return d;
  };
  series.forEach(distOf);
  const maxDist = Math.max(0, ...series.map((s) => dist.get(s.id)!));
  const colOf = (s: PlayoffSeries) => maxDist - dist.get(s.id)!;

  // Placement vertical : post-ordre depuis la racine ; chaque feuille prend un
  // créneau, chaque série se centre entre ses qualifiés.
  const yOf = new Map<string, number>();
  let leaf = 0;
  const slotRank = (s: PlayoffSeries) => (s.nextSeriesSlot === "team_b" ? 1 : 0);
  const place = (s: PlayoffSeries): number => {
    const fs = (feeders.get(s.id) ?? [])
      .slice()
      .sort((a, b) => slotRank(a) - slotRank(b) || (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
    let y: number;
    if (fs.length === 0) {
      y = HEADER_H + leaf * ROW_H + ROW_H / 2;
      leaf++;
    } else {
      const ys = fs.map(place);
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    yOf.set(s.id, y);
    return y;
  };
  series
    .filter((s) => !s.nextSeriesId || !byId.has(s.nextSeriesId))
    .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
    .forEach(place);
  for (const s of series) {
    if (!yOf.has(s.id)) {
      yOf.set(s.id, HEADER_H + leaf * ROW_H + ROW_H / 2);
      leaf++;
    }
  }

  const nodes: LNode[] = series.map((s) => ({ s, x: colOf(s) * (CARD_W + COL_GAP), y: yOf.get(s.id)!, next: null }));
  const nodeById = new Map(nodes.map((n) => [n.s.id, n]));
  for (const n of nodes) {
    const nid = n.s.nextSeriesId;
    n.next = nid && nodeById.has(nid) ? nodeById.get(nid)! : null;
  }

  const colRound = new Map<number, string>();
  for (const s of series) if (!colRound.has(colOf(s))) colRound.set(colOf(s), s.round || "—");
  const cols = Array.from(colRound.entries()).map(([col, round]) => ({ col, round }));

  const width = (maxDist + 1) * (CARD_W + COL_GAP) - COL_GAP;
  const height = Math.max(HEADER_H + leaf * ROW_H, HEADER_H + ROW_H);
  return { nodes, cols, width, height };
}

function SeriesBox({ s, teamName }: { s: PlayoffSeries; teamName: (id: string | null, label: string | null) => string }) {
  const aWon = !!s.winnerId && s.winnerId === s.teamAId;
  const bWon = !!s.winnerId && s.winnerId === s.teamBId;
  const completed = s.status === "completed";
  const winNeeded = Math.ceil((s.bestOf ?? 1) / 2);

  return (
    <div
      className={
        "overflow-hidden rounded-lg border bg-card/80 backdrop-blur transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 " +
        (completed ? "ring-1 ring-primary/40 border-border" : "border-border")
      }
    >
      {/* Bandeau : tour + format (BOx) */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="truncate capitalize">{(s.round || "—").replace(/_/g, " ")}</span>
        <span className="ml-2 shrink-0 text-primary">BO{s.bestOf}</span>
      </div>

      <TeamRow name={teamName(s.teamAId, s.teamALabel)} score={s.teamAWins} won={aWon} eliminated={bWon} tbd={!s.teamAId} />
      <div className="h-px bg-border" />
      <TeamRow name={teamName(s.teamBId, s.teamBLabel)} score={s.teamBWins} won={bWon} eliminated={aWon} tbd={!s.teamBId} />

      {completed && (
        <div className="flex items-center gap-1 border-t border-primary/20 bg-primary/5 px-3 py-1 text-[10px] text-primary">
          <Crown className="h-3 w-3" />
          <span>Série terminée ({winNeeded} victoire{winNeeded > 1 ? "s" : ""})</span>
        </div>
      )}
    </div>
  );
}

function TeamRow({
  name, score, won, eliminated, tbd,
}: { name: string; score: number | null; won: boolean; eliminated: boolean; tbd: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${won ? "bg-primary/10" : ""} ${eliminated ? "opacity-50" : ""}`}>
      <span className={`truncate text-sm ${won ? "font-semibold" : "font-medium"} ${tbd ? "italic text-muted-foreground" : ""}`}>
        {name}
      </span>
      <span className={`w-6 shrink-0 text-right font-mono text-sm font-bold tabular-nums ${won ? "text-primary" : "text-muted-foreground"}`}>
        {score ?? 0}
      </span>
    </div>
  );
}

export default Bracket;
