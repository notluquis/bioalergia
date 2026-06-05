import { createFileRoute } from "@tanstack/react-router";

import { JobRadarPage } from "@/features/job-radar/pages/JobRadarPage";
import { jobRadarQueries } from "@/features/job-radar/queries";

export const Route = createFileRoute("/_authed/job-radar")({
  staticData: {
    nav: { iconKey: "Briefcase", label: "Job Radar", order: 10, section: "Personal" },
    breadcrumb: "Job Radar",
    title: "Job Radar",
  },
  component: JobRadarPage,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(jobRadarQueries.list({ postingStatus: "OPEN" }));
  },
});
