import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Search, Settings, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
// Import dynamically to avoid bundling in prod if not tree-shaken correctly by router
// But for this dev page we can import directly for simplicity as the route itself should be dev-only
import { auditRouteNavigation } from "@/lib/route-utils";
import { routeTree } from "@/routeTree.gen";

export const Route = createFileRoute("/_authed/dev/routes-audit")({
  component: RoutesAuditPage,
});

function RoutesAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "valid" | "technical" | "error">("all");

  const { data: audit } = useQuery({
    queryKey: ["routes-audit"],
    queryFn: () => auditRouteNavigation(routeTree),
  });

  const stats = useMemo(() => {
    if (!audit) return { valid: 0, technical: 0, error: 0, total: 0 };
    const errorCount = audit.missingNav.length + audit.missingPermission.length;
    return {
      valid: audit.validRoutes.length,
      technical: audit.technicalRoutes.length,
      error: errorCount,
      total: audit.validRoutes.length + audit.technicalRoutes.length + errorCount,
    };
  }, [audit]);

  const filteredRoutes = useMemo(() => {
    if (!audit) return [];

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

  if (!audit) return <div>Loading...</div>;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Routes Audit</h1>
          <p className="text-muted-foreground">
            Overview of route capabilities and compliance with navigation standards
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Routes</CardTitle>
            <Settings className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Pages</CardTitle>
            <CheckCircle className="text-success size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.valid}</div>
            <p className="text-muted-foreground text-xs">With proper metadata</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Technical</CardTitle>
            <Settings className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.technical}</div>
            <p className="text-muted-foreground text-xs">Auto-excluded from nav</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="text-error size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-error text-2xl font-bold">{stats.error}</div>
            <p className="text-muted-foreground text-xs">Missing required data</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 size-4" />
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
              className="hover:bg-error cursor-pointer"
              onClick={() => setFilter("error")}
            >
              Errors
            </Badge>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="bg-base-200 grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium">
            <div className="col-span-8">Route Path</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Notes</div>
          </div>
          <div className="divide-y">
            {filteredRoutes.map((route) => (
              <div
                key={route.path}
                className="hover:bg-base-100 grid grid-cols-12 items-center gap-4 px-4 py-3 text-sm transition-colors"
              >
                <div className="col-span-8 font-mono">{route.path}</div>
                <div className="col-span-2">
                  {route.status === "valid" && (
                    <Badge
                      variant="outline"
                      className="text-success border-success-soft-hover bg-success/10"
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
                <div className="text-muted-foreground col-span-2 text-xs">{route.message}</div>
              </div>
            ))}
            {filteredRoutes.length === 0 && (
              <div className="text-muted-foreground py-8 text-center">No routes found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
