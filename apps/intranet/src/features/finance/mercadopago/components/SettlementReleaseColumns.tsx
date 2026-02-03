import type { SettlementReleaseTransaction } from "@finanzas/db/models";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

const amountFields = new Set<string>([
  "settlementTransactionAmount",
  "settlementSellerAmount",
  "settlementFeeAmount",
  "settlementSettlementNetAmount",
  "settlementRealAmount",
  "settlementCouponAmount",
  "settlementMkpFeeAmount",
  "settlementFinancingFeeAmount",
  "settlementShippingFeeAmount",
  "settlementTaxesAmount",
  "settlementTipAmount",
  "settlementTotalCouponAmount",
  "releaseNetCreditAmount",
  "releaseNetDebitAmount",
  "releaseGrossAmount",
  "releaseSellerAmount",
  "releaseMpFeeAmount",
  "releaseFinancingFeeAmount",
  "releaseShippingFeeAmount",
  "releaseTaxesAmount",
  "releaseCouponAmount",
  "releaseEffectiveCouponAmount",
  "releaseBalanceAmount",
  "releaseTaxAmountTelco",
]);

const dateFields = new Set<string>([
  "effectiveDate",
  "settlementTransactionDate",
  "settlementSettlementDate",
  "settlementMoneyReleaseDate",
  "settlementCreatedAt",
  "settlementUpdatedAt",
  "releaseDate",
  "releaseTransactionApprovalDate",
  "releaseCreatedAt",
  "releaseUpdatedAt",
]);

const headerOverrides: Record<string, string> = {
  effectiveDate: "Fecha",
  origin: "Origen",
  sourceId: "ID Origen",
  settlementTransactionType: "Tipo (Conc.)",
  settlementTransactionAmount: "Monto Transaccion (Conc.)",
  settlementSettlementNetAmount: "Monto Neto (Conc.)",
  settlementRealAmount: "Monto Real (Conc.)",
  releaseGrossAmount: "Monto Bruto (Lib.)",
  releaseNetCreditAmount: "Credito Neto (Lib.)",
  releaseNetDebitAmount: "Debito Neto (Lib.)",
  releaseMpFeeAmount: "Comision MP (Lib.)",
  releaseFinancingFeeAmount: "Comision Financiera (Lib.)",
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

const allFields: Array<keyof SettlementReleaseTransaction> = [
  "id",
  "sourceId",
  "origin",
  "effectiveDate",
  "settlementId",
  "settlementSourceId",
  "settlementTransactionDate",
  "settlementSettlementDate",
  "settlementMoneyReleaseDate",
  "settlementExternalReference",
  "settlementUserId",
  "settlementPaymentMethodType",
  "settlementPaymentMethod",
  "settlementSite",
  "settlementTransactionType",
  "settlementTransactionAmount",
  "settlementTransactionCurrency",
  "settlementSellerAmount",
  "settlementFeeAmount",
  "settlementSettlementNetAmount",
  "settlementSettlementCurrency",
  "settlementRealAmount",
  "settlementCouponAmount",
  "settlementMetadata",
  "settlementMkpFeeAmount",
  "settlementFinancingFeeAmount",
  "settlementShippingFeeAmount",
  "settlementTaxesAmount",
  "settlementInstallments",
  "settlementTaxDetail",
  "settlementTaxesDisaggregated",
  "settlementDescription",
  "settlementCardInitialNumber",
  "settlementOperationTags",
  "settlementBusinessUnit",
  "settlementSubUnit",
  "settlementProductSku",
  "settlementSaleDetail",
  "settlementTransactionIntentId",
  "settlementFranchise",
  "settlementIssuerName",
  "settlementLastFourDigits",
  "settlementOrderMp",
  "settlementInvoicingPeriod",
  "settlementPayBankTransferId",
  "settlementIsReleased",
  "settlementTipAmount",
  "settlementPurchaseId",
  "settlementTotalCouponAmount",
  "settlementPosId",
  "settlementPosName",
  "settlementExternalPosId",
  "settlementStoreId",
  "settlementStoreName",
  "settlementExternalStoreId",
  "settlementPoiId",
  "settlementOrderId",
  "settlementShippingId",
  "settlementShipmentMode",
  "settlementPackId",
  "settlementShippingOrderId",
  "settlementPoiWalletName",
  "settlementPoiBankName",
  "settlementCreatedAt",
  "settlementUpdatedAt",
  "releaseId",
  "releaseSourceId",
  "releaseDate",
  "releaseExternalReference",
  "releaseRecordType",
  "releaseDescription",
  "releaseNetCreditAmount",
  "releaseNetDebitAmount",
  "releaseGrossAmount",
  "releaseSellerAmount",
  "releaseMpFeeAmount",
  "releaseFinancingFeeAmount",
  "releaseShippingFeeAmount",
  "releaseTaxesAmount",
  "releaseCouponAmount",
  "releaseEffectiveCouponAmount",
  "releaseBalanceAmount",
  "releaseTaxAmountTelco",
  "releaseInstallments",
  "releasePaymentMethod",
  "releasePaymentMethodType",
  "releaseTaxDetail",
  "releaseTaxesDisaggregated",
  "releaseTransactionApprovalDate",
  "releaseTransactionIntentId",
  "releasePosId",
  "releasePosName",
  "releaseExternalPosId",
  "releaseStoreId",
  "releaseStoreName",
  "releaseExternalStoreId",
  "releaseCurrency",
  "releaseShippingId",
  "releaseShipmentMode",
  "releaseShippingOrderId",
  "releaseOrderId",
  "releasePackId",
  "releasePoiId",
  "releaseItemId",
  "releaseMetadata",
  "releaseCardInitialNumber",
  "releaseOperationTags",
  "releaseLastFourDigits",
  "releaseFranchise",
  "releaseIssuerName",
  "releasePoiBankName",
  "releasePoiWalletName",
  "releaseBusinessUnit",
  "releaseSubUnit",
  "releasePayoutBankAccountNumber",
  "releaseProductSku",
  "releaseSaleDetail",
  "releaseOrderMp",
  "releasePurchaseId",
  "releaseCreatedAt",
  "releaseUpdatedAt",
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
