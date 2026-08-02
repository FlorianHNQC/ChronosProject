import { Trophy } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Competition } from "@shared/schema";

type CompetitionSelectProps = {
  competitions: Competition[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  placeholder?: string;
};

/**
 * Sélecteur de compétition stylé (Select shadcn), en remplacement des
 * `<select>` natifs non stylés disséminés dans les pages (calendrier, stats, playoffs…).
 */
export function CompetitionSelect({
  competitions, value, onValueChange, className, placeholder = "Compétition",
}: CompetitionSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-9 w-[220px] max-w-full gap-2", className)}>
        <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {competitions.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CompetitionSelect;
