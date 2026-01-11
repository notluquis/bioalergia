import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CSVUploadPage = lazy(() => import("@/pages/settings/CSVUploadPage"));

export const Route = createFileRoute("/_authed/settings/csv-upload")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "BulkData")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CSVUploadPage />
    </Suspense>
  ),
});
