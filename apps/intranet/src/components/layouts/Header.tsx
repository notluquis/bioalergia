import { Breadcrumbs, Chip } from "@heroui/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { NotificationHistory } from "@/features/notifications/components/NotificationHistory";

import { Clock } from "../features/Clock";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Tooltip } from "../ui/Tooltip";

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

export function Header() {
  const routerStatus = useRouterState({ select: (s) => s.status });
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const matches = useRouterState({ select: (s) => s.matches });

  const isNavigating = routerStatus === "pending";

  const castMatches = matches as unknown as Array<{
    context: Record<string, unknown>;
    loaderData?: unknown;
    staticData?: Record<string, unknown>;
    pathname: string;
  }>;
  const crumbs = castMatches
    .map((match) => ({
      label: getMatchLabel(match),
      to: match.pathname,
    }))
    .filter((item) => Boolean(item.label?.trim()));
  const pageTitle = crumbs[crumbs.length - 1]?.label ?? "Inicio";
  const showBreadcrumbs = !(
    crumbs.length === 0 ||
    (crumbs.length === 1 && crumbs[0]?.label === pageTitle)
  );

  const sessionIdentity = user ? user.name?.trim() || user.email : "Sin sesión";
  const rolesLabel = user && user.roles.length > 0 ? user.roles.join(", ") : "";
  const compactRoleLabel =
    !user || user.roles.length === 0
      ? ""
      : user.roles.length === 1
        ? (user.roles[0] ?? "")
        : `${user.roles[0]} +${user.roles.length - 1}`;
  const sessionTooltip = user
    ? `${sessionIdentity}${rolesLabel ? ` · ${rolesLabel}` : ""}`
    : "Sin sesión";

  const handleLogout = async () => {
    await logout();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 rounded-2xl border border-default-200/70 bg-background/85 px-4 py-3 backdrop-blur-md md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          {showBreadcrumbs ? (
            <Breadcrumbs className="font-medium text-default-500 text-xs">
              {crumbs.length === 0 && <Breadcrumbs.Item>Inicio</Breadcrumbs.Item>}
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <Breadcrumbs.Item key={`${crumb.to}-${crumb.label}`}>
                    {!isLast ? (
                      <Link className="transition-colors hover:text-foreground" to={crumb.to}>
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
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}
          </div>
        </div>

        <div className="ml-0 flex shrink-0 flex-col items-start gap-2 md:ml-4 md:items-end">
          <div className="flex min-w-0 items-center gap-2">
            <Chip className="shrink-0" color={user ? "success" : "danger"} size="sm" variant="soft">
              <span
                className={`mr-1 inline-flex h-2 w-2 rounded-full ${user ? "bg-success" : "bg-danger"}`}
              />
              {user ? "Sesión activa" : "Sin sesión"}
            </Chip>
            <Tooltip content={sessionTooltip} placement="bottom" showArrow>
              <span className="block min-w-0 truncate text-default-500 text-xs">
                {sessionIdentity}
                {compactRoleLabel ? ` · ${compactRoleLabel}` : ""}
              </span>
            </Tooltip>
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
        </div>
      </div>
    </header>
  );
}
