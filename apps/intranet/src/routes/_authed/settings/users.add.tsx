import { createFileRoute } from "@tanstack/react-router";
import AddUserPage from "@/pages/admin/AddUserPage";

export const Route = createFileRoute("/_authed/settings/users/add")({
  component: AddUserPage,
});
