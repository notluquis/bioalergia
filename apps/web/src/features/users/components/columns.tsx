import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Fingerprint,
  Key,
  Lock,
  MoreVertical,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Tooltip } from "@/components/ui/Tooltip";
import type { User } from "@/features/users/types";
import { getPersonFullName, getPersonInitials } from "@/lib/person";
import { BADGE_SM } from "@/lib/styles";
import { cn } from "@/lib/utils";

// Helper for status colors
const getStatusColor = (s: string) => {
  switch (s) {
    case "ACTIVE": {
      return "badge-success";
    }
    case "PENDING_SETUP": {
      return "badge-warning";
    }
    case "SUSPENDED": {
      return "badge-error";
    }
    default: {
      return "badge-ghost";
    }
  }
};

export const getColumns = (actions: {
  onDeletePasskey: (id: number) => void;
  onDeleteUser: (id: number) => void;
  onEditRole: (user: User) => void;
  onResetPassword: (id: number) => void;
  onToggleMfa: (id: number, current: boolean) => void;
  onToggleStatus: (id: number, status: string) => void;
}): ColumnDef<User>[] => [
  {
    accessorKey: "user",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content flex h-10 w-10 items-center justify-center rounded-full">
              <span className="text-xs font-bold">{getPersonInitials(user.person)}</span>
            </div>
          </div>
          <div>
            <div className="font-bold">{getPersonFullName(user.person)}</div>
            <div className="text-xs opacity-50">{user.email}</div>
          </div>
        </div>
      );
    },
    filterFn: (row, _id, value) => {
      const user = row.original;
      const search = value.toLowerCase();
      return (
        user.email.toLowerCase().includes(search) ||
        getPersonFullName(user.person).toLowerCase().includes(search)
      );
    },
    header: "Usuario",
  },
  {
    accessorKey: "role",
    cell: ({ row }) => (
      <span className="badge badge-ghost badge-sm font-medium whitespace-nowrap">
        {row.original.role}
      </span>
    ),
    header: "Rol",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <div className={cn(BADGE_SM, "w-fit gap-2 whitespace-nowrap", getStatusColor(status))}>
          {status === "ACTIVE" && <div className="size-1.5 rounded-full bg-current" />}
          {status}
        </div>
      );
    },
    header: "Estado",
  },
  {
    accessorKey: "mfaEnabled",
    cell: ({ row }) => (
      <div className="flex justify-center">
        {row.original.mfaEnabled ? (
          <Tooltip content="MFA activado">
            <div>
              <ShieldCheck className="text-success size-5" />
            </div>
          </Tooltip>
        ) : (
          <Tooltip content="MFA inactivo">
            <div>
              <ShieldCheck className="text-base-content/20 size-5" />
            </div>
          </Tooltip>
        )}
      </div>
    ),
    header: () => <div className="text-center">MFA</div>,
    size: 60,
  },
  {
    accessorKey: "hasPasskey",
    cell: ({ row }) => (
      <div className="flex justify-center">
        {row.original.hasPasskey ? (
          <Tooltip content="Passkey configurado">
            <div>
              <Fingerprint className="text-success size-5" />
            </div>
          </Tooltip>
        ) : (
          <Tooltip content="Sin passkey">
            <div>
              <Fingerprint className="text-base-content/20 size-5" />
            </div>
          </Tooltip>
        )}
      </div>
    ),
    header: () => <div className="text-center">Passkey</div>,
    size: 60,
  },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="text-base-content/70 text-sm">
        {dayjs(row.original.createdAt).format("DD MMM YYYY")}
      </span>
    ),
    header: "Creado",
  },
  {
    cell: ({ row }) => {
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="btn btn-ghost btn-xs" type="button">
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                actions.onEditRole(user);
              }}
            >
              <UserCog className="mr-2 h-4 w-4" />
              Editar rol
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                actions.onToggleMfa(user.id, user.mfaEnabled);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {user.mfaEnabled ? "Desactivar" : "Activar"} MFA
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                actions.onResetPassword(user.id);
              }}
            >
              <Key className="mr-2 h-4 w-4" />
              Restablecer contraseña
            </DropdownMenuItem>
            {user.hasPasskey && (
              <DropdownMenuItem
                className="text-warning focus:text-warning"
                onClick={() => {
                  actions.onDeletePasskey(user.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar passkey
              </DropdownMenuItem>
            )}
            {user.status === "SUSPENDED" ? (
              <DropdownMenuItem
                className="text-success focus:text-success"
                onClick={() => {
                  actions.onToggleStatus(user.id, user.status);
                }}
              >
                <Shield className="mr-2 h-4 w-4" />
                Reactivar acceso
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-warning focus:text-warning"
                onClick={() => {
                  actions.onToggleStatus(user.id, user.status);
                }}
              >
                <Lock className="mr-2 h-4 w-4" />
                Suspender acceso
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-error focus:text-error"
              onClick={() => {
                actions.onDeleteUser(user.id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar usuario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    id: "actions",
    size: 50,
  },
];
