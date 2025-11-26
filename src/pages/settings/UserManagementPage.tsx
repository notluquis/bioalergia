import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Shield, MoreVertical, Key, Lock, Fingerprint, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import relativeTime from "dayjs/plugin/relativeTime";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { cn } from "../../lib/utils";

dayjs.extend(relativeTime);
dayjs.locale("es");

type User = {
  id: number;
  email: string;
  role: "GOD" | "ADMIN" | "ANALYST" | "VIEWER";
  status: "ACTIVE" | "INACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  createdAt: string;
  hasPasskey: boolean;
  person: {
    names: string;
    fatherName: string | null;
    rut: string;
  };
};

export default function UserManagementPage() {
  useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const payload = await res.json();
      return (payload.users || []) as User[];
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/users/${userId}/passkey`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete passkey");
      return res.json();
    },
    onSuccess: () => {
      success("Passkey eliminado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => {
      error("Error al eliminar Passkey");
    },
  });

  const handleDeletePasskey = (userId: number) => {
    if (confirm("¿Estás seguro de eliminar el Passkey de este usuario?")) {
      deletePasskeyMutation.mutate(userId);
    }
  };

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.person?.names?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (user.person?.rut ?? "").includes(search);
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "badge-success";
      case "PENDING_SETUP":
        return "badge-warning";
      case "SUSPENDED":
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Usuarios</h1>
          <p className="text-sm text-base-content/60">Gestiona el acceso y roles del sistema.</p>
        </div>
        <Button className="gap-2">
          <Plus size={16} />
          Invitar Usuario
        </Button>
      </div>

      <div className="surface-elevated rounded-2xl p-4">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
            <Input
              placeholder="Buscar por nombre, email o RUT..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered w-full sm:w-48"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">Todos los roles</option>
            <option value="ADMIN">Admin</option>
            <option value="ANALYST">Analista</option>
            <option value="VIEWER">Visualizador</option>
          </select>
        </div>

        <div className="overflow-x-auto min-h-[400px] pb-32">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Seguridad</th>
                <th>Creado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-content/60">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-content/60">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers?.map((user) => (
                  <tr key={user.id} className="hover:bg-base-200/50">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
                            <span className="text-xs font-bold">{user.person.names[0]}</span>
                          </div>
                        </div>
                        <div>
                          <div className="font-bold">
                            {user.person.names} {user.person.fatherName}
                          </div>
                          <div className="text-xs opacity-50">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {user.role === "GOD" && <Shield size={14} className="text-warning" />}
                        <span className="badge badge-ghost badge-sm font-medium">{user.role}</span>
                      </div>
                    </td>
                    <td>
                      <div className={cn("badge badge-sm gap-2", getStatusColor(user.status))}>
                        {user.status === "ACTIVE" && <div className="size-1.5 rounded-full bg-current" />}
                        {user.status}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {user.hasPasskey && (
                          <div className="tooltip" data-tip="Passkey Configurado">
                            <Fingerprint size={16} className="text-success" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-base-content/70">{dayjs(user.createdAt).format("DD MMM YYYY")}</td>
                    <td>
                      <div className="dropdown dropdown-left dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
                          <MoreVertical size={16} />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow border border-base-200"
                        >
                          <li>
                            <a>
                              <Key size={14} />
                              Resetear Contraseña
                            </a>
                          </li>
                          {user.hasPasskey && (
                            <li>
                              <a onClick={() => handleDeletePasskey(user.id)} className="text-warning">
                                <Trash2 size={14} />
                                Eliminar Passkey
                              </a>
                            </li>
                          )}
                          {user.status !== "SUSPENDED" ? (
                            <li>
                              <a className="text-error">
                                <Lock size={14} />
                                Suspender Acceso
                              </a>
                            </li>
                          ) : (
                            <li>
                              <a className="text-success">
                                <Shield size={14} />
                                Reactivar Acceso
                              </a>
                            </li>
                          )}
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
