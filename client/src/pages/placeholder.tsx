import { Construction } from "lucide-react";

/**
 * Page générique de fondation. Chaque route de la nav pointe ici pour l'instant ;
 * les vraies pages (portées de leaguebs/statsbs + nouveautés Chronos) les
 * remplaceront au fil des incréments.
 */
export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-6">
      <Construction className="h-10 w-10 text-primary/70" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {note ?? "Section en cours de construction — fondation du monorepo Chronos."}
      </p>
    </div>
  );
}

export default Placeholder;
