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
  "withdrawAmount",
  "withdrawFee",
]);

const dateFields = new Set<string>(["effectiveDate", "withdrawDateCreated"]);

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
  withdrawId: "Withdraw ID",
  withdrawDateCreated: "Withdraw Fecha Creacion",
  withdrawStatus: "Withdraw Estado",
  withdrawStatusDetail: "Withdraw Detalle Estado",
  withdrawAmount: "Withdraw Monto",
  withdrawFee: "Withdraw Tarifa",
  withdrawActivityUrl: "Withdraw Activity URL",
  withdrawPayoutDesc: "Withdraw Motivo",
  withdrawBankAccountHolder: "Withdraw Titular",
  withdrawIdentificationType: "Withdraw Tipo Identificacion",
  withdrawIdentificationNumber: "Withdraw Numero Identificacion",
  withdrawBankId: "Withdraw Banco ID",
  withdrawBankName: "Withdraw Banco",
  withdrawBankBranch: "Withdraw Sucursal",
  withdrawBankAccountType: "Withdraw Tipo Cuenta",
  withdrawBankAccountNumber: "Withdraw Numero Cuenta",
};

const originLabels: Record<string, string> = {
  all: "Todas",
  both: "Ambas",
  release: "Liberacion",
  release_withdraw: "Liberacion + Retiro",
  settlement: "Conciliacion",
  settlement_withdraw: "Conciliacion + Retiro",
  withdraw: "Retiro",
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

const isEmptyJsonObject = (value: unknown): boolean => {
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
  "withdrawId",
  "withdrawDateCreated",
  "withdrawStatus",
  "withdrawStatusDetail",
  "withdrawAmount",
  "withdrawFee",
  "withdrawActivityUrl",
  "withdrawPayoutDesc",
  "withdrawBankAccountHolder",
  "withdrawIdentificationType",
  "withdrawIdentificationNumber",
  "withdrawBankId",
  "withdrawBankName",
  "withdrawBankBranch",
  "withdrawBankAccountType",
  "withdrawBankAccountNumber",
];

const getHeader = (fieldKey: string) => headerOverrides[fieldKey] ?? toLabel(fieldKey);

const buildOriginColumn = (): ColumnDef<SettlementReleaseTransaction> => ({
  accessorKey: "origin",
  cell: ({ getValue }) => {
    const value = getValue<string>();
    return originLabels[value] ?? value ?? "";
  },
  header: getHeader("origin"),
});

const buildMetadataColumn = (
  fieldKey: "settlementMetadata" | "releaseMetadata",
  title: string,
): ColumnDef<SettlementReleaseTransaction> => ({
  accessorKey: fieldKey,
  cell: ({ getValue }) => <MetadataCell title={title} value={getValue<unknown>()} />,
  header: getHeader(fieldKey),
});

const buildStandardColumn = (
  fieldKey: keyof SettlementReleaseTransaction,
): ColumnDef<SettlementReleaseTransaction> => {
  const key = String(fieldKey);

  if (dateFields.has(key)) {
    return {
      accessorKey: key,
      cell: ({ getValue }) => (
        <span className="text-foreground font-medium">{formatDate(getValue())}</span>
      ),
      header: getHeader(key),
    };
  }

  if (amountFields.has(key)) {
    return {
      accessorKey: key,
      cell: ({ getValue }) => formatAmount(getValue()),
      header: getHeader(key),
    };
  }

  return {
    accessorKey: key,
    header: getHeader(key),
  };
};

const columnBuilders: Partial<
  Record<keyof SettlementReleaseTransaction, () => ColumnDef<SettlementReleaseTransaction>>
> = {
  origin: buildOriginColumn,
  settlementMetadata: () => buildMetadataColumn("settlementMetadata", "Settlement Metadata"),
  releaseMetadata: () => buildMetadataColumn("releaseMetadata", "Release Metadata"),
};

export const getSettlementReleaseColumns = (): ColumnDef<SettlementReleaseTransaction>[] =>
  allFields.map((field) => {
    const custom = columnBuilders[field];
    return custom ? custom() : buildStandardColumn(field);
  });
