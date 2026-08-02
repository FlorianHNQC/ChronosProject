import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Icône Lucide optionnelle affichée avant le titre. */
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  /** Zone d'actions à droite (filtres, boutons…). */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * En-tête de page unifié : titre (+ icône) et zone d'actions à droite.
 * Remplace les `<h1>` ad hoc réinventés sur chaque page pour une mise en page cohérente.
 */
export function PageHeader({ title, icon: Icon, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex animate-fade-in-up flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold italic tracking-tight sm:text-3xl">
          {Icon ? <Icon className="h-6 w-6 shrink-0 not-italic text-primary" /> : null}
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default PageHeader;
