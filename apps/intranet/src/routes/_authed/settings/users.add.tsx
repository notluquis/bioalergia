import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import Modal from "@/components/ui/Modal";
import AddUserPage from "@/pages/admin/AddUserPage";

function AddUserModal() {
  const navigate = useNavigate();

  const handleClose = () => {
    void navigate({ to: "/settings/users" });
  };

  return (
    <Modal isOpen={true} onClose={handleClose} title="Agregar usuario" boxClassName="max-w-4xl">
      <div className="max-h-[80vh] overflow-y-auto">
        <AddUserPage hideHeader={true} onSuccess={handleClose} />
      </div>
    </Modal>
  );
}

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users/add");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: AddUserModal,
});
