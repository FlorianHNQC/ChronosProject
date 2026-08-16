import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Placeholder } from "@/pages/placeholder";
import { HomePage } from "@/pages/home";
import { PlayersPage } from "@/pages/players";
import { PlayerProfilePage } from "@/pages/player-profile";
import { HydraPage } from "@/pages/hydra";
import { CompetitionsPage } from "@/pages/competitions";
import { CompetitionDetailPage } from "@/pages/competition-detail";
import { TeamsPage } from "@/pages/teams";
import { TeamProfilePage } from "@/pages/team-profile";
import { MatchesPage } from "@/pages/matches";
import { MatchDetailPage } from "@/pages/match-detail";
import { AwardsPage } from "@/pages/awards";
import { StatsPage } from "@/pages/stats";
import { LoginPage } from "@/pages/login";
import { ComingSoonPage } from "@/pages/coming-soon";
import { PlayersAdminPage } from "@/pages/admin/players-admin";
import { HydraAdminPage } from "@/pages/admin/hydra-admin";
import { CompetitionsAdminPage } from "@/pages/admin/competitions-admin";
import { CompetitionManagePage } from "@/pages/admin/competition-manage";
import { TournamentBuilderPage } from "@/pages/admin/tournament-builder";
import { TeamsAdminPage } from "@/pages/admin/teams-admin";
import { MatchesAdminPage } from "@/pages/admin/matches-admin";
import { FusionAdminPage } from "@/pages/admin/fusion-admin";
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

/** Protège les routes admin : redirige vers /login si non authentifié admin. */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useMe();
  const ok = !!data && data.role === "admin";
  useEffect(() => {
    if (!isLoading && !ok) navigate("/login");
  }, [isLoading, ok, navigate]);
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">…</div>;
  if (!ok) return null;
  return <>{children}</>;
}

const guarded = (Comp: React.ComponentType) => () => (
  <AdminGuard>
    <Comp />
  </AdminGuard>
);

function LogoutButton() {
  const { data } = useMe();
  const [, navigate] = useLocation();
  if (!data) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="ml-auto"
      onClick={async () => {
        await apiRequest("POST", "/api/auth/logout");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
      }}
    >
      Déconnexion ({data.email})
    </Button>
  );
}

function Shell() {
  // Fond global du site (réglage « home_bg »), commun à toutes les pages.
  const { data: siteBg } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/settings/home_bg"] });
  const siteImg = siteBg?.value || "/images/home-bg.webp";
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
    >
      {/* Fond du site : image floutée + désaturée sous un voile sombre (ambiance discrète, bien plus effacée que les bandeaux). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${siteImg}")`, filter: "blur(10px) saturate(0.55)", transform: "scale(1.1)" }}
        />
        <div className="absolute inset-0 bg-background/80" />
      </div>
      <AppSidebar />
      <SidebarInset className="relative z-10 bg-transparent">
        <header className="sticky top-0 z-40 flex items-center h-14 px-4 border-b border-border bg-background/95 backdrop-blur">
          <SidebarTrigger />
          <LogoutButton />
        </header>
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/competitions" component={CompetitionsPage} />
            <Route path="/competitions/:id" component={CompetitionDetailPage} />
            <Route path="/calendrier" component={MatchesPage} />
            <Route path="/matchs/:id" component={MatchDetailPage} />
            <Route path="/hydra" component={HydraPage} />
            <Route path="/equipes" component={TeamsPage} />
            <Route path="/equipes/:id" component={TeamProfilePage} />
            <Route path="/joueurs" component={PlayersPage} />
            <Route path="/joueurs/:id" component={PlayerProfilePage} />
            <Route path="/stats" component={StatsPage} />
            <Route path="/recompenses" component={AwardsPage} />
            <Route path="/admin/joueurs" component={guarded(PlayersAdminPage)} />
            <Route path="/admin/hydra" component={guarded(HydraAdminPage)} />
            <Route path="/admin/competitions" component={guarded(CompetitionsAdminPage)} />
            <Route path="/admin/competitions/:id" component={guarded(CompetitionManagePage)} />
            <Route path="/admin/tournoi" component={guarded(TournamentBuilderPage)} />
            <Route path="/admin/equipes" component={guarded(TeamsAdminPage)} />
            <Route path="/admin/matchs" component={guarded(MatchesAdminPage)} />
            <Route path="/admin/fusion" component={guarded(FusionAdminPage)} />
            <Route path="/admin" component={guarded(() => <Placeholder title="Console d'administration" note="Choisissez une rubrique." />)} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Verrou public : le visiteur voit « bientôt disponible » ; seul un admin
 * connecté accède au site. La route /login reste ouverte pour se connecter.
 */
function Gate() {
  const { data: me, isLoading } = useMe();
  const [location] = useLocation();
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  const isAdmin = !!me && me.role === "admin";
  if (!isAdmin) return location === "/login" ? <LoginPage /> : <ComingSoonPage />;
  return <Shell />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Gate />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
