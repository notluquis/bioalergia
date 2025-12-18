import {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  Settings,
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
import React from "react";
import { NAV_DATA, NavCategory, NavItemData } from "../../shared/navigation-data";

export type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  requiredPermission?: { action: string; subject: string };
  exact?: boolean;
  subItems?: NavItem[];
};

export type NavSection = {
  title: string;
  category: NavCategory;
  items: NavItem[];
};

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  Settings,
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

const mapNavItem = (item: NavItemData): NavItem => ({
  ...item,
  icon: ICON_MAP[item.iconKey] || Box,
  subItems: item.subItems?.map(mapNavItem),
});

export const NAV_SECTIONS: NavSection[] = NAV_DATA.map((section) => ({
  ...section,
  items: section.items.map(mapNavItem),
}));
