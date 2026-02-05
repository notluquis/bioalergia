import { Breadcrumbs } from "@heroui/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import React from "react";

import { useAuth } from "@/context/AuthContext";
import { NotificationHistory } from "@/features/notifications/components/NotificationHistory";

import { Clock } from "../features/Clock";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";

// Helper: Extract label from match data
const getMatchLabel = (match: {
  context: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  loaderData?: unknown;
}): string => {
  // 1. Try static data (preferred for declarative titles)
  if (match.staticData) {
    if (typeof match.staticData.breadcrumb === "string") {
      return match.staticData.breadcrumb;
    }
    if (typeof match.staticData.title === "string") {
      return match.staticData.title;
    }
    // Handle optional function in staticData if defined that way (less common in TanStack Router but possible)
    if (typeof match.staticData.breadcrumb === "function") {
      return (match.staticData.breadcrumb as (data: unknown) => string)(match.loaderData);
    }
  }

  // 2. Fallback to context functions (legacy or dynamic)
  const { getBreadcrumb, getTitle } = match.context;
  if (typeof getBreadcrumb === "function") {
    return (getBreadcrumb as () => string)();
  }
  if (typeof getTitle === "function") {
    return (getTitle as () => string)();
  }

  return "";
};

// Helper: Build breadcrumb items from matches
const buildCrumbs = (
  matches: Array<{
    context: Record<string, unknown>;
    staticData?: Record<string, unknown>;
    loaderData?: unknown;
    pathname: string;
  }>,
) => {
  const activeMatches = matches.filter(
    (match) =>
      match.staticData?.title ||
      match.staticData?.breadcrumb ||
      typeof match.context?.getTitle === "function" ||
      typeof match.context?.getBreadcrumb === "function",
  );

  return activeMatches
    .map((match) => ({
      label: getMatchLabel(match),
      to: match.pathname,
    }))
    .filter((item) => item.label);
};

// Helper: Extract page title from last match or crumbs
const getPageTitle = (
  matches: Array<{
    context: Record<string, unknown>;
    staticData?: Record<string, unknown>;
    loaderData?: unknown;
  }>,
  crumbsList: Array<{ label: string }>,
) => {
  const activeMatches = matches.filter(
    (match) =>
      match.staticData?.title ||
      match.staticData?.breadcrumb ||
      typeof match.context?.getTitle === "function" ||
      typeof match.context?.getBreadcrumb === "function",
  );
  const lastMatch = activeMatches[activeMatches.length - 1];

  if (lastMatch) {
    return getMatchLabel(lastMatch);
  }
  if (crumbsList.length > 0) {
    return crumbsList[crumbsList.length - 1]?.label ?? "";
  }
  return "Inicio";
};
export function Header() {
  const routerStatus = useRouterState({ select: (s) => s.status });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const matches = useRouterState({ select: (s) => s.matches });

  const isNavigating = routerStatus === "pending";

  const { crumbs, pageTitle } = React.useMemo(() => {
    const castMatches = matches as unknown as Array<{
      context: Record<string, unknown>;
      staticData?: Record<string, unknown>;
      loaderData?: unknown;
      pathname: string;
    }>;

    const crumbsList = buildCrumbs(castMatches);
    const titleText = getPageTitle(castMatches, crumbsList);
    return { crumbs: crumbsList, pageTitle: titleText };
  }, [matches]);

  const handleLogout = async () => {
    await logout();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <header className="scroll-header-animation sticky top-0 z-30 flex items-center justify-between rounded-3xl px-6 py-3 transition-all duration-300">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3">
          <Breadcrumbs className="font-medium">
            {crumbs.length === 0 && <Breadcrumbs.Item>Inicio</Breadcrumbs.Item>}
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;

              return (
                <Breadcrumbs.Item key={crumb.to || i}>
                  {!isLast && crumb.to ? (
                    <Link to={crumb.to} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    crumb.label
                  )}
                </Breadcrumbs.Item>
              );
            })}
            {crumbs.length > 0 && crumbs[crumbs.length - 1]?.label !== pageTitle && (
              <Breadcrumbs.Item>{pageTitle}</Breadcrumbs.Item>
            )}
          </Breadcrumbs>

          {isNavigating && (
            <span className="flex items-center gap-1 font-semibold text-primary text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:block">
          <Clock />
        </div>
        <NotificationHistory />
        <ThemeToggle />
        <Button
          isIconOnly
          aria-label="Cerrar sesión"
          className="rounded-full border border-default-200/70 bg-background/80 text-foreground shadow-sm transition-all duration-300 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          onClick={() => {
            void handleLogout();
          }}
          title="Cerrar sesión"
          variant="ghost"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-default-50/50 shadow-inner transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </header>
  );
}
