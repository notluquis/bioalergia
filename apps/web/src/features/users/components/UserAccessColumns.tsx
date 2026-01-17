import { createColumnHelper } from "@tanstack/react-table";
import { Key, Lock, Shield, ShieldCheck } from "lucide-react";

import Button from "@/components/ui/Button";
import type { User } from "@/features/users/types";
import { BADGE_SM } from "@/lib/styles";

// --- Helpers ---

const getSecurityScore = (user: User) => {
  let score = 0;
  if (user.mfaEnabled) score += 50;
  if (user.hasPasskey) score += 50;
  return score;
};

const getSecurityBadge = (score: number) => {
  if (score === 100) return { label: "Óptima", color: "badge-success", icon: Shield };
  if (score >= 50) return { label: "Buena", color: "badge-warning", icon: ShieldCheck };
  return { label: "Básica", color: "badge-error", icon: Lock };
};

// --- Cell Components ---

const UserCell = ({ email }: { email: string | null }) => {
  const safeEmail = email || "";
  const initials = safeEmail.split("@")[0]?.slice(0, 2)?.toUpperCase() || "??";

  return (
    <div className="flex items-center gap-3">
      <div className="avatar placeholder">
        <div className="bg-neutral text-neutral-content flex h-10 w-10 items-center justify-center rounded-full">
          <span className="text-xs">{initials}</span>
        </div>
      </div>
      <div>
        <div className="font-medium">{safeEmail}</div>
      </div>
    </div>
  );
};

const SecurityCell = ({ user }: { user: User }) => {
  const score = getSecurityScore(user);
  const badge = getSecurityBadge(score);
  const BadgeIcon = badge.icon;
  return (
    <div className="flex items-center justify-center gap-2">
      <span className={`${BADGE_SM} ${badge.color} gap-1`}>
        <BadgeIcon className="size-3" />
        {badge.label}
      </span>
      <span className="text-base-content/50 text-xs">{score}%</span>
    </div>
  );
};

const MfaStatusCell = ({ active }: { active: boolean }) => {
  if (active) {
    return (
      <div className="flex items-center justify-center gap-1">
        <ShieldCheck className="text-success size-4" />
        <span className="text-success text-xs font-medium">Activo</span>
      </div>
    );
  }
  return <span className="text-base-content/30 flex justify-center text-xs">Inactivo</span>;
};

const PasskeyStatusCell = ({ hasPasskey }: { hasPasskey: boolean }) => {
  if (hasPasskey) {
    return (
      <div className="flex items-center justify-center gap-1">
        <Key className="text-info size-4" />
        <span className="text-info text-xs font-medium">Sí</span>
      </div>
    );
  }
  return <span className="text-base-content/30 flex justify-center text-xs">No</span>;
};

// --- Columns ---

const columnHelper = createColumnHelper<User>();

export const getUserAccessColumns = (onToggleMfa: (userId: number, enabled: boolean) => void, isPending: boolean) => [
  columnHelper.accessor("email", {
    header: "Usuario",
    cell: ({ getValue }) => <UserCell email={getValue()} />,
  }),
  columnHelper.accessor("role", {
    header: "Rol",
    cell: ({ getValue }) => <span className={`${BADGE_SM} badge-ghost`}>{getValue()}</span>,
  }),
  columnHelper.display({
    id: "security",
    header: () => <div className="text-center">Seguridad</div>,
    cell: ({ row }) => <SecurityCell user={row.original} />,
  }),
  columnHelper.accessor("mfaEnabled", {
    header: () => <div className="text-center">MFA</div>,
    cell: ({ getValue }) => <MfaStatusCell active={getValue()} />,
  }),
  columnHelper.accessor("hasPasskey", {
    header: () => <div className="text-center">Passkey</div>,
    cell: ({ getValue }) => <PasskeyStatusCell hasPasskey={getValue()} />,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <div className="text-right">Acciones</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          size="sm"
          variant={row.original.mfaEnabled ? "ghost" : "primary"}
          onClick={() => onToggleMfa(row.original.id, !row.original.mfaEnabled)}
          disabled={isPending}
        >
          {row.original.mfaEnabled ? "Desactivar MFA" : "Activar MFA"}
        </Button>
      </div>
    ),
  }),
];
