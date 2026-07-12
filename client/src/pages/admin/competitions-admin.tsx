import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Archive, Copy, Play } from "lucide-react";
import type { Competition } from "@shared/schema";

const TYPES = [
  { value: "league", label: "Ligue" },
  { value: "tournament", label: "Tournoi" },
  { value: "swiss", label: "Suisse" },
  { value: "round_robin", label: "Round robin" },
  { value: "groups", label: "Poules" },
  { value: "scrim", label: "Scrim" },
  { value: "event", label: "Événement" },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "#8B93A7" },
  active: { label: "Active", color: "#2E7D32" },
  archived: { label: "Archivée", color: "#B45309" },
};

/**
 * Console admin — cycle de vie des compétitions : créer, activer, archiver
 * (clôture officielle → historique) et cloner le format (nouvelle édition).
 */
export function CompetitionsAdminPage() {
  const { toast } = useToast();
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });

  const [name, setName] = useState("");
  const [type, setType] = useState("league");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/competitions", { name, type }),
    onSuccess: () => { setName(""); invalidate(); toast({ title: "Compétition créée" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const activate = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/competitions/${id}`, { status: "active" }),
    onSuccess: () => { invalidate(); toast({ title: "Activée" }); },
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/competitions/${id}/archive`),
    onSuccess: () => { invalidate(); toast({ title: "Archivée", description: "Données historiques figées." }); },
  });
  const clone = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/competitions/${id}/clone`),
    onSuccess: () => { invalidate(); toast({ title: "Nouvelle édition créée", description: "Brouillon au même format." }); },
  });

  const byStatus = (s: string) => (comps ?? []).filter((c) => c.status === s);

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Compétitions</h1>

      <Card className="p-4 mb-8">
        <h2 className="font-semibold mb-3">Nouvelle compétition</h2>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Ligue Chronos 2026)" className="flex-1 min-w-[12rem]" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
            <Plus className="h-4 w-4 mr-1" />Créer
          </Button>
        </form>
      </Card>

      {(["active", "draft", "archived"] as const).map((s) => {
        const list = byStatus(s);
        if (list.length === 0) return null;
        return (
          <div key={s} className="mb-6">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: STATUS_META[s].color }}>
                {STATUS_META[s].label}
              </span>
              <span className="text-muted-foreground text-sm">({list.length})</span>
            </h2>
            <div className="space-y-2">
              {list.map((c) => (
                <Card key={c.id} className="flex items-center gap-3 p-2.5 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {TYPES.find((t) => t.value === c.type)?.label ?? c.type}
                      {c.closedAt ? ` · clôturée le ${new Date(c.closedAt).toLocaleDateString("fr-FR")}` : ""}
                    </div>
                  </div>
                  {c.status === "draft" && (
                    <Button size="sm" variant="secondary" disabled={activate.isPending} onClick={() => activate.mutate(c.id)}>
                      <Play className="h-4 w-4 mr-1" />Activer
                    </Button>
                  )}
                  {c.status === "active" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={archive.isPending}
                      onClick={() => { if (confirm(`Clôturer et archiver « ${c.name} » ? Les données deviendront historiques.`)) archive.mutate(c.id); }}
                    >
                      <Archive className="h-4 w-4 mr-1" />Archiver
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={clone.isPending} onClick={() => clone.mutate(c.id)} title="Nouvelle édition (même format)">
                    <Copy className="h-4 w-4 mr-1" />Cloner
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {(comps ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune compétition. Créez-en une ci-dessus.</p>
      )}
    </div>
  );
}

export default CompetitionsAdminPage;
