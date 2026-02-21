import { Avatar, Chip, Dropdown, Separator, Tooltip } from "@heroui/react";
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
import { Button } from "@/components/ui/Button";
import type { User } from "@/features/users/types";
import { getPersonFullName, getPersonInitials } from "@/lib/person";

// Helper for status colors
const getStatusColor = (s: string): "success" | "warning" | "danger" | "default" => {
  switch (s) {
    case "ACTIVE": {
      return "success";
    }
    case "PENDING_SETUP": {
      return "warning";
    }
    case "SUSPENDED": {
      return "danger";
    }
    default: {
      return "default";
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
          <Avatar className="h-10 w-10">
            <Avatar.Fallback className="font-bold text-xs">
              {getPersonInitials(user.person)}
            </Avatar.Fallback>
          </Avatar>
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
      <Chip className="whitespace-nowrap font-medium" size="sm" variant="soft">
        {row.original.role}
      </Chip>
    ),

    header: "Rol",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Chip
          className="w-fit gap-2 whitespace-nowrap"
          color={getStatusColor(status)}
          size="sm"
          variant={status === "ACTIVE" ? "secondary" : "soft"}
        >
          {status === "ACTIVE" && <div className="size-1.5 rounded-full bg-current" />}
          {status}
        </Chip>
      );
    },
    header: "Estado",
  },
  {
    accessorKey: "mfaEnabled",
    cell: ({ row }) => (
      <div className="flex justify-center">
        {row.original.mfaEnabled ? (
          <Tooltip>
            <Tooltip.Trigger>
              <div>
                <ShieldCheck className="size-5 text-success" />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content>MFA activado</Tooltip.Content>
          </Tooltip>
        ) : (
          <Tooltip>
            <Tooltip.Trigger>
              <div>
                <ShieldCheck className="size-5 text-default-100" />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content>MFA inactivo</Tooltip.Content>
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
          <Tooltip>
            <Tooltip.Trigger>
              <div>
                <Fingerprint className="size-5 text-success" />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content>Passkey configurado</Tooltip.Content>
          </Tooltip>
        ) : (
          <Tooltip>
            <Tooltip.Trigger>
              <div>
                <Fingerprint className="size-5 text-default-100" />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content>Sin passkey</Tooltip.Content>
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
      <span className="text-default-600 text-sm">
        {dayjs(row.original.createdAt).format("DD MMM YYYY")}
      </span>
    ),

    header: "Creado",
  },
  {
    cell: ({ row }) => {
      const user = row.original;
      return (
        <Dropdown>
          <Dropdown.Trigger>
            <Button isIconOnly size="sm" variant="ghost">
              <MoreVertical size={16} />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label="Acciones de usuario" className="w-56">
              <Dropdown.Item
                onPress={() => {
                  actions.onEditRole(user);
                }}
              >
                <UserCog className="mr-2 h-4 w-4" />
                Editar rol
              </Dropdown.Item>
              <Dropdown.Item
                onPress={() => {
                  actions.onToggleMfa(user.id, user.mfaEnabled);
                }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {user.mfaEnabled ? "Desactivar" : "Activar"} MFA
              </Dropdown.Item>
              <Dropdown.Item
                onPress={() => {
                  actions.onResetPassword(user.id);
                }}
              >
                <Key className="mr-2 h-4 w-4" />
                Restablecer contraseña
              </Dropdown.Item>
              {user.hasPasskey && (
                <Dropdown.Item
                  className="text-warning focus:text-warning"
                  onPress={() => {
                    actions.onDeletePasskey(user.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar passkey
                </Dropdown.Item>
              )}
              {user.status === "SUSPENDED" ? (
                <Dropdown.Item
                  className="text-success focus:text-success"
                  onPress={() => {
                    actions.onToggleStatus(user.id, user.status);
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Reactivar acceso
                </Dropdown.Item>
              ) : (
                <Dropdown.Item
                  className="text-warning focus:text-warning"
                  onPress={() => {
                    actions.onToggleStatus(user.id, user.status);
                  }}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Suspender acceso
                </Dropdown.Item>
              )}
              <Separator />
              <Dropdown.Item
                className="text-danger focus:text-danger"
                onPress={() => {
                  actions.onDeleteUser(user.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar usuario
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      );
    },
    id: "actions",
    size: 50,
  },
];
