import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

// Lazy load the Home component for code splitting
const Home = lazy(() => import("@/pages/Home"));

// Dashboard / Home page (index route under _authed)
export const Route = createFileRoute("/_authed/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Home />
    </Suspense>
  );
}
