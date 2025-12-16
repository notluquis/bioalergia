import {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  Settings,
  FileSpreadsheet,
} from "lucide-react";
import React from "react";
import { NAV_DATA, NavCategory } from "../../shared/navigation-data";

export type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  requiredPermission?: { action: string; subject: string };
  exact?: boolean;
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
};

export const NAV_SECTIONS: NavSection[] = NAV_DATA.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    icon: ICON_MAP[item.iconKey] || Box, // Fallback icon
  })),
}));
