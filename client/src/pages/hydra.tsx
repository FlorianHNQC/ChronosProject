import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search, UserRound, Sparkles } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import type { Player, Tier } from "@shared/schema";

type ChangelogEntry = {
  id: string; pseudo: string | null; oldElo: number | null; newElo: number | null;
  comment: string | null; createdAt: string | null;
};
type PlayerTagRow = {
  playerId: string; tagId: string; code: string; label: string;
  family: "palmares" | "comportement"; color: string | null;
};

type Mode = "joueurs" | "rookie" | "reserve";
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

/**
 * Section Hydra — classement par tiers. Modes Joueurs / Rookie (jamais joué) /
 * Réserve (inactif), dérivés des signaux du joueur.
 */
export function HydraPage() {
  const [mode, setMode] = useState<Mode>("joueurs");
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: changelog } = useQuery<ChangelogEntry[]>({ queryKey: ["/api/hydra/changelog"] });
  const { data: playerTags } = useQuery<PlayerTagRow[]>({ queryKey: ["/api/player-tags"] });

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

  const MODES: { id: Mode; label: string }[] = [
    { id: "joueurs", label: "Joueurs" },
    { id: "rookie", label: "Rookie" },
    { id: "reserve", label: "Réserve" },
  ];

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
    const byTier = new Map<string, Player[]>();
    const unranked: Player[] = [];
    for (const p of visible) {
      const t = tierForElo(p.elo, allTiers);
      if (!t) unranked.push(p);
      else { if (!byTier.has(t.id)) byTier.set(t.id, []); byTier.get(t.id)!.push(p); }
    }
    const ordered = [...allTiers].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => ({
      tier: t, range: eloRange(t, allTiers),
      players: (byTier.get(t.id) ?? []).sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    }));
    return { ordered, unranked: unranked.sort((a, b) => a.pseudo.localeCompare(b.pseudo)) };
  }, [tiers, players, q, selectedTags, tagsByPlayer, mode]);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Hydra</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Programme de classement par tiers. Tous les joueurs qui participent à une compétition en font partie.
      </p>

      <Accordion type="single" collapsible className="mb-6 border rounded-lg px-4">
        <AccordionItem value="about">
          <AccordionTrigger>À propos de Hydra</AccordionTrigger>
          <AccordionContent>
            Un outil d'organisation, pas un jugement de valeur : le tier sert à répartir le niveau pour des compétitions disputées.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="tags">
          <AccordionTrigger>Catégories et tags</AccordionTrigger>
          <AccordionContent>
            Palmarès (Champion…) et comportement (Nomade, Drifter actif…). Utilisez les filtres ci-dessous.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="notes">
          <AccordionTrigger>Notes (notation)</AccordionTrigger>
          <AccordionContent>
            Le tier est dérivé de l'Elo, piloté d'abord par les résultats. Seuils configurables.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="criteria">
          <AccordionTrigger>Critères</AccordionTrigger>
          <AccordionContent>
            <b>Joueurs</b> : ont déjà joué une compétition. <b>Rookie</b> : nouveaux venus (aucune compétition jouée). <b>Réserve</b> : inactifs depuis plus de {RESERVE_DAYS} jours.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="changelog">
          <AccordionTrigger>Changelogs</AccordionTrigger>
          <AccordionContent>
            {changelog && changelog.length > 0 ? (
              <ul className="space-y-1.5">
                {changelog.map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-medium">{c.pseudo ?? "?"}</span>{" "}
                    <span className="text-muted-foreground">{c.oldElo ?? "—"} → {c.newElo ?? "—"}</span>
                    {c.comment ? <span className="text-muted-foreground"> · {c.comment}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground">Aucune évolution enregistrée pour l'instant.</span>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-center gap-2 mb-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={"px-3 py-1.5 rounded-md text-sm font-medium transition-colors " + (mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
          >
            {m.label} <span className="opacity-70">({modeCounts[m.id]})</span>
          </button>
        ))}
        <div className="relative ml-auto w-56 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9 h-9" />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-muted-foreground mr-1">Filtrer :</span>
          {allTags.map((t) => {
            const on = selectedTags.includes(t.tagId);
            return (
              <button key={t.tagId} onClick={() => toggleTag(t.tagId)}
                className={"text-xs font-medium px-2 py-0.5 rounded transition-opacity " + (on ? "text-white" : "text-white/70 opacity-60 hover:opacity-100")}
                style={{ backgroundColor: t.color ?? "#666", outline: on ? "2px solid white" : "none" }}>
                {t.label}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button onClick={() => setSelectedTags([])} className="text-xs text-muted-foreground underline ml-1">réinitialiser</button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {(!tiers || tiers.length === 0) && <p className="text-sm text-muted-foreground">Aucun tier configuré.</p>}
        {rows.ordered.map(({ tier, range, players }) => (
          <div key={tier.id} className="flex rounded-lg border overflow-hidden">
            <div className="flex flex-col items-center justify-center gap-0.5 w-24 shrink-0 py-3 text-white" style={{ backgroundColor: tier.color ?? "#666" }}>
              <span className="text-xl font-extrabold leading-none">{tier.code}</span>
              <span className="text-[10px] opacity-80 mt-0.5">{range}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-4 p-4 flex-1 min-h-[104px] items-start content-start">
              {players.length === 0 ? (
                <span className="text-xs text-muted-foreground self-center">—</span>
              ) : (
                players.map((p) => <PlayerCard key={p.id} player={p} tags={tagsByPlayer.get(p.id) ?? []} />)
              )}
            </div>
          </div>
        ))}
        {rows.unranked.length > 0 && (
          <div className="flex rounded-lg border overflow-hidden opacity-90">
            <div className="flex flex-col items-center justify-center w-24 shrink-0 py-3 text-white bg-muted-foreground">
              <span className="text-xl font-extrabold leading-none">N/C</span>
              <span className="text-[10px] opacity-80 mt-0.5">Sans Elo</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-4 p-4 flex-1 items-start content-start">
              {rows.unranked.map((p) => <PlayerCard key={p.id} player={p} tags={tagsByPlayer.get(p.id) ?? []} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ player, tags }: { player: Player; tags: PlayerTagRow[] }) {
  return (
    <div className="w-[84px] flex flex-col items-center text-center" title={`Elo ${player.elo ?? "—"}`}>
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt={player.pseudo} className="h-[76px] w-[76px] rounded-lg object-cover bg-muted ring-1 ring-border" loading="lazy" />
      ) : (
        <div className="h-[76px] w-[76px] rounded-lg bg-muted flex items-center justify-center ring-1 ring-border">
          <UserRound className="h-9 w-9 text-muted-foreground" />
        </div>
      )}
      <span className="mt-1 text-xs font-semibold leading-tight break-words w-full">{player.pseudo}</span>
      {tags.length > 0 && (
        <div className="mt-0.5 flex flex-wrap justify-center gap-x-1.5 leading-tight">
          {tags.map((t) => (
            <span key={t.tagId} className="text-[11px] font-medium" style={{ color: t.color ?? undefined }} title={t.label}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default HydraPage;
