import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PublicHeader } from "@/components/layout/public-header";
import { SplashScreen } from "@/components/splash-screen";
import { Placeholder } from "@/pages/placeholder";
import { HomePage } from "@/pages/home";
import { PlayersPage } from "@/pages/players";
import { PlayerProfilePage } from "@/pages/player-profile";
import { HydraPage } from "@/pages/hydra";
import { HydraV2Page } from "@/pages/hydra-v2";
import { CompetitionsPage } from "@/pages/competitions";
import { TeamsPage } from "@/pages/teams";
import { MatchesPage } from "@/pages/matches";
import { MatchDetailPage } from "@/pages/match-detail";
import { PlayoffsPage } from "@/pages/playoffs";
import { AwardsPage } from "@/pages/awards";
import { StatsPage } from "@/pages/stats";
import { LoginPage } from "@/pages/login";
import { PlayersAdminPage } from "@/pages/admin/players-admin";
import { HydraAdminPage } from "@/pages/admin/hydra-admin";
import { TiersAdminPage } from "@/pages/admin/tiers-admin";
import { TagsAdminPage } from "@/pages/admin/tags-admin";
import { CompetitionsAdminPage } from "@/pages/admin/competitions-admin";
import { TeamsAdminPage } from "@/pages/admin/teams-admin";
import { MatchesAdminPage } from "@/pages/admin/matches-admin";
import { FusionAdminPage } from "@/pages/admin/fusion-admin";
import { ValidationAdminPage } from "@/pages/admin/validation-admin";
import { DriftersAdminPage } from "@/pages/admin/drifters-admin";
import NotFound from "@/pages/not-found";

type Me = { id: string; email: string; role: string } | null;

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

function useMe() {
  return useQuery<Me>({ queryKey: ["/api/auth/me"], queryFn: fetchMe, retry: false, staleTime: 60_000 });
}

/** Protège l'espace admin : redirige vers /login si non authentifié admin. */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useMe();
  const ok = !!data && data.role === "admin";
  useEffect(() => {
    if (!isLoading && !ok) navigate("/login");
  }, [isLoading, ok, navigate]);
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  if (!ok) return null;
  return <>{children}</>;
}

/** Bouton du header admin : Déconnexion. */
function HeaderAuth() {
  const { data } = useMe();
  const [, navigate] = useLocation();
  if (!data) {
    return (
      <Button asChild size="sm" variant="outline" className="ml-auto gap-2">
        <Link href="/login">
          <LogIn className="h-4 w-4" /> Connexion
        </Link>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="ml-auto gap-2"
      onClick={async () => {
        await apiRequest("POST", "/api/auth/logout");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
      }}
    >
      <LogOut className="h-4 w-4" />
      <span>Déconnexion</span>
      <span className="hidden text-muted-foreground sm:inline">({data.email})</span>
    </Button>
  );
}

/** Espace public : en-tête horizontal + fond dégradé ambiant (repris de leaguebs). */
function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -right-24 top-1/3 h-[320px] w-[320px] rounded-full bg-primary/10 blur-[100px]" />
      </div>
      <div className="relative z-10">
        <PublicHeader />
        {/* key={location} : rejoue l'animation d'entrée à chaque changement de page. */}
        <main key={location} className="mx-auto w-full max-w-7xl animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

/** Espace admin : sidebar + barre supérieure. */
function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <HeaderAuth />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PublicRouter() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/competitions" component={CompetitionsPage} />
        <Route path="/calendrier" component={MatchesPage} />
        <Route path="/matchs/:id" component={MatchDetailPage} />
        <Route path="/playoffs" component={PlayoffsPage} />
        <Route path="/hydra-v2" component={HydraV2Page} />
        <Route path="/hydra" component={HydraPage} />
        <Route path="/equipes" component={TeamsPage} />
        <Route path="/joueurs/:id" component={PlayerProfilePage} />
        <Route path="/joueurs" component={PlayersPage} />
        <Route path="/stats" component={StatsPage} />
        <Route path="/recompenses" component={AwardsPage} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function AdminRouter() {
  return (
    <AdminLayout>
      <AdminGuard>
        <Switch>
          <Route path="/admin/joueurs" component={PlayersAdminPage} />
          <Route path="/admin/hydra" component={HydraAdminPage} />
          <Route path="/admin/tiers" component={TiersAdminPage} />
          <Route path="/admin/tags" component={TagsAdminPage} />
          <Route path="/admin/competitions" component={CompetitionsAdminPage} />
          <Route path="/admin/equipes" component={TeamsAdminPage} />
          <Route path="/admin/matchs" component={MatchesAdminPage} />
          <Route path="/admin/fusion" component={FusionAdminPage} />
          <Route path="/admin/validation" component={ValidationAdminPage} />
          <Route path="/admin/drifters" component={DriftersAdminPage} />
          <Route path="/admin" component={() => <Placeholder title="Console d'administration" note="Choisissez une rubrique." />} />
          <Route component={NotFound} />
        </Switch>
      </AdminGuard>
    </AdminLayout>
  );
}

function Router() {
  const [location] = useLocation();
  if (location === "/login") return <LoginPage />;
  if (location.startsWith("/admin")) return <AdminRouter />;
  return <PublicRouter />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem("chronos_visited"));
  const handleSplashComplete = () => {
    sessionStorage.setItem("chronos_visited", "true");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          {showSplash ? <SplashScreen onComplete={handleSplashComplete} /> : <Router />}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
