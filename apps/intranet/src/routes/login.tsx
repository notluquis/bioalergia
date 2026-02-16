import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";

import { LoginPage } from "@/features/auth/pages/LoginPage";

// Search params schema for redirect handling
const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

// Login route - public only (redirects authenticated users away)

const routeApi = getRouteApi("/login");

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginPageWrapper,
  beforeLoad: async ({ context }) => {
    // If already authenticated, redirect to home or intended destination
    if (context.auth.user) {
      throw routeApi.redirect({ to: "/" });
    }
  },
});

// Wrapper to connect TanStack Router with the existing LoginPage
function LoginPageWrapper() {
  // LoginPage now uses TanStack Router hooks internally.
  return <LoginPage />;
}
