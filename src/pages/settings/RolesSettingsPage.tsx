import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Shield, Check, RotateCw, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: { permissionId: number; permission: Permission }[];
};

type Permission = {
  id: number;
  action: string;
  subject: string;
  description: string | null;
};

export default function RolesSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  // Queries
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; roles: Role[] }>("/api/roles");
      return res.roles;
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; permissions: Permission[] }>("/api/permissions");
      return res.permissions;
    },
  });

  // Mutations
  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      await apiClient.post("/api/permissions/sync", {});
    },
    onSuccess: () => {
      toast.success("Permisos sincronizados con el sistema");
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: () => {
      toast.error("Error al sincronizar permisos");
    },
    onSettled: () => setIsSyncing(false),
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) => {
      await apiClient.post(`/api/roles/${roleId}/permissions`, { permissionIds });
    },
    onSuccess: () => {
      toast.success("Permisos actualizados");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => {
      toast.error("Error al actualizar permisos");
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      await apiClient.post("/api/roles", data);
    },
    onSuccess: () => {
      toast.success("Rol creado");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  // Derived state
  const roles = rolesQuery.data || [];
  const permissions = permissionsQuery.data || [];
  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;

  const handlePermissionToggle = (role: Role, permissionId: number) => {
    const currentPermissionIds = role.permissions.map((p) => p.permissionId);
    const hasPermission = currentPermissionIds.includes(permissionId);

    let newPermissionIds;
    if (hasPermission) {
      newPermissionIds = currentPermissionIds.filter((id) => id !== permissionId);
    } else {
      newPermissionIds = [...currentPermissionIds, permissionId];
    }

    updateRolePermissionsMutation.mutate({ roleId: role.id, permissionIds: newPermissionIds });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Roles y permisos</h1>
          <p className="text-base-content/60 text-sm">Gestiona los niveles de acceso y permisos del sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
            <RotateCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
            Sincronizar Definiciones
          </Button>
          <CreateRoleDialog onCreate={createRoleMutation.mutate} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <div key={role.id} className="surface-elevated space-y-2 rounded-xl p-4 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Shield size={20} />
              </div>
            </div>
            <h3 className="font-bold">{role.name}</h3>
            <p className="text-base-content/60 line-clamp-2 text-xs">{role.description || "Sin descripción"}</p>
            <div className="text-base-content/40 pt-2 font-mono text-xs">ID: {role.id}</div>
          </div>
        ))}
      </div>

      <div className="surface-elevated border-base-200 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="bg-base-200/50 w-1/3 min-w-50">Permiso / Acción</th>
                {roles.map((role) => (
                  <th key={role.id} className="bg-base-200/50 min-w-25 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold">{role.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-base-200/50 transition-colors">
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{perm.action}</span>
                      <span className="text-base-content/50 text-xs">{perm.subject}</span>
                    </div>
                  </td>
                  {roles.map((role) => {
                    const hasAccess = role.permissions.some((rp) => rp.permissionId === perm.id);
                    const isUpdating =
                      updateRolePermissionsMutation.isPending &&
                      updateRolePermissionsMutation.variables?.roleId === role.id;

                    return (
                      <td key={role.id} className="p-0 text-center">
                        <button
                          onClick={() => handlePermissionToggle(role, perm.id)}
                          disabled={isUpdating}
                          className={cn(
                            "flex h-full w-full items-center justify-center py-4 transition-colors",
                            hasAccess ? "hover:bg-red-500/10" : "hover:bg-green-500/10"
                          )}
                        >
                          {isUpdating ? (
                            <Loader2 className="text-base-content/40 h-4 w-4 animate-spin" />
                          ) : hasAccess ? (
                            <Check size={18} className="text-success" />
                          ) : (
                            <div className="border-base-300 bg-base-100 h-4 w-4 rounded-full border" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={roles.length + 1} className="text-base-content/50 py-8 text-center">
                    No hay permisos definidos. Haz clic en &quot;Sincronizar Definiciones&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateRoleDialog({ onCreate }: { onCreate: (data: { name: string; description: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, description });
    setOpen(false);
    setName("");
    setDescription("");
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Plus size={16} />
        Nuevo Rol
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Crear Nuevo Rol">
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Ej. Editor de Contenidos"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Input
              value={description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="Descripción breve del rol"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">Crear Rol</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
