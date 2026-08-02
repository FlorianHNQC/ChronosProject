import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Trophy, Users, Shield, CalendarDays, UserCog, Tags, SlidersHorizontal,
  ClipboardCheck, Shuffle, Sparkles, ExternalLink,
} from "lucide-react";

/**
 * Navigation latérale de l'espace d'administration (dashboard).
 * Les pages publiques utilisent l'en-tête horizontal (voir public-header.tsx) ;
 * la sidebar est réservée à la console admin.
 */
type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Tableau de bord",
    items: [
      { label: "Voir le site", href: "/", icon: ExternalLink },
      { label: "Console admin", href: "/admin", icon: Shield },
    ],
  },
  {
    label: "Gestion",
    items: [
      { label: "Compétitions", href: "/admin/competitions", icon: Trophy },
      { label: "Équipes", href: "/admin/equipes", icon: Users },
      { label: "Matchs", href: "/admin/matchs", icon: CalendarDays },
      { label: "Joueurs", href: "/admin/joueurs", icon: UserCog },
    ],
  },
  {
    label: "Classement",
    items: [
      { label: "Hydra", href: "/admin/hydra", icon: Sparkles },
      { label: "Tiers", href: "/admin/tiers", icon: SlidersHorizontal },
      { label: "Tags", href: "/admin/tags", icon: Tags },
    ],
  },
  {
    label: "Outils",
    items: [
      { label: "Fusion doublons", href: "/admin/fusion", icon: Shuffle },
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
