import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Trophy, Swords, Users, BarChart3, Sparkles, Shield,
  CalendarDays, Award, Home, UserCog, Tags, SlidersHorizontal,
  ClipboardCheck, Shuffle,
} from "lucide-react";

/**
 * Navigation latérale unique et groupée (§10 du CDC).
 *
 * Objectif : régler la découvrabilité — sur leaguebs et statsbs, de nombreuses
 * pages n'étaient accessibles que par URL directe. Ici, tout ce qui est destiné
 * à un rôle apparaît dans une section de la barre latérale.
 *
 * FONDATION : les routes pointent vers des pages placeholder ; elles seront
 * remplacées par les vraies pages au fil des incréments.
 */

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Compétitions",
    items: [
      { label: "Accueil", href: "/", icon: Home },
      { label: "Ligue & tournois", href: "/competitions", icon: Trophy },
      { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
    ],
  },
  {
    label: "Hydra",
    items: [
      { label: "Classement (tiers)", href: "/hydra", icon: Sparkles },
    ],
  },
  {
    label: "Équipes & Joueurs",
    items: [
      { label: "Équipes", href: "/equipes", icon: Users },
      { label: "Joueurs", href: "/joueurs", icon: Swords },
    ],
  },
  {
    label: "Statistiques",
    items: [
      { label: "Classements de stats", href: "/stats", icon: BarChart3 },
      { label: "Récompenses", href: "/recompenses", icon: Award },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Console admin", href: "/admin", icon: Shield },
      { label: "Compétitions (admin)", href: "/admin/competitions", icon: Trophy },
      { label: "Récompenses (admin)", href: "/admin/recompenses", icon: Award },
      { label: "Tournoi aléatoire", href: "/admin/aleatoire", icon: Shuffle },
      { label: "Équipes (admin)", href: "/admin/equipes", icon: Users },
      { label: "Matchs (admin)", href: "/admin/matchs", icon: CalendarDays },
      { label: "Joueurs (admin)", href: "/admin/joueurs", icon: UserCog },
      { label: "Hydra (admin)", href: "/admin/hydra", icon: Sparkles },
      { label: "Tiers (admin)", href: "/admin/tiers", icon: SlidersHorizontal },
      { label: "Tags (admin)", href: "/admin/tags", icon: Tags },
      { label: "Fusion doublons", href: "/admin/fusion", icon: UserCog },
      { label: "Validation compo", href: "/admin/validation", icon: ClipboardCheck },
      { label: "Drifters", href: "/admin/drifters", icon: Shuffle },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-3">
          <span className="text-xl font-bold tracking-tight text-primary">CHRONOS</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // Comparaison par segment : sans cela /hydra-v2 allumerait aussi /hydra.
                  const active =
                    item.href === "/"
                      ? location === "/"
                      : location === item.href || location.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
