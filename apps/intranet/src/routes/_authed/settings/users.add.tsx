import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import AddUserPage from "@/pages/admin/AddUserPage";

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: ({ context }) => {
    console.log("[users.add] beforeLoad - checking permissions");
    console.log("[users.add] can('create', 'User'):", context.auth.can("create", "User"));

    if (!context.auth.can("create", "User")) {
      console.log("[users.add] Permission denied, redirecting to /");
      const routeApi = getRouteApi("/_authed/settings/users/add");
      throw routeApi.redirect({ to: "/" });
    }

    console.log("[users.add] Permission granted, loading component");
  },
  component: AddUserPage,
});
