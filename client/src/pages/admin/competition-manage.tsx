import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, Info, LayoutList, Users, CalendarDays, Shuffle,
  Play, Archive, Copy, Trash2, Plus, X, ArrowUp, ArrowDown,
  ArrowLeftRight, LayoutGrid, GitBranch, Trophy, ShieldCheck, Repeat, Award,
} from "lucide-react";
import { CompetitionTeamsPanel } from "@/components/admin/competition-teams-panel";
import { CompetitionMatchesPanel } from "@/components/admin/competition-matches-panel";
import { RandomTournamentPanel } from "@/components/admin/random-tournament-panel";
import { CompositionRulesPanel } from "@/components/admin/composition-rules-panel";
import { DriftersPanel } from "@/components/admin/drifters-panel";
import { AwardsAdminPanel } from "@/components/admin/awards-admin-panel";
import type { Competition, CompetitionPhase } from "@shared/schema";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "#8B93A7" },
  active: { label: "Active", color: "#2E7D32" },
  archived: { label: "Archivée", color: "#B45309" },
};

// --- Formats de phase (partagés avec le créateur de tournoi) ---
type FmtKey = "season" | "swiss" | "groups" | "bracket" | "random";
const FORMATS: { key: FmtKey; label: string; icon: typeof CalendarDays; desc: string }[] = [
  { key: "season", label: "Saison / round robin", icon: CalendarDays, desc: "Tout le monde s'affronte, classement aux points." },
  { key: "swiss", label: "Suisse", icon: ArrowLeftRight, desc: "Adversaire de niveau proche chaque tour ; pas d'élimination." },
  { key: "groups", label: "Poules", icon: LayoutGrid, desc: "Groupes en round robin ; les meilleurs se qualifient." },
  { key: "bracket", label: "Bracket", icon: GitBranch, desc: "Élimination directe (simple ou double)." },
  { key: "random", label: "Aléatoire", icon: Shuffle, desc: "Trios tirés au sort, changent chaque tour." },
];
const fmt = (k: string) => FORMATS.find((f) => f.key === k);

type TabKey = "infos" | "phases" | "equipes" | "matchs" | "aleatoire" | "regles" | "drifters" | "recompenses";

function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Page de gestion d'une compétition — le hub unique : infos & dates, phases,
 * équipes, matchs, et (pour un tournoi aléatoire) le module de tirage.
 */
