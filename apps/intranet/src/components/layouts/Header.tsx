import { Breadcrumbs, Button } from "@heroui/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { NotificationHistory } from "@/features/notifications/components/NotificationHistory";
import { useTheme } from "@/hooks/use-theme";
import { DeploymentStatusChip } from "./DeploymentStatusChip";

import { Clock } from "../features/Clock";

const getMatchLabel = (match: {
  context: Record<string, unknown>;
  loaderData?: unknown;
  staticData?: Record<string, unknown>;
}): string => {
  if (match.staticData) {
    if (typeof match.staticData.breadcrumb === "string") {
      return match.staticData.breadcrumb;
    }
    if (typeof match.staticData.title === "string") {
      return match.staticData.title;
    }
    if (typeof match.staticData.breadcrumb === "function") {
      return (match.staticData.breadcrumb as (data: unknown) => string)(match.loaderData);
    }
  }

  const { getBreadcrumb, getTitle } = match.context;
  if (typeof getBreadcrumb === "function") {
    return (getBreadcrumb as () => string)();
  }
  if (typeof getTitle === "function") {
    return (getTitle as () => string)();
  }

  return "";
};

const getFallbackLabelFromPathname = (pathname: string) => {
  const normalized = pathname.split("?")[0] ?? pathname;
  if (normalized === "/" || normalized.length === 0) {
    return "Inicio";
  }

  const segments = normalized.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (!lastSegment) {
    return "Inicio";
  }

  const decoded = decodeURIComponent(lastSegment).replace(/[-_]+/g, " ").trim();

  if (!decoded) {
    return "Inicio";
  }

  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
};

export function Header() {
  const { isDark, resolvedTheme, toggleTheme } = useTheme();
  const routerStatus = useRouterState({ select: (s) => s.status });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const matches = useRouterState({ select: (s) => s.matches });

  const isNavigating = routerStatus === "pending";

  const castMatches = matches as unknown as Array<{
    context: Record<string, unknown>;
    loaderData?: unknown;
    staticData?: Record<string, unknown>;
    pathname: string;
  }>;
  const crumbs = castMatches.map((match) => {
    const explicitLabel = getMatchLabel(match).trim();
    return {
      label:
        explicitLabel.length > 0 ? explicitLabel : getFallbackLabelFromPathname(match.pathname),
      to: match.pathname,
    };
  });

  const uniqueCrumbs = crumbs.filter(
    (item, index, array) => index === array.findIndex((candidate) => candidate.to === item.to)
  );
  const pageTitle = uniqueCrumbs[uniqueCrumbs.length - 1]?.label ?? "Inicio";
  const breadcrumbItems =
    uniqueCrumbs.length > 1 && uniqueCrumbs[uniqueCrumbs.length - 1]?.label === pageTitle
      ? uniqueCrumbs.slice(0, -1)
      : uniqueCrumbs;
  const showBreadcrumbs = breadcrumbItems.length > 0;

  const handleLogout = async () => {
    await logout();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <header className="surface-elevated sticky top-0 z-30 px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          {showBreadcrumbs ? (
            <Breadcrumbs className="font-medium text-default-500 text-xs">
              {breadcrumbItems.map((crumb) => {
                const isOnlyBreadcrumb = breadcrumbItems.length === 1;
                return (
                  <Breadcrumbs.Item key={`${crumb.to}-${crumb.label}`}>
                    {!isOnlyBreadcrumb ? (
                      <Link className=" hover:text-foreground" to={crumb.to}>
                        {crumb.label}
                      </Link>
                    ) : (
                      crumb.label
                    )}
                  </Breadcrumbs.Item>
                );
              })}
            </Breadcrumbs>
          ) : null}
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold text-foreground text-lg">{pageTitle}</h1>
            {isNavigating && (
              <span className="flex items-center gap-1 font-semibold text-primary text-xs">
                <Loader2 className="h-3 w-3 " />
              </span>
            )}
          </div>
        </div>

        <div className="ml-0 flex shrink-0 flex-col items-start gap-2 md:ml-4 md:items-end">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:block">
              <Clock />
            </div>
            <div className="hidden lg:block">
              <DeploymentStatusChip compact />
            </div>
            <NotificationHistory />
            <Button
              aria-label={
                resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
              }
              className="rounded-full border border-default-200/70 bg-background/80 text-foreground shadow-sm"
              isIconOnly
              onPress={toggleTheme}
              variant="ghost"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-default-50/50 shadow-inner">
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
            </Button>
            <Button
              isIconOnly
              aria-label="Cerrar sesión"
              className="rounded-full border border-default-200/70 bg-background/80 text-foreground shadow-sm hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              onPress={() => {
                void handleLogout();
              }}
              variant="ghost"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-default-50/50 shadow-inner ">
                <LogOut className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
