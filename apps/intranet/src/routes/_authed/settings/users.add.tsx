import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import PageLoader from "@/components/ui/PageLoader";
import AddUserPage from "@/pages/admin/AddUserPage";

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users/add");
      throw routeApi.redirect({ to: "/" });
    }
  },
  pendingComponent: () => <PageLoader />,
  component: AddUserPage,
});
