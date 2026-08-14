import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";
import type { HydraSection } from "@shared/schema";

/**
 * Rendu inline : **gras**, *italique* et liens [libellé](url) dans une ligne.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) {
        nodes.push(
          <a
            key={`${keyBase}-a${i}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      }
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(<span key={`${keyBase}-e`}>{text.slice(last)}</span>);
  return nodes;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l);
const splitRow = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/**
 * Rendu texte enrichi léger : titres (`##`, `###`), paragraphes (ligne vide),
 * listes `- `, tableaux markdown (`| a | b |` + `| --- | --- |`), et inline
 * **gras** / *italique* / [liens](url).
 */
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, "");

    // Tableau : ligne d'en-tête « | … | » suivie d'une ligne séparatrice « | --- | --- | ».
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushList();
      flushPara();
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      const b = blocks.length;
      blocks.push(
        <div key={`t-${b}`} className="overflow-x-auto mb-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                {header.map((h, k) => (
                  <th key={k} className="text-left font-semibold py-1.5 pr-4">{inline(h, `th-${b}-${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                  {r.map((c, ci) => (
                    <td key={ci} className="py-1.5 pr-4 align-top">{inline(c, `td-${b}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j - 1;
      continue;
    }

    if (line.trim() === "") {
      flushList();
      flushPara();
    } else if (/^#{1,3}\s+/.test(line)) {
      flushList();
      flushPara();
      const level = (line.match(/^#+/) as RegExpMatchArray)[0].length;
      const content = line.replace(/^#+\s+/, "");
      blocks.push(
        <div
          key={`h-${blocks.length}`}
          className={
            level <= 2
              ? "font-bold text-base mt-3 mb-1"
              : "font-semibold text-sm mt-2 mb-1 text-muted-foreground"
          }
        >
          {inline(content, `h-${blocks.length}`)}
        </div>,
      );
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
          placeholder="Contenu…"
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Formats : <code>**gras**</code>, <code>*italique*</code>, titres <code>## Titre</code>,
          listes <code>- élément</code>, liens <code>[libellé](https://…)</code>, tableaux
          <code>| a | b |</code> puis <code>| --- | --- |</code>, ligne vide = nouveau paragraphe.
        </p>
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
