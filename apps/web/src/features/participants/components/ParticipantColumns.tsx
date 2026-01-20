import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";

import type {
  LeaderboardDisplayRow,
  ParticipantCounterpartRow,
  ParticipantMonthlyRow,
} from "../types";

// --- Leaderboard Columns ---

export interface LeaderboardMeta {
  detailLoading: boolean;
  onSelect: (key: string) => void;
  participantId: string;
}

export const getLeaderboardColumns = (): ColumnDef<LeaderboardDisplayRow>[] => [
  {
    accessorKey: "displayName",
    cell: ({ row }) => <div className="font-medium">{row.getValue("displayName")}</div>,
    header: "Titular",
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
    cell: ({ row }) => fmtCLP(row.getValue("outgoingAmount")),
    header: "Egresos ($)",
  },
  {
    cell: ({ row, table }) => {
      const meta = table.options.meta as LeaderboardMeta;
      const participantKey = row.original.selectKey;
      const isActive = participantKey && participantKey === meta.participantId?.trim();

      return (
        <Button
          className="h-8"
          disabled={meta.detailLoading || !participantKey}
          onClick={() => participantKey && meta.onSelect(participantKey)}
          size="sm"
          variant="ghost"
        >
          {meta.detailLoading && isActive ? "Cargando..." : "Ver detalle"}
        </Button>
      );
    },
    header: "Acción",
    id: "action",
  },
];

// --- Monthly Columns ---

export const getMonthlyColumns = (): ColumnDef<ParticipantMonthlyRow>[] => [
  {
    accessorKey: "month",
    cell: ({ getValue }) => (
      <div className="font-medium capitalize">{dayjs(getValue<string>()).format("MMMM YYYY")}</div>
    ),
    header: "Mes",
  },
  {
    accessorKey: "outgoingCount",
    header: "Cant.",
  },
  {
    accessorKey: "outgoingAmount",
    cell: ({ row }) => fmtCLP(row.getValue("outgoingAmount")),
    header: "Monto",
  },
];

// --- Counterparts Columns ---

export const getCounterpartsColumns = (): ColumnDef<ParticipantCounterpartRow>[] => [
  {
    cell: ({ row }) => {
      const { bankAccountHolder, counterpart, identificationNumber } = row.original;
      const formattedRut = identificationNumber ? formatRut(String(identificationNumber)) : "";

      return (
        <div>
          <div className="text-sm font-medium">
            {bankAccountHolder || counterpart || "(desconocido)"}
          </div>
          <div className="text-base-content/60 mt-0.5 text-xs">{formattedRut || "-"}</div>
        </div>
      );
    },
    header: "Titular",
    id: "holder",
  },
  {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy function
    cell: ({ row }) => {
      const {
        bankAccountNumber,
        bankAccountType,
        bankBranch,
        bankName,
        identificationNumber,
        identificationType,
        withdrawId,
      } = row.original;

      // Format bank info
      const bankParts: string[] = [];
      if (bankName) bankParts.push(bankName);
      if (bankAccountNumber) {
        const accountLabel = bankAccountType
          ? `${bankAccountType} · ${bankAccountNumber}`
          : bankAccountNumber;
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
    header: "Info",
    id: "info",
  },
  {
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <div className="text-sm font-medium">{fmtCLP(row.original.outgoingAmount)}</div>
        <div className="text-base-content/60 text-xs">{row.original.outgoingCount} txs</div>
      </div>
    ),
    header: "Monto",
    id: "amount",
  },
];
