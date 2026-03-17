import { createFileRoute } from "@tanstack/react-router";

import { Home } from "@/pages/Home";

// Dashboard / Home page (index route under _authed)
export const Route = createFileRoute("/_authed/")({
  component: Home,
});
