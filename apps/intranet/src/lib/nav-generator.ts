import type { AnyRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  FileBadge,
  FileBarChart,
  FileSpreadsheet,
  Fingerprint,
  GraduationCap,
  HardDrive,
  History,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  PackagePlus,
  PackageSearch,
  PiggyBank,
  Receipt,
  ScanBarcode,
  School,
  SearchCode,
  Settings2,
  ShieldCheck,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  Truck,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";
import type { ComponentType } from "react";

import type { NavConfig, NavSection, RoutePermission } from "@/types/navigation";

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
  ArrowDownToLine,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  FileBadge,
  FileBarChart,
  FileSpreadsheet,
  Fingerprint,
  GraduationCap,
  HardDrive,
  History,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  PackagePlus,
  PackageSearch,
  PiggyBank,
  Receipt,
  ScanBarcode,
  School,
  SearchCode,
  Settings2,
  ShieldCheck,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  Truck,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Webhook,
};

const SECTION_ORDER: NavSection[] = [
  "Clínica",
  "Pacientes",
  "Finanzas",
  "Logística",
  "Personal",
  "Comunicaciones",
  "Outreach",
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

  const sectionMap = new Map<NavSection, ExtractedNavItem[]>();

  for (const item of extractedItems) {
    const existing = sectionMap.get(item.section) ?? [];
    existing.push(item);
    sectionMap.set(item.section, existing);
  }

  const sections: NavSectionData[] = [];

  for (const sectionName of SECTION_ORDER) {
    const items = sectionMap.get(sectionName);
    if (!items?.length) {
      continue;
    }

    const sortedItems = items
      .sort((a, b) => a.order - b.order)
      .map(
        (item): NavItem => ({
          exact: item.exact,
          icon: ICON_MAP[item.iconKey] ?? Package,
          label: item.label,
          requiredPermission: item.requiredPermission,
          to: item.to,
        })
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

  if (route.options?.staticData?.nav) {
    const nav = route.options.staticData.nav as NavConfig;
    const permission = route.options.staticData.permission as RoutePermission | undefined;

    const to = (route.fullPath || route.path || "/") as string;

    items.push({
      iconKey: nav.iconKey,
      label: nav.label,
      order: nav.order,
      requiredPermission: permission,
      section: nav.section,
      to: to,
    });
  } else if (process.env.NODE_ENV === "development") {
    const fullPath = (route.fullPath || route.path) as string;
    const hasPermission = Boolean(route.options?.staticData?.permission);
    const hideFromNav = route.options?.staticData?.hideFromNav === true;

    if (fullPath && hasPermission && !hideFromNav) {
      import("./route-utils")
        .then(({ isTechnicalRoute }) => {
          if (!isTechnicalRoute(fullPath)) {
            console.warn(
              `⚠️  Route "${fullPath}" has permission but no nav metadata. Add staticData.nav or hideFromNav: true`
            );
          }
        })
        .catch(() => {});
    }
  }

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
  if (!children) {
    return [];
  }
  if (Array.isArray(children)) {
    return children;
  }
  if (typeof children === "object") {
    return Object.values(children as Record<string, RouteTreeNode>);
  }
  return [];
}
