import { Breadcrumbs, BreadcrumbsItem } from "@heroui/react";
import { Link, useMatches, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import React from "react";

import { useAuth } from "@/context/AuthContext";

import Clock from "../features/Clock";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";

// Helper: Extract label from match breadcrumb/title
const getMatchLabel = (match: {
  staticData: { breadcrumb?: unknown; title?: string };
  loaderData: unknown;
}): string => {
  const { breadcrumb, title } = match.staticData;
  if (typeof breadcrumb === "function") {
    return breadcrumb(match.loaderData);
  }
  if (typeof breadcrumb === "string") {
    return breadcrumb;
  }
  return title || "";
};

// Helper: Build breadcrumb items from matches
const buildCrumbs = (
  matches: Array<{
    staticData: { breadcrumb?: unknown; title?: string };
    loaderData: unknown;
    pathname: string;
  }>,
) => {
  const activeMatches = matches.filter(
    (match) => match.staticData?.breadcrumb || match.staticData?.title,
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
  matches: Array<{ staticData: { breadcrumb?: unknown; title?: string }; loaderData: unknown }>,
  crumbsList: Array<{ label: string }>,
) => {
  const activeMatches = matches.filter(
    (match) => match.staticData?.breadcrumb || match.staticData?.title,
  );
  const lastMatch = activeMatches[activeMatches.length - 1];

  if (lastMatch?.staticData?.title) {
    return lastMatch.staticData.title;
  }
  if (lastMatch) {
    return getMatchLabel(lastMatch);
  }
  if (crumbsList.length > 0) {
    return crumbsList[crumbsList.length - 1]?.label ?? "";
  }
  return "Inicio";
};

export default function Header() {
  const routerStatus = useRouterState({ select: (s) => s.status });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const matches = useMatches();

  const isNavigating = routerStatus === "pending";

  const { crumbs, pageTitle } = React.useMemo(() => {
    const crumbsList = buildCrumbs(matches);
    const titleText = getPageTitle(matches, crumbsList);
    return { crumbs: crumbsList, pageTitle: titleText };
  }, [matches]);

  const handleLogout = async () => {
    await logout();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <header className="scroll-header-animation sticky top-0 z-30 flex items-center justify-between rounded-3xl px-6 py-1 transition-all duration-300">
      <div className="flex flex-col gap-0.5">
        {(crumbs.length > 1 || (crumbs.length === 1 && crumbs[0]?.label !== pageTitle)) && (
          <Breadcrumbs className="text-default-500/60">
            {crumbs.map((crumb, i) => {
              const isCurrent = i === crumbs.length - 1;
              return (
                <BreadcrumbsItem key={crumb.to || i}>
                  {isCurrent || !crumb.to ? (
                    crumb.label
                  ) : (
                    <Link to={crumb.to} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </BreadcrumbsItem>
              );
            })}
          </Breadcrumbs>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{pageTitle}</h1>
          {isNavigating && (
            <span className="text-primary flex items-center gap-1 text-xs font-semibold">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando...
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:block">
          <Clock />
        </div>
        <ThemeToggle />
        <Button
          isIconOnly
          aria-label="Cerrar sesión"
          className="border-default-200/70 bg-background/80 text-foreground hover:bg-danger/10 hover:border-danger/40 hover:text-danger rounded-full border shadow-sm transition-all duration-300"
          onClick={() => {
            void handleLogout();
          }}
          title="Cerrar sesión"
          variant="ghost"
        >
          <span className="bg-default-50/50 flex h-6 w-6 items-center justify-center rounded-full shadow-inner transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </header>
  );
}
