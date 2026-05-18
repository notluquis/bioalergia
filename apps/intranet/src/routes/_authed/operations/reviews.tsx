import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ReviewsModerationPage } from "@/pages/operations/ReviewsModerationPage";

export const Route = createFileRoute("/_authed/operations/reviews")({
  staticData: {
    nav: { iconKey: "Star", label: "Reseñas", order: 18, section: "Logística" },
    permission: { action: "update", subject: "Product" },
    title: "Moderación de reseñas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "Product")) {
      const routeApi = getRouteApi("/_authed/operations/reviews");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: ReviewsModerationPage,
});
