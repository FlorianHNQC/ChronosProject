import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Placeholder } from "@/pages/placeholder";
import { PlayersPage } from "@/pages/players";
import { PlayersAdminPage } from "@/pages/admin/players-admin";
import NotFound from "@/pages/not-found";

/**
 * Shell applicatif.
 * V1 : le module Joueurs est branché ; les autres routes restent des
 * placeholders en attendant le portage / l'implémentation.
 */
function Shell() {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex items-center h-14 px-4 border-b border-border bg-background/95 backdrop-blur">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={() => <Placeholder title="Chronos" note="Plateforme unifiée — fondation en place. Choisissez une section dans la barre latérale." />} />
            <Route path="/competitions" component={() => <Placeholder title="Ligue & tournois" />} />
            <Route path="/calendrier" component={() => <Placeholder title="Calendrier" />} />
            <Route path="/playoffs" component={() => <Placeholder title="Playoffs" />} />
            <Route path="/hydra" component={() => <Placeholder title="Hydra — classement par tiers" note="Section Hydra (façon Prydwen) : accordéons, modes Joueurs / Rookie / Réserve, tags. À implémenter." />} />
            <Route path="/equipes" component={() => <Placeholder title="Équipes" />} />
            <Route path="/joueurs" component={PlayersPage} />
            <Route path="/stats" component={() => <Placeholder title="Classements de stats" />} />
            <Route path="/recompenses" component={() => <Placeholder title="Récompenses" />} />
            <Route path="/admin/joueurs" component={PlayersAdminPage} />
            <Route path="/admin" component={() => <Placeholder title="Console d'administration" note="Choisissez une rubrique — ex. Joueurs." />} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Shell />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
