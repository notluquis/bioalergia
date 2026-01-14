import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";

import type { LeaderboardDisplayRow, ParticipantCounterpartRow, ParticipantMonthlyRow } from "../types";

// --- Leaderboard Columns ---

export interface LeaderboardMeta {
  participantId: string;
  onSelect: (key: string) => void;
  detailLoading: boolean;
}

export const getLeaderboardColumns = (): ColumnDef<LeaderboardDisplayRow>[] => [
  {
    accessorKey: "displayName",
    header: "Titular",
    cell: ({ row }) => <div className="font-medium">{row.getValue("displayName")}</div>,
  },
  {
    accessorKey: "rut",
    header: "RUT",
  },
  {
    accessorKey: "account",
    header: "Cuenta",
  },
  {
    accessorKey: "outgoingCount",
    header: "Egresos (#)",
  },
  {
    accessorKey: "outgoingAmount",
    header: "Egresos ($)",
    cell: ({ row }) => fmtCLP(row.getValue("outgoingAmount")),
  },
  {
    id: "action",
    header: "Acción",
    cell: ({ row, table }) => {
      const meta = table.options.meta as LeaderboardMeta;
      const participantKey = row.original.selectKey;
      const isActive = participantKey && participantKey === meta.participantId?.trim();

      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => participantKey && meta.onSelect(participantKey)}
          disabled={meta.detailLoading || !participantKey}
          className="h-8"
        >
          {meta.detailLoading && isActive ? "Cargando..." : "Ver detalle"}
        </Button>
      );
    },
  },
];

// --- Monthly Columns ---

export const getMonthlyColumns = (): ColumnDef<ParticipantMonthlyRow>[] => [
  {
    accessorKey: "month",
    header: "Mes",
    cell: ({ getValue }) => (
      <div className="font-medium capitalize">{dayjs(getValue<string>()).format("MMMM YYYY")}</div>
    ),
  },
  {
    accessorKey: "outgoingCount",
    header: "Cant.",
  },
  {
    accessorKey: "outgoingAmount",
    header: "Monto",
    cell: ({ row }) => fmtCLP(row.getValue("outgoingAmount")),
  },
];

// --- Counterparts Columns ---

export const getCounterpartsColumns = (): ColumnDef<ParticipantCounterpartRow>[] => [
  {
    id: "holder",
    header: "Titular",
    cell: ({ row }) => {
      const { bankAccountHolder, counterpart, identificationNumber } = row.original;
      const formattedRut = identificationNumber ? formatRut(String(identificationNumber)) : "";

      return (
        <div>
          <div className="text-sm font-medium">{bankAccountHolder || counterpart || "(desconocido)"}</div>
          <div className="text-base-content/60 mt-0.5 text-xs">{formattedRut || "-"}</div>
        </div>
      );
    },
  },
  {
    id: "info",
    header: "Info",
    cell: ({ row }) => {
      const {
        bankName,
        bankAccountNumber,
        bankAccountType,
        bankBranch,
        withdrawId,
        identificationType,
        identificationNumber,
      } = row.original;

      // Format bank info
      const bankParts: string[] = [];
      if (bankName) bankParts.push(bankName);
      if (bankAccountNumber) {
        const accountLabel = bankAccountType ? `${bankAccountType} · ${bankAccountNumber}` : bankAccountNumber;
        bankParts.push(accountLabel);
      }
      if (bankBranch) bankParts.push(bankBranch);
      const bankSummary = bankParts.join(" · ");

      // Format metadata
      const metadataParts: string[] = [];
      if (withdrawId) metadataParts.push(withdrawId);
      if (identificationType && identificationNumber) {
        metadataParts.push(`${identificationType} ${identificationNumber}`);
      } else if (identificationNumber) {
        metadataParts.push(String(identificationNumber));
      }

      const metadata = metadataParts.join(" · ");

      return (
        <div>
          {bankSummary && <div className="text-xs">{bankSummary}</div>}
          {metadata && <div className="text-xs opacity-70">{metadata}</div>}
        </div>
      );
    },
  },
  {
    id: "amount",
    header: "Monto",
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <div className="text-sm font-medium">{fmtCLP(row.original.outgoingAmount)}</div>
        <div className="text-base-content/60 text-xs">{row.original.outgoingCount} txs</div>
      </div>
    ),
  },
];
