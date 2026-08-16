import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserRound, RefreshCw, Search, Sparkles, SlidersHorizontal, Tags, Plus, X } from "lucide-react";
import { tierForElo } from "@shared/tiers";
import { RANKS, seedEloFromRank } from "@shared/rankElo";
import type { Competition, Player, Tier, Tag } from "@shared/schema";

type ConsoleTab = "elo" | "tiers" | "tags";

/**
 * Console admin Hydra — recalcul de l'Elo depuis les résultats + réglage manuel.
 */
export function HydraAdminPage() {
  const { toast } = useToast();
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const [tab, setTab] = useState<ConsoleTab>("elo");
  const [q, setQ] = useState("");
  const filtered = (players ?? [])
    .filter((p) => { const t = q.trim().toLowerCase(); return !t || p.pseudo.toLowerCase().includes(t) || (p.playerTag ?? "").toLowerCase().includes(t); })
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  const TABS: { key: ConsoleTab; label: string; icon: typeof Sparkles }[] = [
    { key: "elo", label: "Elo", icon: Sparkles },
    { key: "tiers", label: "Tiers", icon: SlidersHorizontal },
    { key: "tags", label: "Tags", icon: Tags },
  ];

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Hydra — administration</h1>

      <div className="flex items-center gap-1 border-b mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "elo" && (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Le tier est dérivé de l'Elo. Recalcule l'Elo depuis les résultats, ou ajuste-le à la main.
          </p>

          <RecomputeCard comps={comps ?? []} onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/players"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hydra/changelog"] });
          }} />

          <EloParamsCard />

          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="font-semibold">Elo de départ par joueur</h2>
            <div className="relative ml-auto w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un joueur…" className="pl-9 h-9" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            L'évaluation préliminaire de chaque joueur. Enregistrer relance automatiquement le recalcul pour l'appliquer.
          </p>
          <div className="space-y-2">
            {filtered.map((p) => (
              <EloRow key={p.id} player={p} tiers={tiers ?? []} onSaved={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/players"] });
                queryClient.invalidateQueries({ queryKey: ["/api/hydra/changelog"] });
                toast({ title: "Elo mis à jour", description: p.pseudo });
              }} />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">{q ? "Aucun joueur ne correspond." : "Aucun joueur. Ajoutez-en d'abord."}</p>
            )}
          </div>
        </>
      )}

      {tab === "tiers" && <TiersPanel />}
      {tab === "tags" && <TagsPanel />}
    </div>
  );
}

function RecomputeCard({ comps, onDone }: { comps: Competition[]; onDone: () => void }) {
  const { toast } = useToast();
  const [k, setK] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  const run = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/recompute-elo", {
        k: k.trim() ? Number(k) : undefined,
        competitionId: competitionId || undefined,
      })).json(),
    onSuccess: (r: { players: number; matches: number; k: number }) => {
      onDone();
      toast({ title: "Elo recalculé", description: `${r.matches} matchs traités · ${r.players} joueurs · K=${r.k}` });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 mb-8">
      <h2 className="font-semibold mb-1">Recalcul depuis les résultats</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Chaque joueur part de son <b>Elo de départ</b> ; on rejoue les matchs des compétitions comptant pour l'Elo
        (résultat via le vainqueur + rosters), avec un K <b>adaptatif</b> par défaut. Laisse K vide pour l'adaptatif,
        ou fixe une valeur pour forcer un K unique.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">K</label>
        <Input type="number" value={k} onChange={(e) => setK(e.target.value)} placeholder="auto" className="w-20 h-9" />
        <label className="text-sm text-muted-foreground">Périmètre</label>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Toutes les compétitions</option>
          {comps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" />{run.isPending ? "Calcul…" : "Recalculer l'Elo"}
        </Button>
      </div>
    </Card>
  );
}

type EloParams = { base: number; provisionalGames: number; kProvisional: number; kBase: number; kStableElo: number; kStable: number; priorGames: number };
const PARAM_FIELDS: { key: keyof EloParams; label: string; hint: string }[] = [
  { key: "base", label: "Elo de départ (défaut)", hint: "Base d'un joueur non évalué" },
  { key: "provisionalGames", label: "Matchs provisoires", hint: "Avant fin du calibrage" },
  { key: "kProvisional", label: "K provisoire", hint: "Calibrage rapide" },
  { key: "kBase", label: "K standard", hint: "Régime normal" },
  { key: "kStableElo", label: "Seuil « confirmé »", hint: "Elo où l'on stabilise" },
  { key: "kStable", label: "K confirmé", hint: "Haut de classement" },
  { key: "priorGames", label: "Confiance du rang", hint: "Ancrage vers l'Elo de départ (0 = aucun)" },
];

