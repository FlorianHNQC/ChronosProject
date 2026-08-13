import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, X, Star } from "lucide-react";
import type { Competition, Player, Team } from "@shared/schema";

type AwardCard = {
  id: string;
  competitionId: string | null;
  competitionName: string | null;
  title: string;
  subtitle: string | null;
  justification: string | null;
  recipientType: string;
  accent: string | null;
  featured: boolean;
  orderIndex: number;
  teamName: string | null;
  recipients: { pseudo: string }[];
  freeText: string | null;
  playerId: string | null;
  teamId: string | null;
  playerIds: string[];
};

const REC_TYPES = [
  { v: "player", l: "Joueur" },
  { v: "players", l: "Plusieurs joueurs" },
  { v: "team", l: "Équipe" },
  { v: "text", l: "Texte libre" },
];

export function AwardsAdminPage() {
  const { toast } = useToast();
  const { data: comps } = useQuery<Competition[]>({ queryKey: ["/api/competitions"] });
  const { data: players } = useQuery<Player[]>({ queryKey: ["/api/players"] });
  const { data: cards } = useQuery<AwardCard[]>({ queryKey: ["/api/palmares"] });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [justification, setJustification] = useState("");
  const [recipientType, setRecipientType] = useState("player");
  const [playerId, setPlayerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [accent, setAccent] = useState("#EAB308");
  const [featured, setFeatured] = useState(false);
  const [orderIndex, setOrderIndex] = useState("0");

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams", competitionId],
    enabled: !!competitionId,
    queryFn: async () => (await apiRequest("GET", `/api/teams?competitionId=${competitionId}`)).json(),
  });

  const playersSorted = useMemo(() => [...(players ?? [])].sort((a, b) => a.pseudo.localeCompare(b.pseudo)), [players]);
  const pseudoOf = (id: string) => players?.find((p) => p.id === id)?.pseudo ?? id;

  const reset = () => {
    setEditingId(null); setTitle(""); setSubtitle(""); setJustification("");
    setRecipientType("player"); setPlayerId(""); setTeamId(""); setPlayerIds([]); setFreeText("");
    setAccent("#EAB308"); setFeatured(false); setOrderIndex("0");
  };

  const payload = () => ({
    competitionId: competitionId || null,
    title, subtitle, justification, recipientType,
    playerId: recipientType === "player" ? playerId : null,
    teamId: recipientType === "team" ? teamId : null,
    playerIds: recipientType === "players" ? playerIds : null,
    freeText: recipientType === "text" ? freeText : null,
    accent, featured, orderIndex: Number(orderIndex) || 0,
  });

  const save = useMutation({
    mutationFn: () => (editingId ? apiRequest("PATCH", `/api/palmares/${editingId}`, payload()) : apiRequest("POST", "/api/palmares", payload())),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/palmares"] }); reset(); toast({ title: editingId ? "Award mis à jour" : "Award créé" }); },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/palmares/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/palmares"] }); toast({ title: "Supprimé" }); },
  });

  const editCard = (c: AwardCard) => {
    setEditingId(c.id);
    setCompetitionId(c.competitionId ?? "");
    setTitle(c.title); setSubtitle(c.subtitle ?? ""); setJustification(c.justification ?? "");
    setRecipientType(c.recipientType);
    setPlayerId(c.playerId ?? ""); setTeamId(c.teamId ?? ""); setPlayerIds(c.playerIds ?? []); setFreeText(c.freeText ?? "");
    setAccent(c.accent ?? "#EAB308"); setFeatured(c.featured); setOrderIndex(String(c.orderIndex));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addPlayerToList = (id: string) => { if (id && !playerIds.includes(id)) setPlayerIds((prev) => [...prev, id]); };

  return (
    <div className="w-full px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Récompenses — administration</h1>

      <Card className="p-5 mb-8 space-y-3">
        <div className="font-semibold">{editingId ? "Modifier un award" : "Nouvel award"}</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-muted-foreground">Compétition</span>
            <select value={competitionId} onChange={(e) => { setCompetitionId(e.target.value); setTeamId(""); }} className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Type de récipiendaire</span>
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm">
              {REC_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
        </div>

        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. MVP, Meilleur buteur)" />
        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Sous-titre (optionnel)" />
        <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} placeholder="Justification (optionnel)" />

        {recipientType === "player" && (
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">— choisir un joueur —</option>
            {playersSorted.map((p) => <option key={p.id} value={p.id}>{p.pseudo}</option>)}
          </select>
        )}
        {recipientType === "team" && (
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm" disabled={!competitionId}>
            <option value="">{competitionId ? "— choisir une équipe —" : "Choisis d'abord une compétition"}</option>
            {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {recipientType === "players" && (
          <div className="space-y-2">
            <select value="" onChange={(e) => addPlayerToList(e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">— ajouter un joueur —</option>
              {playersSorted.map((p) => <option key={p.id} value={p.id}>{p.pseudo}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {playerIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                  {pseudoOf(id)}
                  <button onClick={() => setPlayerIds((prev) => prev.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {recipientType === "text" && (
          <Input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Texte libre (ex. Marel & Ludger Rexxial)" />
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Accent</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 rounded border bg-background" />
          </label>
          <label className="text-sm flex items-center gap-1.5">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <Star className="h-4 w-4" /> Mis en avant
          </label>
          <label className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Ordre</span>
            <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-20 h-8" />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={save.isPending || !title.trim()} onClick={() => save.mutate()}>
            {editingId ? "Enregistrer" : "Créer"}
          </Button>
          {editingId && <Button size="sm" variant="ghost" onClick={reset}>Annuler</Button>}
        </div>
      </Card>

      <div className="space-y-2">
        {(cards ?? []).map((c) => (
          <Card key={c.id} className="flex items-center gap-3 p-3">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.accent ?? "#666" }} />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                {c.featured && <Star className="h-3.5 w-3.5 inline mr-1 text-primary" />}
                {c.title}
                <span className="text-muted-foreground font-normal"> · {c.recipientType === "text" ? c.freeText : c.teamName ?? c.recipients.map((r) => r.pseudo).join(", ")}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.competitionName ?? "—"}</div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => editCard(c)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => { if (confirm(`Supprimer « ${c.title} » ?`)) del.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default AwardsAdminPage;
