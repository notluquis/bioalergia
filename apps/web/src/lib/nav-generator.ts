/**
 * Navigation Generator - Generates sidebar navigation from route data
 *
 * This utility extracts navigation items from the route data
 * and groups them by section for the sidebar.
 */

import {
  Box,
  Briefcase,
  Calendar,
  CalendarDays,
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
} from "lucide-react";
import type { ComponentType } from "react";

import { type NavSection, ROUTE_DATA, type RouteData, SECTION_ORDER } from "../../shared/route-data";

// ============================================================================
// TYPES
// ============================================================================

export interface NavItem {
  exact?: boolean;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  requiredPermission?: { action: string; subject: string };
  to: string;
}

export interface NavSectionData {
  items: NavItem[];
  title: string;
}

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Box,
  Briefcase,
  Calendar,
  CalendarDays,
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
};

// ============================================================================
// NAVIGATION EXTRACTION
// ============================================================================

interface ExtractedNavItem extends Omit<NavItem, "icon"> {
  iconKey: string;
  order: number;
  section: NavSection;
}

/**
 * Generates navigation sections from the route data
 *
 * @returns NavSectionData[] ready for the Sidebar component
 */
export function generateNavSections(): NavSectionData[] {
  const extractedItems = extractNavItems(ROUTE_DATA);

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
      .toSorted((a, b) => a.order - b.order)
      .map(
        (item): NavItem => ({
          exact: item.exact,
          icon: ICON_MAP[item.iconKey] ?? Box,
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

/**
 * Recursively extracts navigation items from route data
 */
function extractNavItems(routes: RouteData[], parentPath = ""): ExtractedNavItem[] {
  const items: ExtractedNavItem[] = [];

  for (const route of routes) {
    // Build full path
    let fullPath = `/${route.path}`;
    if (route.index) {
      fullPath = parentPath;
    } else if (parentPath) {
      fullPath = `${parentPath}/${route.path}`;
    }

    // If this route has nav config, add it
    if (route.nav) {
      items.push({
        exact: route.exact,
        iconKey: route.nav.iconKey,
        label: route.nav.label,
        order: route.nav.order,
        requiredPermission: route.permission,
        section: route.nav.section,
        to: fullPath,
      });
    }

    // Recursively process children
    if (route.children) {
      items.push(...extractNavItems(route.children, fullPath));
    }
  }

  return items;
}

/**
 * Cached navigation sections (computed once at startup)
 */
let cachedSections: NavSectionData[] | null = null;

/**
 * Gets navigation sections with caching
 */
export function getNavSections(): NavSectionData[] {
  if (!cachedSections) {
    cachedSections = generateNavSections();
  }
  return cachedSections;
}
