import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, UserRound, Sparkles, Wrench, X, LayoutGrid, Rows3, ArrowDownWideNarrow,
  ArrowDownAZ, BookOpen, Users2, Layers, Sprout, Moon, SearchX, Filter,
} from "lucide-react";
import { tierForElo } from "@shared/tiers";
import { useMe } from "@/hooks/use-me";
import { HydraSectionBlock } from "@/components/hydra-section";
import { HydraChangelog } from "@/components/hydra-changelog";
import type { Player, Tier, HydraSection } from "@shared/schema";

type PlayerTagRow = {
  playerId: string; tagId: string; code: string; label: string;
  family: "palmares" | "comportement"; color: string | null;
};

type Mode = "joueurs" | "rookie" | "reserve";
type Density = "grille" | "liste";
type Sort = "elo" | "az";

const DAY = 86400000;
const RESERVE_DAYS = 90; // inactivité au-delà de laquelle un joueur passe en Réserve

/** Mode dérivé d'un joueur (non stocké). */
function playerMode(p: Player): Mode {
  if ((p.competitionsPlayed ?? 0) === 0) return "rookie";
  if (p.lastEloChangeAt && Date.now() - new Date(p.lastEloChangeAt).getTime() > RESERVE_DAYS * DAY) return "reserve";
  return "joueurs";
}

function eloRange(tier: Tier, tiers: Tier[]): string {
  const higher = tiers.filter((t) => t.minElo > tier.minElo).sort((a, b) => a.minElo - b.minElo)[0];
  return higher ? `${tier.minElo}–${higher.minElo - 1}` : `${tier.minElo}+`;
}

