import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import LoginPage from "@/features/auth/pages/LoginPage";

// Search params schema for redirect handling
const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

// Login route - public only (redirects authenticated users away)
export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context }) => {
    // If already authenticated, redirect to home or intended destination
    if (context.auth.user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPageWrapper,
});

// Wrapper to connect TanStack Router with the existing LoginPage
function LoginPageWrapper() {
  // The existing LoginPage uses React Router hooks internally.
  // During coexistence phase, we just render it as-is.
  // Later, we'll refactor LoginPage to use TanStack Router hooks.
  return <LoginPage />;
}