function EloParamsCard() {
  const { toast } = useToast();
  const { data } = useQuery<EloParams>({ queryKey: ["/api/elo/params"] });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setForm(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/elo/params", Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elo/params"] });
      toast({ title: "Paramètres Elo enregistrés", description: "Relance un recalcul pour les appliquer." });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 mb-8">
      <h2 className="font-semibold mb-1">Paramètres du moteur Elo</h2>
      <p className="text-xs text-muted-foreground mb-3">
        K adaptatif : provisoire (calibrage) → standard → confirmé (stabilité). Après modification, relance un recalcul.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PARAM_FIELDS.map((f) => (
          <label key={f.key} className="text-sm block">
            <span className="text-muted-foreground">{f.label}</span>
            <Input
              type="number"
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="mt-1 h-9"
            />
            <span className="text-[11px] text-muted-foreground">{f.hint}</span>
          </label>
        ))}
      </div>
      <Button size="sm" className="mt-3" disabled={save.isPending} onClick={() => save.mutate()}>
        Enregistrer les paramètres
      </Button>
    </Card>
  );
}

function EloRow({ player, tiers, onSaved }: { player: Player; tiers: Tier[]; onSaved: () => void }) {
  const { toast } = useToast();
  // On règle l'Elo de DÉPART (évaluation préliminaire) ; le recalcul l'applique.
  const [elo, setElo] = useState<string>(String(player.seedElo ?? 1000));
  const [showRank, setShowRank] = useState(false);
  const [rankKey, setRankKey] = useState("");
  const [trophies, setTrophies] = useState("");

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/players/${player.id}/elo`, { elo: Number(elo) }),
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const setMode = useMutation({
    mutationFn: (mode: string) => apiRequest("PATCH", `/api/players/${player.id}`, { modeOverride: mode || null }),
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const previewTier = tierForElo(Number(elo), tiers);
  const suggestion = rankKey ? seedEloFromRank(rankKey, Number(trophies) || 0) : null;

  return (
    <Card className="p-2.5">
      <div className="flex items-center gap-3">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt={player.pseudo} className="h-9 w-9 rounded object-cover bg-muted" />
        ) : (
          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
            <UserRound className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{player.pseudo}</div>
          <div className="text-xs text-muted-foreground truncate">{player.playerTag ?? "—"}</div>
        </div>
        {previewTier && (
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: previewTier.color ?? "#666" }}>
            {previewTier.code}
          </span>
        )}
        <select
          value={player.modeOverride ?? ""}
          onChange={(e) => setMode.mutate(e.target.value)}
          className="h-9 rounded-md border bg-background px-1.5 text-xs shrink-0"
          title="Statut Hydra — Auto = déduit (Rookie si 0 compétition, Réserve si inactif)"
        >
          <option value="">Auto</option>
          <option value="joueurs">Joueurs</option>
          <option value="rookie">Rookie</option>
          <option value="reserve">Réserve</option>
        </select>
        <Input type="number" value={elo} onChange={(e) => setElo(e.target.value)} className="w-24 h-9" />
        <Button size="sm" variant="ghost" onClick={() => setShowRank((s) => !s)} title="Suggérer l'Elo de départ depuis le rang Ranked">
          Rang
        </Button>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "…" : "Définir"}
        </Button>
      </div>

      {showRank && (
        <div className="flex items-center gap-2 mt-2 flex-wrap pl-12 text-sm">
          <span className="text-xs text-muted-foreground">Rang Ranked</span>
          <select value={rankKey} onChange={(e) => setRankKey(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="">—</option>
            {RANKS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">Trophées</span>
          <Input type="number" value={trophies} onChange={(e) => setTrophies(e.target.value)} placeholder="ex. 45000" className="w-28 h-8" />
          <Button size="sm" variant="outline" disabled={suggestion == null} onClick={() => suggestion != null && setElo(String(suggestion))}>
            Suggérer
          </Button>
          {suggestion != null && <span className="text-xs text-muted-foreground">→ {suggestion} Elo de départ</span>}
        </div>
      )}
    </Card>
  );
}

/* ============================================================ Tiers ======= */
function TiersPanel() {
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const ordered = [...(tiers ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">
        Un joueur est classé dans le tier dont le seuil d'Elo est le plus haut tout en restant sous sa cote.
      </p>
      <div className="space-y-2">
        {ordered.map((t) => <TierRow key={t.id} tier={t} />)}
        {ordered.length === 0 && <p className="text-sm text-muted-foreground">Aucun tier.</p>}
      </div>
    </div>
  );
}

function TierRow({ tier }: { tier: Tier }) {
  const { toast } = useToast();
  const [minElo, setMinElo] = useState(String(tier.minElo));
  const [color, setColor] = useState(tier.color ?? "#666666");
  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/tiers/${tier.id}`, { minElo: Number(minElo), color }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tiers"] }); toast({ title: "Palier mis à jour", description: tier.code }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  return (
    <Card className="flex items-center gap-3 p-2.5">
      <span className="w-14 shrink-0 text-center font-extrabold text-white rounded py-1" style={{ backgroundColor: color }}>{tier.code}</span>
      <label className="text-xs text-muted-foreground">Elo min.</label>
      <Input type="number" value={minElo} onChange={(e) => setMinElo(e.target.value)} className="w-24 h-9" />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 rounded border bg-transparent cursor-pointer" title="Couleur" />
      <Button size="sm" className="ml-auto" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "…" : "Enregistrer"}</Button>
    </Card>
  );
}