export function CompetitionManagePage() {
  const { id = "" } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: comp } = useQuery<Competition>({
    queryKey: ["/api/competitions", id],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/competitions/${id}`)).json(),
  });
  const { data: phases } = useQuery<CompetitionPhase[]>({
    queryKey: ["/api/competitions", id, "phases"],
    enabled: !!id,
    queryFn: async () => (await apiRequest("GET", `/api/competitions/${id}/phases`)).json(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/competitions", id] });
  };

  const isRandom = useMemo(
    () => !!comp?.randomTeams || (phases ?? []).some((p) => p.type === "random"),
    [comp, phases],
  );

  const isArchived = comp?.status === "archived";

  const [tab, setTab] = useState<TabKey>("infos");
  // Ne pas rester coincé sur un onglet devenu invisible.
  useEffect(() => {
    if (tab === "aleatoire" && !isRandom) setTab("infos");
    if (tab === "recompenses" && !isArchived) setTab("infos");
  }, [tab, isRandom, isArchived]);

  const activate = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/competitions/${id}`, { status: "active" }),
    onSuccess: () => { invalidate(); toast({ title: "Activée" }); },
  });
  const archive = useMutation({
    mutationFn: () => apiRequest("POST", `/api/competitions/${id}/archive`),
    onSuccess: () => { invalidate(); toast({ title: "Archivée" }); },
  });
  const clone = useMutation({
    mutationFn: () => apiRequest("POST", `/api/competitions/${id}/clone`),
    onSuccess: () => { invalidate(); toast({ title: "Nouvelle édition créée" }); },
  });
  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/competitions/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Supprimée" }); navigate("/admin/competitions"); },
    onError: (e: Error) => toast({ title: "Suppression impossible", description: e.message, variant: "destructive" }),
  });

  const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
    { key: "infos", label: "Infos & dates", icon: Info },
    { key: "phases", label: "Phases", icon: LayoutList },
    { key: "equipes", label: "Équipes", icon: Users },
    { key: "matchs", label: "Matchs", icon: CalendarDays },
    ...(isRandom ? [{ key: "aleatoire" as TabKey, label: "Aléatoire", icon: Shuffle }] : []),
    { key: "regles", label: "Règles compo", icon: ShieldCheck },
    { key: "drifters", label: "Drifters", icon: Repeat },
    ...(isArchived ? [{ key: "recompenses" as TabKey, label: "Récompenses", icon: Award }] : []),
  ];

  const status = comp?.status ?? "draft";

  return (
    <div className="w-full px-6 py-8">
      <Link href="/admin/competitions" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ChevronLeft className="h-4 w-4" /> Compétitions (admin)
      </Link>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h1 className="text-2xl font-bold">{comp?.name ?? "Compétition"}</h1>
        <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: STATUS_META[status]?.color ?? "#666" }}>
          {STATUS_META[status]?.label ?? status}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {status === "draft" && (
            <Button size="sm" variant="secondary" disabled={activate.isPending} onClick={() => activate.mutate()}>
              <Play className="h-4 w-4 mr-1" />Activer
            </Button>
          )}
          {status === "active" && (
            <Button size="sm" variant="secondary" disabled={archive.isPending}
              onClick={() => { if (confirm(`Clôturer et archiver « ${comp?.name} » ?`)) archive.mutate(); }}>
              <Archive className="h-4 w-4 mr-1" />Archiver
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={clone.isPending} onClick={() => clone.mutate()} title="Nouvelle édition">
            <Copy className="h-4 w-4 mr-1" />Cloner
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive" title="Supprimer"
            onClick={() => { if (confirm(`Supprimer « ${comp?.name} » ? (impossible si des équipes/matchs y sont rattachés)`)) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 border-b mb-6 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "infos" && comp && <InfosPanel comp={comp} onSaved={invalidate} />}
      {tab === "phases" && <PhasesPanel competitionId={id} phases={phases ?? []} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/competitions", id, "phases"] })} />}
      {tab === "equipes" && <CompetitionTeamsPanel competitionId={id} />}
      {tab === "matchs" && <CompetitionMatchesPanel competitionId={id} />}
      {tab === "aleatoire" && isRandom && <RandomTournamentPanel competitionId={id} />}
      {tab === "regles" && <CompositionRulesPanel competitionId={id} />}
      {tab === "drifters" && <DriftersPanel competitionId={id} />}
      {tab === "recompenses" && isArchived && <AwardsAdminPanel competitionId={id} />}
    </div>
  );
}

// --- Onglet Infos & dates + options ---
function InfosPanel({ comp, onSaved }: { comp: Competition; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(comp.name);
  const [startsAt, setStartsAt] = useState(toDateInput(comp.startsAt as unknown as string));
  const [endsAt, setEndsAt] = useState(toDateInput(comp.endsAt as unknown as string));
  const [competitive, setCompetitive] = useState(!!comp.isCompetitive);
  const [teamSize, setTeamSize] = useState(comp.teamSize ?? 3);
  const [randomTeams, setRandomTeams] = useState(!!comp.randomTeams);
  const [noRookies, setNoRookies] = useState(!!comp.noRookies);
  const [minElo, setMinElo] = useState(comp.minElo != null ? String(comp.minElo) : "");
  const [avgEloCap, setAvgEloCap] = useState(comp.avgEloCap != null ? String(comp.avgEloCap) : "");
  const [scoringMode, setScoringMode] = useState((comp.scoringMode as "simple" | "advanced" | "manual") ?? "simple");
  const [pointsWin, setPointsWin] = useState(String(comp.pointsWin ?? 3));
  const [pointsDraw, setPointsDraw] = useState(String(comp.pointsDraw ?? 1));
  const [pointsLoss, setPointsLoss] = useState(String(comp.pointsLoss ?? 0));
  const [pointsWinClean, setPointsWinClean] = useState(String(comp.pointsWinClean ?? 3));
  const [pointsWinTight, setPointsWinTight] = useState(String(comp.pointsWinTight ?? 2));
  const [pointsLossTight, setPointsLossTight] = useState(String(comp.pointsLossTight ?? 1));
  const [pointsLossClean, setPointsLossClean] = useState(String(comp.pointsLossClean ?? 0));

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/competitions/${comp.id}`, {
      name,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isCompetitive: competitive,
      affectsElo: competitive,
      teamSize,
      randomTeams,
      noRookies,
      minElo: minElo || null,
      avgEloCap: avgEloCap || null,
      scoringMode,
      pointsWin: Number(pointsWin) || 0,
      pointsDraw: Number(pointsDraw) || 0,
      pointsLoss: Number(pointsLoss) || 0,
      pointsWinClean: Number(pointsWinClean) || 0,
      pointsWinTight: Number(pointsWinTight) || 0,
      pointsLossTight: Number(pointsLossTight) || 0,
      pointsLossClean: Number(pointsLossClean) || 0,
    }),
    onSuccess: () => { onSaved(); toast({ title: "Enregistré" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) => (
    <button onClick={() => set(!on)} className="flex items-center justify-between gap-3 border rounded-xl p-3 text-left w-full bg-card hover:border-primary/40">
      <span className="text-sm">{label}{hint && <span className="text-muted-foreground text-xs"> · {hint}</span>}</span>
      <span className={"w-9 h-5 rounded-full relative shrink-0 " + (on ? "bg-primary" : "bg-muted")}>
        <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all " + (on ? "right-0.5" : "left-0.5")} />
      </span>
    </button>
  );

  const TEAM_SIZES = [{ v: 1, l: "Solo" }, { v: 2, l: "Duo" }, { v: 3, l: "Trio" }, { v: 5, l: "Équipe de 5" }];

  return (
    <div className="max-w-3xl">
      <Card className="p-4 mb-6 space-y-3">
        <label className="text-sm block"><span className="text-muted-foreground">Nom</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm"><span className="text-muted-foreground">Début</span>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" /></label>
          <label className="text-sm"><span className="text-muted-foreground">Fin</span>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1" /></label>
        </div>
      </Card>

      <h2 className="font-semibold mb-2">Options</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Toggle on={competitive} set={setCompetitive} label="Compétitif" hint="compte pour l'Elo" />
        <Toggle on={randomTeams} set={setRandomTeams} label="Équipes aléatoires" />
        <Toggle on={noRookies} set={setNoRookies} label="Rookies interdits" />
        <div className="border rounded-xl p-3 bg-card flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Elo min</span>
          <Input type="number" value={minElo} onChange={(e) => setMinElo(e.target.value)} placeholder="—" className="h-8" />
          <span className="text-sm text-muted-foreground">Moy. max</span>
          <Input type="number" value={avgEloCap} onChange={(e) => setAvgEloCap(e.target.value)} placeholder="—" className="h-8" />
        </div>
      </div>
      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-1.5">Format d'équipe</div>
        <div className="flex gap-1.5 flex-wrap">
          {TEAM_SIZES.map((t) => (
            <button key={t.v} onClick={() => setTeamSize(t.v)}
              className={"text-sm px-3 py-1.5 rounded-full " + (teamSize === t.v ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground")}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <h2 className="font-semibold mb-2">Répartition des points</h2>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {([
          { v: "simple", l: "Simple", h: "V / N / D" },
          { v: "advanced", l: "Avancé (au score)", h: "selon l'ampleur (2-0 vs 2-1)" },
          { v: "manual", l: "Manuel", h: "saisi par rencontre" },
        ] as const).map((m) => (
          <button key={m.v} onClick={() => setScoringMode(m.v)}
            className={"text-sm px-3 py-1.5 rounded-full " + (scoringMode === m.v ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground")}
            title={m.h}>
            {m.l}
          </button>
        ))}
      </div>

      {scoringMode === "simple" && (
        <div className="flex flex-wrap gap-3 mb-6">
          <label className="text-sm"><span className="text-muted-foreground">Victoire</span>
            <Input type="number" value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} className="mt-1 w-24 h-9" /></label>
          <label className="text-sm"><span className="text-muted-foreground">Nul</span>
            <Input type="number" value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} className="mt-1 w-24 h-9" /></label>
          <label className="text-sm"><span className="text-muted-foreground">Défaite</span>
            <Input type="number" value={pointsLoss} onChange={(e) => setPointsLoss(e.target.value)} className="mt-1 w-24 h-9" /></label>
        </div>
      )}

      {scoringMode === "advanced" && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-2">
            « Net » = le perdant n'a gagné aucun affrontement (ex. 2-0) ; « serré » = il en a gagné au moins un (ex. 2-1).
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm"><span className="text-muted-foreground">Victoire nette (2-0)</span>
              <Input type="number" value={pointsWinClean} onChange={(e) => setPointsWinClean(e.target.value)} className="mt-1 w-28 h-9" /></label>
            <label className="text-sm"><span className="text-muted-foreground">Victoire serrée (2-1)</span>
              <Input type="number" value={pointsWinTight} onChange={(e) => setPointsWinTight(e.target.value)} className="mt-1 w-28 h-9" /></label>
            <label className="text-sm"><span className="text-muted-foreground">Défaite serrée (1-2)</span>
              <Input type="number" value={pointsLossTight} onChange={(e) => setPointsLossTight(e.target.value)} className="mt-1 w-28 h-9" /></label>
            <label className="text-sm"><span className="text-muted-foreground">Défaite nette (0-2)</span>
              <Input type="number" value={pointsLossClean} onChange={(e) => setPointsLossClean(e.target.value)} className="mt-1 w-28 h-9" /></label>
            <label className="text-sm"><span className="text-muted-foreground">Nul</span>
              <Input type="number" value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} className="mt-1 w-24 h-9" /></label>
          </div>
        </div>
      )}

      {scoringMode === "manual" && (
        <p className="text-sm text-muted-foreground mb-6 max-w-prose">
          Les points de chaque équipe se saisissent directement sur chaque rencontre, dans l'onglet <b>Matchs</b>.
        </p>
      )}

      <Button disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}>
        {save.isPending ? "Enregistrement…" : "Enregistrer les infos"}
      </Button>
    </div>
  );
}

// --- Onglet Phases ---
type PhaseDraft = { name: string; type: FmtKey; config: Record<string, unknown> };

function PhasesPanel({ competitionId, phases, onSaved }: { competitionId: string; phases: CompetitionPhase[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [list, setList] = useState<PhaseDraft[]>([]);
  useEffect(() => {
    setList(phases.map((p) => ({
      name: p.name,
      type: (p.type as FmtKey) ?? "season",
      config: safeParse(p.config),
    })));
  }, [phases]);

  const addPhase = (k: FmtKey) => setList((prev) => [...prev, { name: fmt(k)?.label ?? "Phase", type: k, config: k === "random" ? { mode: "auto" } : {} }]);
  const patchPhase = (i: number, patch: Partial<PhaseDraft>) => setList((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const patchConfig = (i: number, key: string, val: unknown) => setList((prev) => prev.map((p, j) => (j === i ? { ...p, config: { ...p.config, [key]: val } } : p)));
  const move = (i: number, d: -1 | 1) => setList((prev) => { const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return prev; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const remove = (i: number) => setList((prev) => prev.filter((_, j) => j !== i));

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/competitions/${competitionId}`, {
      phases: list.map((p) => ({ name: p.name, type: p.type, config: p.config })),
    }),
    onSuccess: () => { onSaved(); toast({ title: "Phases enregistrées" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-3">Enchaîne les formats. L'ordre définit le déroulé du tournoi.</p>
      <div className="space-y-2 mb-3">
        {list.map((p, i) => {
          const F = fmt(p.type);
          return (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Phase {i + 1}</span>
                {F && <F.icon className="h-4 w-4 text-muted-foreground" />}
                <Input value={p.name} onChange={(e) => patchPhase(i, { name: e.target.value })} className="h-8 flex-1 min-w-[10rem]" />
                <select value={p.type} onChange={(e) => patchPhase(i, { type: e.target.value as FmtKey })} className="h-8 rounded-md border bg-background px-1.5 text-sm">
                  {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(i)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground mb-2">{F?.desc}</div>
              <PhaseConfig type={p.type} config={p.config} onConfig={(k, v) => patchConfig(i, k, v)} />
            </Card>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Aucune phase. Ajoutes-en une ci-dessous.</p>}
      </div>

      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-1.5">Ajouter une phase</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button key={f.key} onClick={() => addPhase(f.key)} className="text-left border rounded-xl p-3 bg-card hover:border-primary/50">
              <div className="font-medium text-sm flex items-center gap-1.5"><f.icon className="h-4 w-4 text-primary" /> {f.label} <Plus className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
              <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Enregistrement…" : "Enregistrer les phases"}
      </Button>
    </div>
  );
}

function PhaseConfig({ type, config: c, onConfig }: { type: FmtKey; config: Record<string, unknown>; onConfig: (k: string, v: unknown) => void }) {
  const cls = "h-8 w-20 rounded-md border bg-background px-2 text-sm";
  if (type === "season") return <label className="text-xs text-muted-foreground flex items-center gap-2"><input type="checkbox" checked={!!c.doubleRound} onChange={(e) => onConfig("doubleRound", e.target.checked)} /> Aller-retour</label>;
  if (type === "swiss") return <label className="text-xs text-muted-foreground flex items-center gap-2">Nombre de tours <input type="number" className={cls} value={(c.rounds as number) ?? ""} onChange={(e) => onConfig("rounds", Number(e.target.value) || 0)} /></label>;
  if (type === "groups") return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
      <label className="flex items-center gap-2">Poules <input type="number" className={cls} value={(c.groups as number) ?? ""} onChange={(e) => onConfig("groups", Number(e.target.value) || 0)} /></label>
      <label className="flex items-center gap-2">Qualifiés / poule <input type="number" className={cls} value={(c.qualifiers as number) ?? ""} onChange={(e) => onConfig("qualifiers", Number(e.target.value) || 0)} /></label>
    </div>
  );
  if (type === "bracket") return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
      <label className="flex items-center gap-2">Best of
        <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={(c.bestOf as number) ?? 3} onChange={(e) => onConfig("bestOf", Number(e.target.value))}>
          <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option><option value={7}>7</option>
        </select>
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.doubleElim} onChange={(e) => onConfig("doubleElim", e.target.checked)} /> Double élimination</label>
    </div>
  );
  if (type === "random") return (
    <label className="text-xs text-muted-foreground flex items-center gap-2">Tirage
      <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={(c.mode as string) ?? "auto"} onChange={(e) => onConfig("mode", e.target.value)}>
        <option value="auto">Automatique</option>
        <option value="manual">Manuel (on compose les équipes)</option>
      </select>
    </label>
  );
  return null;
}

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

export default CompetitionManagePage;
