import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Change = { pseudo: string | null; oldElo: number | null; newElo: number | null; comment: string | null };
type Batch = { id: string; createdAt: string | null; note: string | null; author: string | null; changes: Change[] };

const dayKey = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");
const fmtDay = (key: string) =>
  key === "—"
    ? "Date inconnue"
    : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
        new Date(`${key}T00:00:00`),
      );
const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

/**
 * Changelog navigable : les changements sont groupés par jour (colonne de dates)
 * et, dans chaque jour, par lot (auteur + heure + liste des modifications).
 */
export function HydraChangelog() {
  const { data: batches } = useQuery<Batch[]>({ queryKey: ["/api/hydra/changelog/batches"] });
  const [sel, setSel] = useState<string | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, Batch[]>();
    for (const b of batches ?? []) {
      const k = dayKey(b.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    return Array.from(m.entries()); // ordre décroissant (batches déjà triés desc)
  }, [batches]);

  if (!batches) return <span className="text-muted-foreground text-sm">Chargement…</span>;
  if (days.length === 0)
    return <span className="text-muted-foreground text-sm">Aucune évolution enregistrée pour l'instant.</span>;

  const activeDay = sel ?? days[0][0];
  const activeBatches = days.find(([k]) => k === activeDay)?.[1] ?? [];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="sm:w-52 shrink-0 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1">
        {days.map(([k, list]) => {
          const count = list.reduce((n, b) => n + b.changes.length, 0);
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              className={
                "text-left text-xs px-2.5 py-1.5 rounded-md shrink-0 whitespace-nowrap sm:whitespace-normal " +
                (k === activeDay ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")
              }
            >
              <span className="font-medium capitalize">{fmtDay(k)}</span>
              <span className="opacity-70"> · {count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {activeBatches.map((b) => (
          <div key={b.id} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-2">
              <span className="font-semibold text-foreground">{b.author ?? "Système"}</span>
              <span>· {fmtTime(b.createdAt)}</span>
              {b.note && <span>· {b.note}</span>}
              <span className="ml-auto">
                {b.changes.length} changement{b.changes.length > 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1">
              {b.changes.map((c, i) => (
                <li key={i} className="text-sm flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.pseudo ?? "?"}</span>
                  <span className="text-muted-foreground">
                    {c.oldElo ?? "—"} → {c.newElo ?? "—"}
                  </span>
                  {c.comment && <span className="text-muted-foreground">· {c.comment}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
