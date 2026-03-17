import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { OnboardingWizard } from "@/pages/onboarding/OnboardingWizard";

const routeApi = getRouteApi("/onboarding");

// Onboarding page - accessible to authenticated users pending setup
export const Route = createFileRoute("/onboarding")({
  component: OnboardingWizard,

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
