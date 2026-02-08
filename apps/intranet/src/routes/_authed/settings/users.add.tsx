import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageLoader } from "@/components/ui/PageLoader";

const AddUserPage = lazy(() =>
  import("@/pages/admin/AddUserPage").then((m) => ({
    default: m.AddUserPage,
  })),
);

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: ({ context }) => {
    if (!context.can("create", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users/add");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/settings/users" });
    }
  },
  staticData: {
    breadcrumb: "Agregar usuario",
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AddUserPage />
    </Suspense>
  ),
});
