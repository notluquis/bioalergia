import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const OnboardingWizard = lazy(() => import("@/pages/onboarding/OnboardingWizard"));

// Onboarding page - accessible to all authenticated users (no permission required)
export const Route = createFileRoute("/_authed/onboarding")({
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <OnboardingWizard />
    </Suspense>
  ),
});
