import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { X, CheckCircle2, XCircle } from "lucide-react";
import type { Competition, Player, Tier } from "@shared/schema";

type Ruleset = { budget?: number; tierPoints?: Record<string, number>; maxPerTier?: Record<string, number> };
type ValidationResult = { valid: boolean; budget: number | null; points: number; reasons: string[]; perTier: Record<string, number> };

/**
 * Règles de composition d'une compétition (budget + points par tier) et
 * validateur d'équipe. Scopé à une compétition (page de gestion).
 */
export function CompositionRulesPanel({ competitionId }: { competitionId: string }) {
  const { toast } = useToast();
  const { data: comp } = useQuery<Competition>({
    queryKey: ["/api/competitions", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/competitions/${competitionId}`)).json(),
  });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/tiers"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });

  const [budget, setBudget] = useState("");
  const [points, setPoints] = useState<Record<string, string>>({});

  useEffect(() => {
    let rs: Ruleset = {};
    try { rs = comp?.rulesetJson ? JSON.parse(comp.rulesetJson) : {}; } catch { rs = {}; }
    setBudget(rs.budget != null ? String(rs.budget) : "");
    const p: Record<string, string> = {};
    for (const t of tiers ?? []) p[t.code] = String(rs.tierPoints?.[t.code] ?? "");
    setPoints(p);
  }, [comp, tiers]);

  const save = useMutation({
    mutationFn: () => {
      const tierPoints: Record<string, number> = {};
      for (const [code, v] of Object.entries(points)) if (v !== "") tierPoints[code] = Number(v);
      const ruleset: Ruleset = { budget: budget !== "" ? Number(budget) : undefined, tierPoints };
      return apiRequest("PATCH", `/api/competitions/${competitionId}`, { rulesetJson: JSON.stringify(ruleset) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions", competitionId] });
      toast({ title: "Règles enregistrées" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <Card className="p-4 mb-8 max-w-xl">
        <h2 className="font-semibold mb-3">Règles de composition</h2>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm w-40">Budget de points max.</label>
          <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-28 h-9" placeholder="—" />
        </div>
        <div className="text-sm text-muted-foreground mb-2">Points par tier :</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {(tiers ?? []).sort((a, b) => a.orderIndex - b.orderIndex).map((t) => (
            <div key={t.code} className="flex items-center gap-2">
              <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white w-12 text-center" style={{ backgroundColor: t.color ?? "#666" }}>{t.code}</span>
              <Input type="number" value={points[t.code] ?? ""} onChange={(e) => setPoints((p) => ({ ...p, [t.code]: e.target.value }))} className="w-20 h-8" placeholder="0" />
            </div>
          ))}
        </div>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer les règles</Button>
      </Card>

      <Validator competitionId={competitionId} players={players ?? []} />
    </div>
  );
}

function Validator({ competitionId, players }: { competitionId: string; players: Player[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const available = players.filter((p) => !selected.includes(p.id));

  const check = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/competitions/${competitionId}/validate`, { playerIds: selected })).json(),
    onSuccess: (r: ValidationResult) => setResult(r),
  });

  return (
    <Card className="p-4 max-w-xl">
      <h2 className="font-semibold mb-3">Validateur d'équipe</h2>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
            {byId.get(id)?.pseudo ?? "?"}
            <button onClick={() => { setSelected((s) => s.filter((x) => x !== id)); setResult(null); }}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <select value="" onChange={(e) => { if (e.target.value) { setSelected((s) => [...s, e.target.value]); setResult(null); } }} className="h-9 rounded-md border bg-background px-2 text-sm mb-3" disabled={available.length === 0}>
        <option value="">+ Ajouter un joueur</option>
        {available.map((p) => <option key={p.id} value={p.id}>{p.pseudo}</option>)}
      </select>
      <div>
        <Button size="sm" disabled={check.isPending || selected.length === 0} onClick={() => check.mutate()}>Valider</Button>
      </div>
      {result && (
        <div className="mt-3 text-sm">
          <div className={"flex items-center gap-1.5 font-semibold " + (result.valid ? "text-green-500" : "text-red-500")}>
            {result.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.valid ? "Composition autorisée" : "Composition refusée"}
          </div>
          <div className="text-muted-foreground mt-1">
            Points : {result.points}{result.budget != null ? ` / ${result.budget}` : ""}
          </div>
          {result.reasons.map((r, i) => <div key={i} className="text-red-500 text-xs">{r}</div>)}
        </div>
      )}
    </Card>
  );
}

export default CompositionRulesPanel;
