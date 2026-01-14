import { createFileRoute, redirect } from "@tanstack/react-router";
import dayjs from "dayjs";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { participantQueries } from "@/features/participants/queries";

const ParticipantInsights = lazy(() => import("@/pages/ParticipantInsights"));

export const Route = createFileRoute("/_authed/finanzas/participants")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Person")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    // Default params matching the hook defaults
    const now = dayjs();
    const range = {
      from: now.startOf("month").format("YYYY-MM-DD"),
      to: now.endOf("month").format("YYYY-MM-DD"),
    };

    await context.queryClient.ensureQueryData(
      participantQueries.leaderboard({
        ...range,
        limit: 10,
        mode: "outgoing",
      })
    );
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ParticipantInsights />
    </Suspense>
  ),
});
