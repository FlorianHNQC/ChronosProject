import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogIn, Menu, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

type Me = { id: string; email: string; role: string } | null;

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// MVP : la navigation publique tourne autour de la compétition. Calendrier /
// Playoffs / Équipes / Stats / Récompenses ne sont plus globaux — on y accède en
// ENTRANT dans une compétition (hub /competitions/:id). Restent au global :
// Accueil, Compétitions, Classement (Hydra, transverse) et Joueurs (annuaire).
const NAV: { title: string; url: string }[] = [
  { title: "Accueil", url: "/" },
  { title: "Compétitions", url: "/competitions" },
  { title: "Classement", url: "/hydra" },
  { title: "Joueurs", url: "/joueurs" },
];

/**
 * En-tête public horizontal (repris de leaguebs) : logo, navigation, et CTA
 * auth-aware (Dashboard si admin connecté, sinon Connexion). Menu mobile.
 */
export function PublicHeader() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: me } = useQuery<Me>({
    queryKey: ["/api/auth/me"], queryFn: fetchMe, retry: false, staleTime: 60_000,
  });

  const isActive = (url: string) =>
    url === "/" ? location === "/" : location === url || location.startsWith(url + "/");

  const cta =
    me?.role === "admin" ? (
      <Link href="/admin">
        <Button variant="default" size="sm" className="gap-2">
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Button>
      </Link>
    ) : (
      <Link href="/login">
        <Button variant="outline" size="sm" className="gap-2">
          <LogIn className="h-4 w-4" /> Connexion
        </Button>
      </Link>
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/chronos-logo.png" alt="CHRONOS" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <Link key={item.url} href={item.url}>
              <Button
                variant="ghost"
                size="sm"
                className={`text-sm font-medium ${isActive(item.url) ? "text-primary" : "text-muted-foreground"}`}
              >
                {item.title}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">{cta}</div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {NAV.map((item) => (
              <Link key={item.url} href={item.url} onClick={() => setOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start font-medium ${isActive(item.url) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  {item.title}
                </Button>
              </Link>
            ))}
            <div className="mt-2" onClick={() => setOpen(false)}>{cta}</div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default PublicHeader;
