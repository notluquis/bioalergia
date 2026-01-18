import { createColumnHelper } from "@tanstack/react-table";

import type { User } from "@/features/users/types";

import Button from "@/components/ui/Button";
import { BADGE_SM } from "@/lib/styles";

import { MfaStatusCell, PasskeyStatusCell, SecurityCell, UserCell } from "./UserAccessCells";

// --- Columns ---

const columnHelper = createColumnHelper<User>();

export const getUserAccessColumns = (onToggleMfa: (userId: number, enabled: boolean) => void, isPending: boolean) => [
  columnHelper.accessor("email", {
    cell: ({ getValue }) => <UserCell email={getValue()} />,
    header: "Usuario",
  }),
  columnHelper.accessor("role", {
    cell: ({ getValue }) => <span className={`${BADGE_SM} badge-ghost`}>{getValue()}</span>,
    header: "Rol",
  }),
  columnHelper.display({
    cell: ({ row }) => <SecurityCell user={row.original} />,
    header: () => <div className="text-center">Seguridad</div>,
    id: "security",
  }),
  columnHelper.accessor("mfaEnabled", {
    cell: ({ getValue }) => <MfaStatusCell active={getValue()} />,
    header: () => <div className="text-center">MFA</div>,
  }),
  columnHelper.accessor("hasPasskey", {
    cell: ({ getValue }) => <PasskeyStatusCell hasPasskey={getValue()} />,
    header: () => <div className="text-center">Passkey</div>,
  }),
  columnHelper.display({
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          disabled={isPending}
          onClick={() => {
            onToggleMfa(row.original.id, !row.original.mfaEnabled);
          }}
          size="sm"
          variant={row.original.mfaEnabled ? "ghost" : "primary"}
        >
          {row.original.mfaEnabled ? "Desactivar MFA" : "Activar MFA"}
        </Button>
      </div>
    ),
    header: () => <div className="text-right">Acciones</div>,
    id: "actions",
  }),
];
