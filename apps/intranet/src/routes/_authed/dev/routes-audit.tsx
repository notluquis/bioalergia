import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Search, Settings, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
// Import dynamically to avoid bundling in prod if not tree-shaken correctly by router
// But for this dev page we can import directly for simplicity as the route itself should be dev-only
import { auditRouteNavigation } from "@/lib/route-utils";

export const Route = createFileRoute("/_authed/dev/routes-audit")({
  component: RoutesAuditPage,
});

function RoutesAuditPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "valid" | "technical" | "error">("all");

  const { data: audit } = useQuery({
    queryKey: ["routes-audit"],
    queryFn: () => auditRouteNavigation(router.routeTree),
  });

  const stats = useMemo(() => {
    if (!audit) {
      return { valid: 0, technical: 0, error: 0, total: 0 };
    }
    const errorCount = audit.missingNav.length + audit.missingPermission.length;
    return {
      valid: audit.validRoutes.length,
      technical: audit.technicalRoutes.length,
      error: errorCount,
      total: audit.validRoutes.length + audit.technicalRoutes.length + errorCount,
    };
  }, [audit]);

  const filteredRoutes = useMemo(() => {
    if (!audit) {
      return [];
    }

    let routes: Array<{ path: string; status: "valid" | "technical" | "error"; message?: string }> =
      [];

    // Add valid routes
    routes.push(...audit.validRoutes.map((path) => ({ path, status: "valid" as const })));

    // Add technical routes
    routes.push(
      ...audit.technicalRoutes.map((path) => ({
        path,
        status: "technical" as const,
        message: "Auto-excluded",
      })),
    );

    // Add missing nav errors
    routes.push(
      ...audit.missingNav.map((path) => ({
        path,
        status: "error" as const,
        message: "Missing staticData.nav",
      })),
    );

    // Add missing permission errors
    routes.push(
      ...audit.missingPermission.map((path) => ({
        path,
        status: "error" as const,
        message: "Missing staticData.permission",
      })),
    );

    // Filter by text
    if (searchTerm) {
      routes = routes.filter((r) => r.path.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Filter by type
    if (filter !== "all") {
      routes = routes.filter((r) => r.status === filter);
    }

    return routes.sort((a, b) => a.path.localeCompare(b.path));
  }, [audit, searchTerm, filter]);

  if (!audit) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">Routes Audit</h1>
          <p className="text-muted-foreground">
            Overview of route capabilities and compliance with navigation standards
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Routes</CardTitle>
            <Settings className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Valid Pages</CardTitle>
            <CheckCircle className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.valid}</div>
            <p className="text-muted-foreground text-xs">With proper metadata</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Technical</CardTitle>
            <Settings className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.technical}</div>
            <p className="text-muted-foreground text-xs">Auto-excluded from nav</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Errors</CardTitle>
            <AlertCircle className="size-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-danger">{stats.error}</div>
            <p className="text-muted-foreground text-xs">Missing required data</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search routes..."
              className="pl-8"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={filter === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("all")}
            >
              All
            </Badge>
            <Badge
              variant={filter === "valid" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("valid")}
            >
              Valid
            </Badge>
            <Badge
              variant={filter === "technical" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("technical")}
            >
              Technical
            </Badge>
            <Badge
              variant={filter === "error" ? "destructive" : "outline"}
              className="cursor-pointer hover:bg-danger"
              onClick={() => setFilter("error")}
            >
              Errors
            </Badge>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="grid grid-cols-12 gap-4 bg-default-50 px-4 py-3 font-medium text-sm">
            <div className="col-span-8">Route Path</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Notes</div>
          </div>
          <div className="divide-y">
            {filteredRoutes.map((route) => (
              <div
                key={route.path}
                className="grid grid-cols-12 items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-background"
              >
                <div className="col-span-8 font-mono">{route.path}</div>
                <div className="col-span-2">
                  {route.status === "valid" && (
                    <Badge
                      variant="outline"
                      className="border-success-soft-hover bg-success/10 text-success"
                    >
                      <CheckCircle className="mr-1 size-3" /> Valid
                    </Badge>
                  )}
                  {route.status === "technical" && (
                    <Badge variant="secondary">
                      <Settings className="mr-1 size-3" /> Technical
                    </Badge>
                  )}
                  {route.status === "error" && (
                    <Badge variant="destructive">
                      <ShieldAlert className="mr-1 size-3" /> Error
                    </Badge>
                  )}
                </div>
                <div className="col-span-2 text-muted-foreground text-xs">{route.message}</div>
              </div>
            ))}
            {filteredRoutes.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">No routes found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