/* ============================================================ Tags ========= */
type PlayerTagRow = { playerId: string; tagId: string; code: string; label: string; family: "palmares" | "comportement"; color: string | null };

function TagsPanel() {
  const { toast } = useToast();
  const { data: tags } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: assignments } = useQuery<PlayerTagRow[]>({ queryKey: ["/api/player-tags"] });

  const byPlayer = useMemo(() => {
    const map = new Map<string, PlayerTagRow[]>();
    for (const a of assignments ?? []) { if (!map.has(a.playerId)) map.set(a.playerId, []); map.get(a.playerId)!.push(a); }
    return map;
  }, [assignments]);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [family, setFamily] = useState<"palmares" | "comportement">("comportement");
  const [color, setColor] = useState("#3BA7E2");

  const createTag = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tags", { code, label, family, color }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tags"] }); setCode(""); setLabel(""); toast({ title: "Tag créé" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const deleteTag = useMutation({
    mutationFn: (tid: string) => apiRequest("DELETE", `/api/tags/${tid}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tags"] }); queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] }); },
  });
  const assign = useMutation({
    mutationFn: ({ playerId, tagId }: { playerId: string; tagId: string }) => apiRequest("POST", `/api/players/${playerId}/tags`, { tagId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] }),
  });
  const unassign = useMutation({
    mutationFn: ({ playerId, tagId }: { playerId: string; tagId: string }) => apiRequest("DELETE", `/api/players/${playerId}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] }),
  });

  return (
    <div>
      <Card className="p-4 mb-8">
        <h2 className="font-semibold mb-3">Catalogue</h2>
        <form className="flex flex-wrap items-center gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); if (code.trim() && label.trim()) createTag.mutate(); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="code (ex. champion)" className="w-40" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex. Champion)" className="w-44" />
          <select value={family} onChange={(e) => setFamily(e.target.value as "palmares" | "comportement")} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="palmares">Palmarès</option>
            <option value="comportement">Comportement</option>
          </select>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 rounded border bg-transparent cursor-pointer" />
          <Button type="submit" size="sm" disabled={createTag.isPending || !code.trim() || !label.trim()}>
            <Plus className="h-4 w-4 mr-1" />Créer
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mb-2">
          Bonus Elo : ajouté à l'<b>Elo de départ</b> du joueur. Seul le tag au bonus le plus élevé compte (pas de cumul). Réservé aux palmarès.
        </p>
        <div className="space-y-2">
          {(tags ?? []).map((t) => <TagRow key={t.id} tag={t} onDelete={() => deleteTag.mutate(t.id)} />)}
          {(!tags || tags.length === 0) && <span className="text-sm text-muted-foreground">Aucun tag.</span>}
        </div>
      </Card>

      <h2 className="font-semibold mb-3">Attribution aux joueurs</h2>
      <div className="space-y-2">
        {(players ?? []).map((p) => {
          const current = byPlayer.get(p.id) ?? [];
          const currentIds = new Set(current.map((c) => c.tagId));
          const available = (tags ?? []).filter((t) => !currentIds.has(t.id));
          return (
            <Card key={p.id} className="flex items-center gap-3 p-2.5 flex-wrap">
              <span className="font-medium min-w-[8rem]">{p.pseudo}</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {current.map((c) => (
                  <span key={c.tagId} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: c.color ?? "#666" }}>
                    {c.label}
                    <button onClick={() => unassign.mutate({ playerId: p.id, tagId: c.tagId })} className="opacity-80 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {current.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <select value="" onChange={(e) => { if (e.target.value) assign.mutate({ playerId: p.id, tagId: e.target.value }); }} className="h-8 rounded-md border bg-background px-2 text-sm" disabled={available.length === 0}>
                <option value="">+ Ajouter un tag</option>
                {available.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Card>
          );
        })}
        {(!players || players.length === 0) && <p className="text-sm text-muted-foreground">Aucun joueur.</p>}
      </div>
    </div>
  );
}

function TagRow({ tag, onDelete }: { tag: Tag; onDelete: () => void }) {
  const { toast } = useToast();
  const [bonus, setBonus] = useState(String(tag.eloBonus ?? 0));
  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/tags/${tag.id}`, { eloBonus: Number(bonus) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tags"] }); toast({ title: "Bonus mis à jour", description: tag.label }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  return (
    <Card className="flex items-center gap-2 p-2 flex-wrap">
      <span className="text-xs font-medium px-2 py-1 rounded text-white" style={{ backgroundColor: tag.color ?? "#666" }}>{tag.label}</span>
      <span className="text-[11px] text-muted-foreground">{tag.family === "palmares" ? "Palmarès" : "Comportement"}</span>
      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Bonus Elo</label>
        <Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} className="w-20 h-8" />
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>OK</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete} title="Supprimer"><X className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}

export default HydraAdminPage;
