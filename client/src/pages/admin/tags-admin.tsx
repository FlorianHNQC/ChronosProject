import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import type { Player, Tag } from "@shared/schema";

type PlayerTagRow = {
  playerId: string;
  tagId: string;
  code: string;
  label: string;
  family: "palmares" | "comportement";
  color: string | null;
};

/**
 * Console admin — tags : catalogue (création/suppression) et attribution aux
 * joueurs. Les tags apportent du contexte sans hiérarchie de niveau.
 */
export function TagsAdminPage() {
  const { toast } = useToast();
  const { data: tags } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: assignments } = useQuery<PlayerTagRow[]>({ queryKey: ["/api/player-tags"] });

  const byPlayer = useMemo(() => {
    const map = new Map<string, PlayerTagRow[]>();
    for (const a of assignments ?? []) {
      if (!map.has(a.playerId)) map.set(a.playerId, []);
      map.get(a.playerId)!.push(a);
    }
    return map;
  }, [assignments]);

  // --- Catalogue ---
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [family, setFamily] = useState<"palmares" | "comportement">("comportement");
  const [color, setColor] = useState("#3BA7E2");

  const createTag = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tags", { code, label, family, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setCode(""); setLabel("");
      toast({ title: "Tag créé" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const deleteTag = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] });
    },
  });

  const assign = useMutation({
    mutationFn: ({ playerId, tagId }: { playerId: string; tagId: string }) =>
      apiRequest("POST", `/api/players/${playerId}/tags`, { tagId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] }),
  });
  const unassign = useMutation({
    mutationFn: ({ playerId, tagId }: { playerId: string; tagId: string }) =>
      apiRequest("DELETE", `/api/players/${playerId}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/player-tags"] }),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Tags</h1>

      {/* Catalogue */}
      <Card className="p-4 mb-8">
        <h2 className="font-semibold mb-3">Catalogue</h2>
        <form
          className="flex flex-wrap items-center gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim() && label.trim()) createTag.mutate();
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="code (ex. champion)" className="w-40" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex. Champion)" className="w-44" />
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as "palmares" | "comportement")}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="palmares">Palmarès</option>
            <option value="comportement">Comportement</option>
          </select>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 rounded border bg-transparent cursor-pointer" />
          <Button type="submit" size="sm" disabled={createTag.isPending || !code.trim() || !label.trim()}>
            <Plus className="h-4 w-4 mr-1" />Créer
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {(tags ?? []).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded text-white"
              style={{ backgroundColor: t.color ?? "#666" }}
            >
              {t.label}
              <button onClick={() => deleteTag.mutate(t.id)} title="Supprimer" className="opacity-80 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {(!tags || tags.length === 0) && <span className="text-sm text-muted-foreground">Aucun tag.</span>}
        </div>
      </Card>

      {/* Attribution */}
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
                  <span
                    key={c.tagId}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: c.color ?? "#666" }}
                  >
                    {c.label}
                    <button onClick={() => unassign.mutate({ playerId: p.id, tagId: c.tagId })} className="opacity-80 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {current.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) assign.mutate({ playerId: p.id, tagId: e.target.value });
                }}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                disabled={available.length === 0}
              >
                <option value="">+ Ajouter un tag</option>
                {available.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Card>
          );
        })}
        {(!players || players.length === 0) && <p className="text-sm text-muted-foreground">Aucun joueur.</p>}
      </div>
    </div>
  );
}

export default TagsAdminPage;
