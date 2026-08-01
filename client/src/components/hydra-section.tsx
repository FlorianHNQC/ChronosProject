import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";
import type { HydraSection } from "@shared/schema";

/** Rendu inline minimal : **gras** dans une ligne. */
function inline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{p}</span>
    ),
  );
}

/** Rendu texte enrichi léger : paragraphes (ligne vide), listes "- ", et **gras**. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushList = () => {
    if (list.length) {
      const items = [...list];
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1 mb-2">
          {items.map((l, i) => (
            <li key={i}>{inline(l, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      const rows = [...para];
      blocks.push(
        <p key={`p-${blocks.length}`} className="mb-2">
          {rows.map((l, i) => (
            <span key={i}>
              {inline(l, `pl-${blocks.length}-${i}`)}
              {i < rows.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>,
      );
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      flushList();
      flushPara();
    } else if (/^-\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^-\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

/**
 * Bloc de section Hydra : affiche le contenu, et — pour un admin connecté —
 * propose une édition inline (titre + corps) enregistrée en base.
 */
export function HydraSectionBlock({ section, isAdmin }: { section: HydraSection; isAdmin: boolean }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);

  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/hydra/sections/${section.key}`, { title, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hydra/sections"] });
      setEditing(false);
      toast({ title: "Section mise à jour" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="space-y-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Contenu — sauts de ligne, listes « - », et **gras** pris en charge."
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={save.isPending || !title.trim()} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTitle(section.title);
              setBody(section.body);
              setEditing(false);
            }}
          >
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <RichText text={section.body} />
      {isAdmin && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
        </Button>
      )}
    </div>
  );
}
