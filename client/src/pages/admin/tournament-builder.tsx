import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, ArrowLeftRight, LayoutGrid, GitBranch, Shuffle, Plus, X, ArrowUp, ArrowDown } from "lucide-react";

type FmtKey = "season" | "swiss" | "groups" | "bracket" | "random";
const FORMATS: { key: FmtKey; label: string; icon: typeof CalendarDays; desc: string }[] = [
  { key: "season", label: "Saison / round robin", icon: CalendarDays, desc: "Tout le monde s'affronte, classement aux points." },
  { key: "swiss", label: "Suisse", icon: ArrowLeftRight, desc: "Adversaire de niveau proche chaque tour ; pas d'élimination, nombre de tours fixe." },
  { key: "groups", label: "Poules", icon: LayoutGrid, desc: "Groupes en round robin ; les meilleurs se qualifient." },
  { key: "bracket", label: "Bracket", icon: GitBranch, desc: "Élimination directe (simple ou double)." },
  { key: "random", label: "Aléatoire", icon: Shuffle, desc: "Trios tirés au sort, changent chaque tour, classement individuel." },
];
const fmt = (k: string) => FORMATS.find((f) => f.key === k);

type Phase = { name: string; type: FmtKey; config: Record<string, unknown> };
const TEAM_SIZES = [{ v: 1, l: "Solo" }, { v: 2, l: "Duo" }, { v: 3, l: "Trio" }, { v: 5, l: "Équipe de 5" }];

export function TournamentBuilderPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [competitive, setCompetitive] = useState(false);
  const [teamSize, setTeamSize] = useState(3);
  const [randomTeams, setRandomTeams] = useState(false);
  const [minElo, setMinElo] = useState("");
  const [avgEloCap, setAvgEloCap] = useState("");
  const [noRookies, setNoRookies] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);

  const addPhase = (k: FmtKey) => {
    const defName = fmt(k)?.label ?? "Phase";
    setPhases((prev) => [...prev, { name: defName, type: k, config: k === "random" ? { mode: "auto" } : {} }]);
  };
  const patchPhase = (i: number, patch: Partial<Phase>) => setPhases((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const patchConfig = (i: number, key: string, val: unknown) => setPhases((prev) => prev.map((p, j) => (j === i ? { ...p, config: { ...p.config, [key]: val } } : p)));
  const move = (i: number, d: -1 | 1) => setPhases((prev) => {
    const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return prev;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const remove = (i: number) => setPhases((prev) => prev.filter((_, j) => j !== i));

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/competitions", {
      name,
      type: "tournament",
      isCompetitive: competitive,
      affectsElo: competitive,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      teamSize,
      randomTeams,
      minElo: minElo || null,
      avgEloCap: avgEloCap || null,
      noRookies,
      phases: phases.map((p) => ({ name: p.name, type: p.type, config: p.config })),
    }),
    onSuccess: async (res) => {
      const c = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Tournoi créé", description: name });
      navigate(`/competitions/${c.id}`);
    },
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

  return (
    <div className="w-full px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Créer un tournoi</h1>

      {/* Infos */}
      <Card className="p-4 mb-6 space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du tournoi (ex. Chaos Stars Cup)" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm"><span className="text-muted-foreground">Début</span>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" /></label>
          <label className="text-sm"><span className="text-muted-foreground">Fin</span>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1" /></label>
        </div>
      </Card>

      {/* Options */}
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

      {/* Phases */}
      <h2 className="font-semibold mb-1">Phases</h2>
      <p className="text-sm text-muted-foreground mb-3">Enchaîne les formats. L'ordre définit le déroulé du tournoi.</p>
      <div className="space-y-2 mb-3">
        {phases.map((p, i) => {
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
              <PhaseConfig phase={p} onConfig={(k, v) => patchConfig(i, k, v)} />
            </Card>
          );
        })}
        {phases.length === 0 && <p className="text-sm text-muted-foreground">Ajoute au moins une phase.</p>}
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

      <Button disabled={!name.trim() || phases.length === 0 || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Création…" : "Créer le tournoi"}
      </Button>
    </div>
  );
}

function PhaseConfig({ phase, onConfig }: { phase: Phase; onConfig: (k: string, v: unknown) => void }) {
  const c = phase.config;
  const cls = "h-8 w-20 rounded-md border bg-background px-2 text-sm";
  if (phase.type === "season") {
    return <label className="text-xs text-muted-foreground flex items-center gap-2"><input type="checkbox" checked={!!c.doubleRound} onChange={(e) => onConfig("doubleRound", e.target.checked)} /> Aller-retour</label>;
  }
  if (phase.type === "swiss") {
    return <label className="text-xs text-muted-foreground flex items-center gap-2">Nombre de tours <input type="number" className={cls} value={(c.rounds as number) ?? ""} onChange={(e) => onConfig("rounds", Number(e.target.value) || 0)} /></label>;
  }
  if (phase.type === "groups") {
    return (
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <label className="flex items-center gap-2">Poules <input type="number" className={cls} value={(c.groups as number) ?? ""} onChange={(e) => onConfig("groups", Number(e.target.value) || 0)} /></label>
        <label className="flex items-center gap-2">Qualifiés / poule <input type="number" className={cls} value={(c.qualifiers as number) ?? ""} onChange={(e) => onConfig("qualifiers", Number(e.target.value) || 0)} /></label>
      </div>
    );
  }
  if (phase.type === "bracket") {
    return (
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <label className="flex items-center gap-2">Best of
          <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={(c.bestOf as number) ?? 3} onChange={(e) => onConfig("bestOf", Number(e.target.value))}>
            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option><option value={7}>7</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.doubleElim} onChange={(e) => onConfig("doubleElim", e.target.checked)} /> Double élimination</label>
      </div>
    );
  }
  if (phase.type === "random") {
    return (
      <label className="text-xs text-muted-foreground flex items-center gap-2">Tirage
        <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={(c.mode as string) ?? "auto"} onChange={(e) => onConfig("mode", e.target.value)}>
          <option value="auto">Automatique</option>
          <option value="manual">Manuel (on compose les équipes)</option>
        </select>
      </label>
    );
  }
  return null;
}

export default TournamentBuilderPage;
