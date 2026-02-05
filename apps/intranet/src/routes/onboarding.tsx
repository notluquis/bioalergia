import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const OnboardingWizard = lazy(() =>
  import("@/pages/onboarding/OnboardingWizard").then((m) => ({ default: m.OnboardingWizard })),
);

const routeApi = getRouteApi("/onboarding");

// Onboarding page - accessible to authenticated users pending setup
export const Route = createFileRoute("/onboarding")({
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <OnboardingWizard />
    </Suspense>
  ),

  beforeLoad: async ({ context }) => {
    // 1. Ensure user is logged in
    const user = await context.auth.ensureSession();

    if (!user) {
      throw routeApi.redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    // 2. If user is already active, they shouldn't be here
    if (user.status === "ACTIVE") {
      throw routeApi.redirect({
        to: "/",
      });
    }
  },
});
