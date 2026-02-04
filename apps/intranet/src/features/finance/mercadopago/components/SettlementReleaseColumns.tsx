import type { SettlementReleaseTransaction } from "@finanzas/db/models";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { fmtCLP } from "@/lib/format";

const amountFields = new Set<string>([
  "settlementTransactionAmount",
  "settlementFeeAmount",
  "settlementSettlementNetAmount",
  "settlementRealAmount",
  "settlementFinancingFeeAmount",
  "releaseNetDebitAmount",
  "releaseGrossAmount",
  "releaseBalanceAmount",
]);

const dateFields = new Set<string>(["effectiveDate"]);

const headerOverrides: Record<string, string> = {
  effectiveDate: "Fecha",
  origin: "Origen",
  sourceId: "ID",
  settlementExternalReference: "Settlement External Reference",
  settlementPaymentMethodType: "Settlement Payment Method Type",
  settlementPaymentMethod: "Settlement Payment Method",
  settlementTransactionType: "Tipo (Conc.)",
  settlementTransactionAmount: "Monto Transaccion (Conc.)",
  settlementFeeAmount: "Settlement Fee Amount",
  settlementSettlementNetAmount: "Monto Neto (Conc.)",
  settlementRealAmount: "Monto Real (Conc.)",
  settlementFinancingFeeAmount: "Settlement Financing Fee Amount",
  settlementInstallments: "Settlement Installments",
  settlementBusinessUnit: "Settlement Business Unit",
  settlementSubUnit: "Settlement Sub Unit",
  settlementPayBankTransferId: "Settlement Pay Bank Transfer ID",
  settlementMetadata: "Settlement Metadata",
  releaseExternalReference: "Release External Reference",
  releaseDescription: "Release Description",
  releaseNetDebitAmount: "Debito Neto (Lib.)",
  releaseGrossAmount: "Monto Bruto (Lib.)",
  releaseBalanceAmount: "Release Balance Amount",
  releasePayoutBankAccountNumber: "Release Payout Bank Account Number",
  releaseBusinessUnit: "Release Business Unit",
  releaseIssuerName: "Release Issuer Name",
  releaseMetadata: "Release Metadata",
};

const originLabels: Record<string, string> = {
  both: "Ambas",
  release: "Liberacion",
  settlement: "Conciliacion",
};

const CAMEL_CASE_REGEX = /([a-z])([A-Z])/g;
const UNDERSCORE_REGEX = /_/g;
const LEADING_CHAR_REGEX = /^./;

const toLabel = (field: string) =>
  field
    .replace(CAMEL_CASE_REGEX, "$1 $2")
    .replace(UNDERSCORE_REGEX, " ")
    .replace(LEADING_CHAR_REGEX, (match) => match.toUpperCase());

const formatDate = (value: unknown) => {
  if (!value) return "";
  const parsed = dayjs(value as string | Date);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : String(value);
};

const formatAmount = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (Number.isNaN(numeric)) return String(value);
  return fmtCLP(numeric);
};

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const isEmptyJsonObject = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return value.every((item) => isEmptyJsonObject(item));
  }
  return Object.keys(value).length === 0;
};

function MetadataCell({ value, title }: Readonly<{ value: unknown; title: string }>) {
  const [open, setOpen] = useState(false);
  if (isEmptyJsonObject(value)) return "";
  const formatted = formatJson(value);

  if (!formatted) return "";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="px-2"
        onClick={() => setOpen(true)}
      >
        Ver
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title}>
        <pre className="whitespace-pre-wrap wrap-break-word text-xs text-foreground">
          {formatted}
        </pre>
      </Modal>
    </>
  );
}

const allFields: Array<keyof SettlementReleaseTransaction> = [
  "sourceId",
  "origin",
  "effectiveDate",
  "settlementExternalReference",
  "settlementPaymentMethodType",
  "settlementPaymentMethod",
  "settlementTransactionType",
  "settlementTransactionAmount",
  "settlementFeeAmount",
  "settlementSettlementNetAmount",
  "settlementRealAmount",
  "settlementFinancingFeeAmount",
  "settlementInstallments",
  "settlementBusinessUnit",
  "settlementSubUnit",
  "settlementPayBankTransferId",
  "settlementMetadata",
  "releaseExternalReference",
  "releaseDescription",
  "releaseNetDebitAmount",
  "releaseGrossAmount",
  "releaseBalanceAmount",
  "releasePayoutBankAccountNumber",
  "releaseBusinessUnit",
  "releaseIssuerName",
  "releaseMetadata",
];

export const getSettlementReleaseColumns = (): ColumnDef<SettlementReleaseTransaction>[] =>
  allFields.map((field) => {
    const fieldKey = String(field);
    if (field === "origin") {
      return {
        accessorKey: fieldKey,
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return originLabels[value] ?? value ?? "";
        },
        header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
      };
    }

    if (fieldKey === "settlementMetadata") {
      return {
        accessorKey: fieldKey,
        cell: ({ getValue }) => (
          <MetadataCell title="Settlement Metadata" value={getValue<unknown>()} />
        ),
        header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
      };
    }

    if (fieldKey === "releaseMetadata") {
      return {
        accessorKey: fieldKey,
        cell: ({ getValue }) => (
          <MetadataCell title="Release Metadata" value={getValue<unknown>()} />
        ),
        header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
      };
    }

    if (dateFields.has(fieldKey)) {
      return {
        accessorKey: fieldKey,
        cell: ({ getValue }) => (
          <span className="text-foreground font-medium">{formatDate(getValue())}</span>
        ),
        header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
      };
    }

    if (amountFields.has(fieldKey)) {
      return {
        accessorKey: fieldKey,
        cell: ({ getValue }) => formatAmount(getValue()),
        header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
      };
    }

    return {
      accessorKey: fieldKey,
      header: headerOverrides[fieldKey] ?? toLabel(fieldKey),
    };
  });
