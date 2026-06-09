import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { ReviewsModerationPage } from "@/pages/operations/ReviewsModerationPage";

export const Route = createFileRoute("/_authed/operations/reviews")({
  staticData: {
    nav: { iconKey: "Star", label: "Reseñas", order: 18, section: "Logística" },
    permission: { action: "update", subject: "Product" },
    title: "Moderación de reseñas",
  },
  beforeLoad: requirePermission("update", "Product"),
  component: ReviewsModerationPage,
});
