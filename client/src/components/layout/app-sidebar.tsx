import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Trophy, Users, CalendarDays, UserCog, Tags, SlidersHorizontal,
  ClipboardCheck, Shuffle, Sparkles, ExternalLink, LayoutDashboard,
} from "lucide-react";

/**
 * Navigation latérale de l'espace d'administration (dashboard).
 * Les pages publiques utilisent l'en-tête horizontal (voir public-header.tsx) ;
 * la sidebar est réservée à la console admin.
 */
type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

// Dashboard organisé en 5 rubriques (règle MVP) : Dashboard · Compétitions ·
// Joueurs · Hydra · Tiers ; le reste des écrans devient des sous-entrées de la
// rubrique la plus proche.
const NAV: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
      { label: "Voir le site", href: "/", icon: ExternalLink },
    ],
  },
  {
    label: "Compétitions",
    items: [
      { label: "Compétitions", href: "/admin/competitions", icon: Trophy },
      { label: "Matchs", href: "/admin/matchs", icon: CalendarDays },
      { label: "Équipes", href: "/admin/equipes", icon: Users },
      { label: "Validation compo", href: "/admin/validation", icon: ClipboardCheck },
    ],
  },
  {
    label: "Joueurs",
    items: [
      { label: "Joueurs", href: "/admin/joueurs", icon: UserCog },
      { label: "Fusion doublons", href: "/admin/fusion", icon: Shuffle },
      { label: "Drifters", href: "/admin/drifters", icon: Shuffle },
    ],
  },
  {
    label: "Hydra",
    items: [
      { label: "Hydra", href: "/admin/hydra", icon: Sparkles },
      { label: "Tags", href: "/admin/tags", icon: Tags },
    ],
  },
  {
    label: "Tiers",
    items: [
      { label: "Tiers", href: "/admin/tiers", icon: SlidersHorizontal },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center justify-center px-2 py-3">
          <img src="/chronos-logo.png" alt="CHRONOS" className="h-14 w-auto max-w-full" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? false
                      : item.href === "/admin"
                        ? location === "/admin"
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
