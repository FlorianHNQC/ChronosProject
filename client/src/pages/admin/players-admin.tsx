import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, Plus, UserRound, Search, Users, Shuffle } from "lucide-react";
import { FusionAdminPage } from "@/pages/admin/fusion-admin";
import type { Player } from "@shared/schema";

/**
 * Console admin — joueurs : ajout par tag, liste (recherche + resync/suppression),
 * et fusion des doublons (onglet).
 */
export function PlayersAdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"joueurs" | "fusion">("joueurs");
  const [tag, setTag] = useState("");
  const [nationality, setNationality] = useState("");
  const [q, setQ] = useState("");

  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/players"] });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = [...(players ?? [])].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    if (!t) return list;
    return list.filter((p) =>
      p.pseudo.toLowerCase().includes(t) ||
      (p.playerTag ?? "").toLowerCase().includes(t) ||
      (p.nationality ?? "").toLowerCase().includes(t),
    );
  }, [players, q]);

  const addPlayer = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/players", { tag, nationality: nationality || undefined })).json(),
    onSuccess: (p: Player) => {
      toast({ title: "Joueur ajouté", description: `${p.pseudo} (${p.playerTag})` });
      setTag(""); setNationality(""); invalidate();
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const resync = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/players/${id}/resync`),
    onSuccess: () => { toast({ title: "Resynchronisé" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/players/${id}`),
    onSuccess: () => { toast({ title: "Supprimé" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  const tabBtn = (key: typeof tab, label: string, Icon: typeof Users) => (
    <button
      onClick={() => setTab(key)}
      className={"flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px " + (tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="w-full">
      <div className="px-6 pt-8">
        <h1 className="text-2xl font-bold mb-4">Joueurs — administration</h1>
        <div className="flex items-center gap-1 border-b">
          {tabBtn("joueurs", "Joueurs", Users)}
          {tabBtn("fusion", "Fusion des doublons", Shuffle)}
        </div>
      </div>

      {tab === "fusion" ? (
        <FusionAdminPage />
      ) : (
        <div className="px-6 pt-5 pb-8">
          <Card className="p-4 mb-6">
            <h2 className="font-semibold mb-3">Ajouter par tag Brawl Stars</h2>
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) addPlayer.mutate(); }}>
              <div className="relative sm:flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none pointer-events-none font-medium">#</span>
                <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="2PP0LG" className="pl-7 uppercase" autoCapitalize="characters" spellCheck={false} />
              </div>
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Nat. (BJ)" maxLength={2} className="sm:w-28 uppercase" />
              <Button type="submit" disabled={addPlayer.isPending || !tag.trim()}>
                <Plus className="h-4 w-4 mr-1" />{addPlayer.isPending ? "Ajout…" : "Ajouter"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">Le tag est l'identifiant in-game. Inutile de taper le « # ». Nécessite un token API valide et une IP autorisée.</p>
          </Card>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="font-semibold">Joueurs enregistrés ({filtered.length})</h2>
            <div className="relative ml-auto w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (pseudo, tag, nationalité)…" className="pl-9 h-9" />
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-2.5">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.pseudo} className="h-9 w-9 rounded object-cover bg-muted" />
                ) : (
                  <div className="h-9 w-9 rounded bg-muted flex items-center justify-center"><UserRound className="h-5 w-5 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.pseudo}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.playerTag ?? "—"}{p.nationality ? ` · ${p.nationality}` : ""}</div>
                </div>
                <Button size="icon" variant="ghost" title="Resynchroniser" disabled={resync.isPending} onClick={() => resync.mutate(p.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Supprimer" disabled={remove.isPending} onClick={() => { if (confirm(`Supprimer « ${p.pseudo} » ?`)) remove.mutate(p.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">{q ? "Aucun joueur ne correspond." : "Aucun joueur enregistré."}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayersAdminPage;
