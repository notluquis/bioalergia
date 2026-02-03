import type { AnyRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Box,
  Briefcase,
  Calendar,
  CalendarDays,
  ChartLine,
  ClipboardCheck,
  Clock,
  CreditCard,
  Database,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  PackagePlus,
  PiggyBank,
  Settings2,
  Upload,
  UserCog,
  Users,
  Users2,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

import type { NavConfig, NavSection, RoutePermission } from "@/types/navigation";

// Reuse NavItem interface from original generator to stay compatible with Sidebar
export interface NavItem {
  exact?: boolean;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  requiredPermission?: RoutePermission;
  to: string;
}

export interface NavSectionData {
  items: NavItem[];
  title: string;
}

const ICON_MAP: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Box,
  Briefcase,
  BarChart3,
  Calendar,
  CalendarDays,
  ChartLine,
  ClipboardCheck,
  Clock,
  CreditCard,
  Database,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  PackagePlus,
  PiggyBank,
  Settings2,
  Upload,
  UserCog,
  Users,
  Users2,
  Wallet,
};

const SECTION_ORDER: NavSection[] = [
  "Calendario",
  "Insumos",
  "Finanzas",
  "Servicios",
  "Operaciones",
  "Sistema",
];

interface ExtractedNavItem extends Omit<NavItem, "icon"> {
  iconKey: string;
  order: number;
  section: NavSection;
}

type RouteTreeNode = AnyRoute;

export function generateNavSections(routeTree: RouteTreeNode): NavSectionData[] {
  const extractedItems = extractNavItems(routeTree);

  // Group by section
  const sectionMap = new Map<NavSection, ExtractedNavItem[]>();

  for (const item of extractedItems) {
    const existing = sectionMap.get(item.section) ?? [];
    existing.push(item);
    sectionMap.set(item.section, existing);
  }

  // Build sections in defined order
  const sections: NavSectionData[] = [];

  for (const sectionName of SECTION_ORDER) {
    const items = sectionMap.get(sectionName);
    if (!items?.length) continue;

    // Sort by order and convert to NavItem
    const sortedItems = items
      .sort((a, b) => a.order - b.order)
      .map(
        (item): NavItem => ({
          exact: item.exact,
          icon: ICON_MAP[item.iconKey] ?? Box,
          label: item.label,
          requiredPermission: item.requiredPermission,
          to: item.to,
        }),
      );

    sections.push({
      items: sortedItems,
      title: sectionName,
    });
  }

  return sections;
}

function extractNavItems(route: RouteTreeNode): ExtractedNavItem[] {
  const items: ExtractedNavItem[] = [];

  // Check if current route has nav data
  // TanStack router adds options to the route object
  if (route.options?.staticData?.nav) {
    const nav = route.options.staticData.nav as NavConfig;
    const permission = route.options.staticData.permission as RoutePermission | undefined;

    // Using route.fullPath or route.to for the link
    // routeTree nodes usually have fullPath available if flattened or built correctly
    // If not, we might need to rely on the "path" and build it up, but generated tree usually has fullPath
    // Let's assume for now route.fullPath exists on the plain object structure from .gen.ts
    const to = route.fullPath || route.path || "/";

    items.push({
      iconKey: nav.iconKey,
      label: nav.label,
      order: nav.order,
      requiredPermission: permission,
      section: nav.section,
      to: to,
    });
  }
  // In development, warn about routes that might be missing nav
  else if (process.env.NODE_ENV === "development") {
    const fullPath = route.fullPath || route.path;
    const hasPermission = !!route.options?.staticData?.permission;
    const hideFromNav = route.options?.staticData?.hideFromNav === true;

    // Only warn for non-technical routes with permission but no nav
    if (fullPath && hasPermission && !hideFromNav) {
      // Import isTechnicalRoute dynamically to avoid circular deps
      import("./route-utils")
        .then(({ isTechnicalRoute }) => {
          if (!isTechnicalRoute(fullPath)) {
            console.warn(
              `⚠️  Route "${fullPath}" has permission but no nav metadata. Add staticData.nav or hideFromNav: true`,
            );
          }
        })
        .catch(() => {
          // Silently ignore if route-utils not available yet
        });
    }
  }

  // Process children
  if (route.children) {
    const children = getRouteChildren(route.children);
    children.forEach((child) => {
      items.push(...extractNavItems(child));
    });
  }

  return items;
}

let cachedSections: NavSectionData[] | null = null;
let cachedRouteTree: RouteTreeNode | null = null;

export function getNavSections(routeTree: RouteTreeNode): NavSectionData[] {
  if (!cachedSections || cachedRouteTree !== routeTree) {
    cachedRouteTree = routeTree;
    cachedSections = generateNavSections(routeTree);
  }
  return cachedSections;
}

function getRouteChildren(children: RouteTreeNode["children"]): RouteTreeNode[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  if (typeof children === "object") {
    return Object.values(children as Record<string, RouteTreeNode>);
  }
  return [];
}
