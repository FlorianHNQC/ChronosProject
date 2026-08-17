import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ImageOption } from "@/components/image-select";

export type BsMode = { id: number | null; name: string; imageUrl: string | null; color: string | null };
export type BsMap = { id: number | null; name: string; imageUrl: string | null; mode: string | null; modeImageUrl: string | null; modeColor: string | null };

/**
 * Catalogue Brawl Stars (maps & modes via Brawlify) : options pour les listes
 * déroulantes visuelles + résolution nom → image pour l'affichage.
 */
export function useBsCatalog() {
  const { data: modes } = useQuery<BsMode[]>({
    queryKey: ["/api/bs/gamemodes"],
    queryFn: async () => (await apiRequest("GET", "/api/bs/gamemodes")).json(),
    staleTime: 60 * 60 * 1000,
  });
  const { data: maps } = useQuery<BsMap[]>({
    queryKey: ["/api/bs/maps"],
    queryFn: async () => (await apiRequest("GET", "/api/bs/maps")).json(),
    staleTime: 60 * 60 * 1000,
  });

  return useMemo(() => {
    const modeByName = new Map((modes ?? []).map((m) => [m.name.toLowerCase(), m]));
    const mapByName = new Map((maps ?? []).map((m) => [m.name.toLowerCase(), m]));
    const modeOptions: ImageOption[] = (modes ?? []).map((m) => ({ value: m.name, label: m.name, imageUrl: m.imageUrl, color: m.color }));
    const mapOptions: ImageOption[] = (maps ?? []).map((m) => ({ value: m.name, label: m.name, imageUrl: m.imageUrl, sub: m.mode, subImageUrl: m.modeImageUrl }));
    return { modes: modes ?? [], maps: maps ?? [], modeByName, mapByName, modeOptions, mapOptions };
  }, [modes, maps]);
}

/** Puce d'un mode de jeu (icône + nom). */
export function ModeBadge({ name, size = 16 }: { name?: string | null; size?: number }) {
  const { modeByName } = useBsCatalog();
  if (!name) return null;
  const m = modeByName.get(name.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted">
      {m?.imageUrl && <img src={m.imageUrl} alt="" width={size} height={size} className="rounded-sm object-contain" />}
      {name}
    </span>
  );
}

/** Puce d'une map (vignette + nom). */
export function MapBadge({ name, thumb = 20 }: { name?: string | null; thumb?: number }) {
  const { mapByName } = useBsCatalog();
  if (!name) return null;
  const m = mapByName.get(name.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted">
      {m?.imageUrl && <img src={m.imageUrl} alt="" style={{ height: thumb }} className="rounded-sm object-cover" />}
      {name}
    </span>
  );
}

/** Affichage compact mode + map d'un match. Ne rend rien si les deux sont vides. */
export function MetaBadges({ gameMode, map, className = "" }: { gameMode?: string | null; map?: string | null; className?: string }) {
  if (!gameMode && !map) return null;
  return (
    <span className={"inline-flex items-center gap-1.5 flex-wrap " + className}>
      <ModeBadge name={gameMode} />
      <MapBadge name={map} />
    </span>
  );
}
