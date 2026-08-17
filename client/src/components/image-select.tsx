import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type ImageOption = {
  value: string;              // valeur stockée (nom)
  label: string;              // libellé affiché
  imageUrl?: string | null;   // vignette principale
  sub?: string | null;        // sous-libellé (ex. mode d'une map)
  subImageUrl?: string | null;// icône du sous-libellé
  color?: string | null;
};

/**
 * Liste déroulante avec vignettes : recherche + choix visuel. Autorise aussi une
 * saisie libre (valeur personnalisée) pour ne pas bloquer si l'entrée n'existe pas.
 */
export function ImageSelect({
  value, onChange, options, placeholder = "Choisir…", className = "", disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ImageOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options.slice(0, 200);
    return options.filter((o) => o.label.toLowerCase().includes(t) || (o.sub ?? "").toLowerCase().includes(t)).slice(0, 200);
  }, [options, q]);

  const commitFree = () => { const v = q.trim(); if (v) { onChange(v); setOpen(false); setQ(""); } };

  return (
    <div ref={ref} className={"relative " + className}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50">
        {selected?.imageUrl ? (
          <img src={selected.imageUrl} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
        ) : null}
        <span className={"flex-1 text-left truncate " + (value ? "" : "text-muted-foreground")}>{value || placeholder}</span>
        {value && (
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 max-w-[90vw] rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitFree(); }}
                placeholder="Rechercher…" className="h-8 w-full rounded border bg-background pl-8 pr-2 text-sm" />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                className={"flex items-center gap-2 w-full px-2 py-1.5 text-left text-sm hover:bg-muted " + (o.value === value ? "bg-muted" : "")}>
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.sub && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {o.subImageUrl && <img src={o.subImageUrl} alt="" className="h-3 w-3" />}
                      {o.sub}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <button type="button" onClick={commitFree} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
                {q.trim() ? `Utiliser « ${q.trim()} »` : "Aucun résultat."}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageSelect;
