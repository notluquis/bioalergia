/**
 * Navigation Generator - Generates sidebar navigation from route data
 *
 * This utility extracts navigation items from the route data
 * and groups them by section for the sidebar.
 */

import type { ComponentType } from "react";
import {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  FileSpreadsheet,
  ClipboardCheck,
  Users,
  Calendar,
  Settings2,
  ListChecks,
  Upload,
  PackagePlus,
  Clock,
  UserCog,
} from "lucide-react";
import { ROUTE_DATA, SECTION_ORDER, type RouteData, type NavSection } from "../../shared/route-data";

// ============================================================================
// TYPES
// ============================================================================

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  requiredPermission?: { action: string; subject: string };
  exact?: boolean;
}

export interface NavSectionData {
  title: string;
  items: NavItem[];
}

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  FileSpreadsheet,
  ClipboardCheck,
  Users,
  Calendar,
  Settings2,
  ListChecks,
  Upload,
  PackagePlus,
  Clock,
  UserCog,
};

// ============================================================================
// NAVIGATION EXTRACTION
// ============================================================================

interface ExtractedNavItem extends Omit<NavItem, "icon"> {
  iconKey: string;
  section: NavSection;
  order: number;
}

/**
 * Recursively extracts navigation items from route data
 */
function extractNavItems(routes: RouteData[], parentPath = ""): ExtractedNavItem[] {
  const items: ExtractedNavItem[] = [];

  for (const route of routes) {
    // Build full path
    const fullPath = route.index ? parentPath : parentPath ? `${parentPath}/${route.path}` : `/${route.path}`;

    // If this route has nav config, add it
    if (route.nav) {
      items.push({
        to: fullPath,
        label: route.nav.label,
        iconKey: route.nav.iconKey,
        section: route.nav.section,
        order: route.nav.order,
        requiredPermission: route.permission,
        exact: route.exact,
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
      .sort((a, b) => a.order - b.order)
      .map(
        (item): NavItem => ({
          to: item.to,
          label: item.label,
          icon: ICON_MAP[item.iconKey] ?? Box,
          requiredPermission: item.requiredPermission,
          exact: item.exact,
        })
      );

    sections.push({
      title: sectionName,
      items: sortedItems,
    });
  }

  return sections;
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