/** Décompose une couleur hex (#rgb ou #rrggbb) en canaux 0-255. */
function channels(hex: string | null): [number, number, number] {
  const h = (hex ?? "#6b7280").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isNaN(n) ? [107, 114, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const tint = (hex: string | null, alpha: number) => {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Encre lisible sur un aplat de tier : les tiers clairs (or, cyan…) rendaient le
 * blanc illisible dans la v1, où il était appliqué systématiquement.
 */
function inkOn(hex: string | null): string {
  const [r, g, b] = channels(hex);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#111110" : "#ffffff";
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "joueurs", label: "Joueurs", hint: "Actifs, au moins une compétition jouée" },
  { id: "rookie", label: "Rookie", hint: "Jamais entrés en compétition" },
  { id: "reserve", label: "Réserve", hint: `Sans évolution d'Elo depuis ${RESERVE_DAYS} jours` },
];

/**
 * Hydra v2 — refonte de l'UI du classement par tiers.
 *
 * Changements de structure vs. /hydra :
 * - le classement passe au-dessus de la documentation (v1 : accordéon de règles
 *   en premier, classement repoussé hors de l'écran) ;
 * - barre de contrôle collante (mode, recherche, tri, densité, tags) ;
 * - couloirs de tier lisibles (compte, plage d'Elo, encre contrastée) ;
 * - états de chargement et états vides explicites ;
 * - cartes joueur cliquables vers la fiche, avec Elo visible.
 */
export function HydraV2Page() {
  const [mode, setMode] = useState<Mode>("joueurs");
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [density, setDensity] = useState<Density>("grille");
  const [sort, setSort] = useState<Sort>("elo");
  const [showDocs, setShowDocs] = useState(false);

  const { data: tiers, isLoading: tiersLoading } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: sections } = useQuery<HydraSection[]>({ queryKey: ["/api/hydra/sections"] });
  const { isAdmin, isLoading: authLoading } = useMe();
  const { data: playerTags } = useQuery<PlayerTagRow[]>({ queryKey: ["/api/player-tags"] });

  const loading = tiersLoading || playersLoading;

  const tagsByPlayer = useMemo(() => {
    const map = new Map<string, PlayerTagRow[]>();
    for (const a of playerTags ?? []) { if (!map.has(a.playerId)) map.set(a.playerId, []); map.get(a.playerId)!.push(a); }
    return map;
  }, [playerTags]);

  const allTags = useMemo(() => {
    const seen = new Map<string, PlayerTagRow>();
    for (const a of playerTags ?? []) if (!seen.has(a.tagId)) seen.set(a.tagId, a);
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [playerTags]);

  const modeCounts = useMemo(() => {
    const c: Record<Mode, number> = { joueurs: 0, rookie: 0, reserve: 0 };
    for (const p of players ?? []) c[playerMode(p)]++;
    return c;
  }, [players]);

  const rows = useMemo(() => {
    const allTiers = tiers ?? [];
    const allPlayers = players ?? [];
    const needle = q.trim().toLowerCase();
    const visible = allPlayers.filter((p) => {
      if (playerMode(p) !== mode) return false;
      if (needle && !p.pseudo.toLowerCase().includes(needle)) return false;
      if (selectedTags.length > 0) {
        const ids = (tagsByPlayer.get(p.id) ?? []).map((t) => t.tagId);
        if (!selectedTags.some((s) => ids.includes(s))) return false;
      }
      return true;
    });
    const cmp = (a: Player, b: Player) =>
      sort === "az" ? a.pseudo.localeCompare(b.pseudo) : (b.elo ?? 0) - (a.elo ?? 0) || a.pseudo.localeCompare(b.pseudo);
    const byTier = new Map<string, Player[]>();
    const unranked: Player[] = [];
    for (const p of visible) {
      const t = tierForElo(p.elo, allTiers);
      if (!t) unranked.push(p);
      else { if (!byTier.has(t.id)) byTier.set(t.id, []); byTier.get(t.id)!.push(p); }
    }
    const ordered = [...allTiers].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => ({
      tier: t, range: eloRange(t, allTiers), players: (byTier.get(t.id) ?? []).sort(cmp),
    }));
    return { ordered, unranked: unranked.sort(cmp), total: visible.length };
  }, [tiers, players, q, selectedTags, tagsByPlayer, mode, sort]);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filtering = q.trim() !== "" || selectedTags.length > 0;
  const resetFilters = () => { setQ(""); setSelectedTags([]); };

  if (authLoading) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAdmin) return <MaintenanceGate />;

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* ── En-tête : identité + repères chiffrés ─────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-xl border border-card-border bg-card p-5 sm:p-6 mb-4"
        style={{ backgroundImage: "radial-gradient(ellipse 80% 120% at 0% 0%, hsl(48 96% 53% / .10), transparent 60%)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-gold">Hydra</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-prose">
              Programme de classement par tiers. Tous les joueurs qui participent à une compétition en font partie.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDocs((v) => !v)}
            aria-expanded={showDocs}
            className="shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-md border border-card-border bg-background/60 text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {showDocs ? "Masquer les règles" : "Règles & changelogs"}
          </button>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <StatTile icon={Users2} label="Classés" value={modeCounts.joueurs} loading={loading} accent />
          <StatTile icon={Layers} label="Tiers" value={tiers?.length ?? 0} loading={loading} />
          <StatTile icon={Sprout} label="Rookies" value={modeCounts.rookie} loading={loading} />
          <StatTile icon={Moon} label="Réserve" value={modeCounts.reserve} loading={loading} />
        </dl>
      </header>

      {/* ── Documentation : repliée par défaut, sous l'en-tête ────────────── */}
      {showDocs && (
        <div className="mb-4 rounded-xl border border-card-border bg-card px-4 sm:px-5 animate-fade-in motion-reduce:animate-none">
          <Accordion type="single" collapsible>
            {(sections ?? []).map((s) => (
              <AccordionItem key={s.key} value={s.key}>
                <AccordionTrigger className="text-sm">{s.title}</AccordionTrigger>
                <AccordionContent>
                  <HydraSectionBlock section={s} isAdmin={isAdmin} />
                </AccordionContent>
              </AccordionItem>
            ))}
            <AccordionItem value="changelog" className="border-b-0">
              <AccordionTrigger className="text-sm">Changelogs</AccordionTrigger>
              <AccordionContent>
                <HydraChangelog />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* ── Barre de contrôle collante ───────────────────────────────────── */}
      <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-background/85 backdrop-blur border-b border-border mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Segments de mode */}
          <div role="group" aria-label="Population affichée" className="inline-flex p-0.5 rounded-lg bg-muted border border-muted-border">
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setMode(m.id)}
                      className={
                        "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/70")
                      }
                    >
                      {m.label}
                      <span className={"tabular-nums text-xs " + (on ? "opacity-75" : "opacity-60")}>{modeCounts[m.id]}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{m.hint}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Recherche */}
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs order-last sm:order-none w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un joueur…"
              aria-label="Rechercher un joueur"
              className="pl-9 pr-8 h-9"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center rounded-sm text-muted-foreground cursor-pointer transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <SegmentToggle
              label="Tri"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { id: "elo", icon: ArrowDownWideNarrow, hint: "Trier par Elo décroissant" },
                { id: "az", icon: ArrowDownAZ, hint: "Trier par ordre alphabétique" },
              ]}
            />
            <SegmentToggle
              label="Affichage"
              value={density}
              onChange={(v) => setDensity(v as Density)}
              options={[
                { id: "grille", icon: LayoutGrid, hint: "Affichage en grille d'avatars" },
                { id: "liste", icon: Rows3, hint: "Affichage compact en liste" },
              ]}
            />
          </div>
        </div>

        {/* Filtres par tag + effectif courant */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {allTags.length > 0 && (
            <>
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              {allTags.map((t) => {
                const on = selectedTags.includes(t.tagId);
                return (
                  <button
                    key={t.tagId}
                    type="button"
                    onClick={() => toggleTag(t.tagId)}
                    aria-pressed={on}
                    className={
                      "text-xs font-medium px-2 h-6 rounded-full cursor-pointer transition-all duration-200 ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (on ? "ring-current" : "ring-transparent hover:brightness-125")
                    }
                    style={{
                      backgroundColor: tint(t.color, on ? 0.9 : 0.16),
                      color: on ? inkOn(t.color) : t.color ?? undefined,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </>
          )}
          {filtering && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted-foreground underline underline-offset-2 ml-1 cursor-pointer transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              réinitialiser
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {rows.total} joueur{rows.total > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Couloirs de tier ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : !tiers || tiers.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Aucun tier configuré"
          hint="Créez les paliers d'Elo depuis la console d'administration pour afficher le classement."
          action={{ href: "/admin/tiers", label: "Configurer les tiers" }}
        />
      ) : rows.total === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filtering ? "Aucun joueur ne correspond" : "Aucun joueur dans ce mode"}
          hint={
            filtering
              ? "Élargissez la recherche ou retirez des filtres de tag."
              : MODES.find((m) => m.id === mode)?.hint
          }
          action={filtering ? { onClick: resetFilters, label: "Réinitialiser les filtres" } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {rows.ordered.map(({ tier, range, players: list }, i) => (
            <TierLane
              key={tier.id}
              code={tier.code}
              label={tier.label}
              range={range}
              color={tier.color}
              players={list}
              tagsByPlayer={tagsByPlayer}
              density={density}
              index={i}
            />
          ))}
          {rows.unranked.length > 0 && (
            <TierLane
              code="N/C"
              label="Non classés"
              range="Sans Elo"
              color={null}
              players={rows.unranked}
              tagsByPlayer={tagsByPlayer}
              density={density}
              index={rows.ordered.length}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Repère chiffré de l'en-tête. Encre sur jetons de texte, jamais colorée par la valeur. */
function StatTile({
  icon: Icon, label, value, loading, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; loading: boolean; accent?: boolean;
}) {
  return (
    <div className={"rounded-lg border px-3 py-2.5 " + (accent ? "border-primary/25 bg-primary/[.06]" : "border-card-border bg-background/40")}>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {loading ? <Skeleton className="h-6 w-10" /> : value}
      </dd>
    </div>
  );
}

/** Groupe de boutons icône exclusifs (tri, densité). */
function SegmentToggle({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; icon: React.ComponentType<{ className?: string }>; hint: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex p-0.5 rounded-lg bg-muted border border-muted-border">
      {options.map((o) => {
        const on = value === o.id;
        const Icon = o.icon;
        return (
          <Tooltip key={o.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(o.id)}
                aria-label={o.hint}
                aria-pressed={on}
                className={
                  "grid place-items-center h-8 w-8 rounded-md cursor-pointer transition-all duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                  (on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{o.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Un palier : rail identitaire (code, plage, effectif) + corps des joueurs. */
function TierLane({
  code, label, range, color, players, tagsByPlayer, density, index,
}: {
  code: string; label: string | null; range: string; color: string | null;
  players: Player[]; tagsByPlayer: Map<string, PlayerTagRow[]>; density: Density; index: number;
}) {
  const ink = inkOn(color);
  return (
    <section
      aria-label={`Tier ${code}`}
      className="flex flex-col sm:flex-row rounded-xl border overflow-hidden opacity-0 animate-fade-in-up motion-reduce:animate-none motion-reduce:opacity-100"
      style={{
        animationDelay: `${Math.min(index, 8) * 45}ms`,
        borderColor: tint(color, 0.35),
        backgroundColor: tint(color, 0.05),
      }}
    >
      {/* Rail : barre horizontale en mobile, colonne en desktop */}
      <div
        className="flex sm:flex-col items-center sm:justify-center gap-2 sm:gap-0.5 shrink-0 px-3 py-2 sm:w-[104px] sm:py-4"
        style={{ background: `linear-gradient(160deg, ${tint(color, 1)} 0%, ${tint(color, 0.78)} 100%)`, color: ink }}
      >
        <span className="text-lg sm:text-2xl font-extrabold leading-none tracking-tight">{code}</span>
        <span className="text-[10px] font-medium opacity-80 tabular-nums sm:mt-1">{range}</span>
        <span
          className="ml-auto sm:ml-0 sm:mt-2 text-[10px] font-semibold tabular-nums px-1.5 h-4 grid place-items-center rounded-full"
          style={{ backgroundColor: ink === "#ffffff" ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.45)" }}
        >
          {players.length}
        </span>
        {label && <span className="sr-only">{label}</span>}
      </div>

      {/* Corps */}
      <div className="flex-1 min-w-0 p-3 sm:p-4 min-h-[92px] flex items-start">
        {players.length === 0 ? (
          <span className="text-xs text-muted-foreground self-center">Aucun joueur à ce palier</span>
        ) : density === "grille" ? (
          <div className="flex flex-wrap gap-x-3 gap-y-4 content-start w-full">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} tags={tagsByPlayer.get(p.id) ?? []} accent={color} />
            ))}
          </div>
        ) : (
          <ul className="w-full divide-y divide-border/60">
            {players.map((p) => (
              <PlayerRow key={p.id} player={p} tags={tagsByPlayer.get(p.id) ?? []} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Carte joueur (grille) : avatar, Elo lisible, pseudo, tags — cliquable vers la fiche. */
function PlayerCard({ player, tags, accent }: { player: Player; tags: PlayerTagRow[]; accent: string | null }) {
  return (
    <Link
      href={`/joueurs/${player.id}`}
      className="group w-[84px] flex flex-col items-center text-center rounded-lg cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt=""
            className="h-[72px] w-[72px] rounded-lg object-cover bg-muted ring-1 transition-shadow duration-200"
            style={{ boxShadow: `0 0 0 1px ${tint(accent, 0.45)}` }}
            loading="lazy"
            width={72}
            height={72}
          />
        ) : (
          <div
            className="h-[72px] w-[72px] rounded-lg bg-muted grid place-items-center"
            style={{ boxShadow: `0 0 0 1px ${tint(accent, 0.45)}` }}
          >
            <UserRound className="h-8 w-8 text-muted-foreground" aria-hidden />
          </div>
        )}
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 h-[18px] grid place-items-center rounded-full bg-background/95 border border-card-border text-[10px] font-semibold tabular-nums shadow-sm">
          {player.elo ?? "—"}
        </span>
      </div>
      <span className="mt-2.5 text-xs font-semibold leading-tight break-words w-full transition-colors duration-200 group-hover:text-primary">
        {player.pseudo}
      </span>
      {tags.length > 0 && (
        <div className="mt-0.5 flex flex-wrap justify-center gap-x-1.5 leading-tight">
          {tags.map((t) => (
            <span key={t.tagId} className="text-[10px] font-medium" style={{ color: t.color ?? undefined }}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/** Ligne joueur (mode compact) : plus dense, scannable verticalement. */
function PlayerRow({ player, tags }: { player: Player; tags: PlayerTagRow[] }) {
  return (
    <li>
      <Link
        href={`/joueurs/${player.id}`}
        className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-md cursor-pointer transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="h-7 w-7 rounded object-cover bg-muted shrink-0" loading="lazy" width={28} height={28} />
        ) : (
          <span className="h-7 w-7 rounded bg-muted grid place-items-center shrink-0">
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
        )}
        <span className="text-sm font-medium truncate">{player.pseudo}</span>
        <span className="flex flex-wrap gap-x-1.5 min-w-0">
          {tags.map((t) => (
            <span key={t.tagId} className="text-[10px] font-medium whitespace-nowrap" style={{ color: t.color ?? undefined }}>
              {t.label}
            </span>
          ))}
        </span>
        <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
          {player.elo ?? "—"}
        </span>
      </Link>
    </li>
  );
}

/** État vide guidé (règle UX « Empty States » : message + action, jamais un blanc). */
function EmptyState({
  icon: Icon, title, hint, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; hint?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const cls =
    "inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  return (
    <div className="rounded-xl border border-dashed border-card-border bg-card/40 px-6 py-14 text-center">
      <span className="grid place-items-center h-11 w-11 rounded-full bg-muted mx-auto mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link href={action.href} className={cls}>{action.label}</Link>
          ) : (
            <button type="button" onClick={action.onClick} className={cls}>{action.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Page réservée aux administrateurs pendant la maintenance. */
function MaintenanceGate() {
  return (
    <div className="w-full px-6 py-20 flex justify-center">
      <div className="max-w-md text-center rounded-xl border border-card-border bg-card p-8">
        <span className="grid place-items-center h-12 w-12 rounded-full bg-primary/15 ring-1 ring-primary/30 mx-auto mb-4">
          <Wrench className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <h1 className="text-xl font-bold mb-2">Hydra — en maintenance</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Cette page est temporairement en maintenance. Elle n'est accessible qu'aux administrateurs connectés.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Connexion admin
        </Link>
      </div>
    </div>
  );
}

export default HydraV2Page;
