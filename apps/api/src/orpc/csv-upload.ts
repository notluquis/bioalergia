import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { csvUploadContract, type csvUploadModeSchema } from "@finanzas/orpc-contracts/csv-upload";
import type { Context as HonoContext } from "hono";

import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type CsvUploadORPCContext = {
  hono: HonoContext;
};

type CsvUploadMode = typeof csvUploadModeSchema._output;
type CsvUploadRow = Record<string, number | string>;
type WithdrawImportRow = {
  activityUrl: null | string;
  amount: null | number;
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankBranch: null | string;
  bankId: null | string;
  bankName: null | string;
  dateCreated: Date;
  fee: null | number;
  identificationNumber: null | string;
  identificationType: null | string;
  payoutDescription: null | string;
  rowIndex: number;
  status: null | string;
  statusDetail: null | string;
  withdrawId: string;
};

type PreviewLikeResponse = {
  errors?: string[];
  insertRowIndexes?: number[];
  status: "ok";
  toInsert: number;
  toSkip: number;
  toUpdate: number;
  updateRows?: Array<{
    key: string;
    rowIndex: number;
    summary: string;
  }>;
};

const base = os.$context<CsvUploadORPCContext>();
const UPSERT_CHUNK_SIZE = Number(process.env.BIOALERGIA_UPSERT_CHUNK_SIZE || 250);

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const canReadCsvUpload = authed.use(async ({ context, next }) => {
  const canReadSettings = await hasPermission(context.user.id, "read", "Setting");
  if (!canReadSettings) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const canWriteWithdrawals = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "WithdrawTransaction");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

function normalizeNullableString(value: unknown): null | string {
  if (value == null) {
    return null;
  }
  const stringValue =
    typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  return stringValue.length > 0 ? stringValue : null;
}

function normalizeRequiredString(value: unknown): string {
  return normalizeNullableString(value) ?? "";
}

function normalizeNumber(value: unknown): null | number {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replaceAll(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const stringValue = normalizeNullableString(value);
  if (!stringValue) {
    return null;
  }

  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summarizeWithdrawalRow(row: WithdrawImportRow): string {
  const amountLabel = row.amount == null ? "-" : row.amount.toLocaleString("es-CL");
  const holder = row.bankAccountHolder ?? row.identificationNumber ?? "Sin titular";
  return `${row.withdrawId} · ${holder} · $${amountLabel}`;
}

function parseWithdrawalRows(rows: CsvUploadRow[]): {
  errors: string[];
  validRows: WithdrawImportRow[];
} {
  const errors: string[] = [];
  const validRows: WithdrawImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const withdrawId = normalizeRequiredString(row.withdrawId);
    const dateCreated = normalizeDate(row.dateCreated);

    if (!withdrawId) {
      errors.push(`Fila ${rowNumber}: withdrawId es obligatorio.`);
      return;
    }

    if (!dateCreated) {
      errors.push(`Fila ${rowNumber}: dateCreated es obligatorio y debe ser una fecha válida.`);
      return;
    }

    validRows.push({
      activityUrl: normalizeNullableString(row.activityUrl),
      amount: normalizeNumber(row.amount),
      bankAccountHolder: normalizeNullableString(row.bankAccountHolder),
      bankAccountNumber: normalizeNullableString(row.bankAccountNumber),
      bankAccountType: normalizeNullableString(row.bankAccountType),
      bankBranch: normalizeNullableString(row.bankBranch),
      bankId: normalizeNullableString(row.bankId),
      bankName: normalizeNullableString(row.bankName),
      dateCreated,
      fee: normalizeNumber(row.fee),
      identificationNumber: normalizeNullableString(row.identificationNumber),
      identificationType: normalizeNullableString(row.identificationType),
      payoutDescription: normalizeNullableString(row.payoutDescription),
      rowIndex: index,
      status: normalizeNullableString(row.status),
      statusDetail: normalizeNullableString(row.statusDetail),
      withdrawId,
    });
  });

  return { errors, validRows };
}

async function classifyWithdrawalRows(validRows: WithdrawImportRow[]) {
  const withdrawIds = [...new Set(validRows.map((row) => row.withdrawId))];
  if (withdrawIds.length === 0) {
    return {
      existingIds: new Set<string>(),
      insertRows: [] as WithdrawImportRow[],
      updateRows: [] as WithdrawImportRow[],
    };
  }

  const existing = await db.withdrawTransaction.findMany({
    where: { withdrawId: { in: withdrawIds } },
    select: { withdrawId: true },
  });

  const existingIds = new Set(existing.map((row) => row.withdrawId));
  const insertRows = validRows.filter((row) => !existingIds.has(row.withdrawId));
  const updateRows = validRows.filter((row) => existingIds.has(row.withdrawId));

  return { existingIds, insertRows, updateRows };
}

function buildWithdrawalPreview(params: {
  errors: string[];
  includeInsertRowIndexes?: boolean;
  includeUpdateRows?: boolean;
  insertRows: WithdrawImportRow[];
  mode: CsvUploadMode;
  updateRows: WithdrawImportRow[];
}): PreviewLikeResponse {
  const { errors, includeInsertRowIndexes, includeUpdateRows, insertRows, mode, updateRows } = params;

  return {
    errors: errors.length > 0 ? errors : undefined,
    insertRowIndexes: includeInsertRowIndexes ? insertRows.map((row) => row.rowIndex) : undefined,
    status: "ok",
    toInsert: insertRows.length,
    toSkip:
      mode === "insert-only"
        ? errors.length
        : mode === "update-only"
          ? errors.length
          : errors.length,
    toUpdate: updateRows.length,
    updateRows: includeUpdateRows
      ? updateRows.map((row) => ({
          key: row.withdrawId,
          rowIndex: row.rowIndex,
          summary: summarizeWithdrawalRow(row),
        }))
      : undefined,
  };
}

async function createWithdrawalRows(rows: WithdrawImportRow[]) {
  if (rows.length === 0) {
    return 0;
  }

  const result = await db.withdrawTransaction.createMany({
    data: rows.map((row) => ({
      activityUrl: row.activityUrl,
      amount: row.amount,
      bankAccountHolder: row.bankAccountHolder,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountType: row.bankAccountType,
      bankBranch: row.bankBranch,
      bankId: row.bankId,
      bankName: row.bankName,
      dateCreated: row.dateCreated,
      fee: row.fee,
      identificationNumber: row.identificationNumber,
      identificationType: row.identificationType,
      payoutDescription: row.payoutDescription,
      status: row.status,
      statusDetail: row.statusDetail,
      withdrawId: row.withdrawId,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

async function updateWithdrawalRows(rows: WithdrawImportRow[]) {
  let updated = 0;

  for (const row of rows) {
    await db.withdrawTransaction.update({
      where: { withdrawId: row.withdrawId },
      data: {
        activityUrl: row.activityUrl,
        amount: row.amount,
        bankAccountHolder: row.bankAccountHolder,
        bankAccountNumber: row.bankAccountNumber,
        bankAccountType: row.bankAccountType,
        bankBranch: row.bankBranch,
        bankId: row.bankId,
        bankName: row.bankName,
        dateCreated: row.dateCreated,
        fee: row.fee,
        identificationNumber: row.identificationNumber,
        identificationType: row.identificationType,
        payoutDescription: row.payoutDescription,
        status: row.status,
        statusDetail: row.statusDetail,
      },
    });
    updated += 1;
  }

  return updated;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function importWithdrawals(input: {
  data: CsvUploadRow[];
  mode?: CsvUploadMode;
}) {
  const mode = input.mode ?? "insert-only";
  const { errors, validRows } = parseWithdrawalRows(input.data);
  const { insertRows, updateRows } = await classifyWithdrawalRows(validRows);

  let inserted = 0;
  let updated = 0;
  let skipped = errors.length;

  if (mode === "insert-only") {
    inserted = await createWithdrawalRows(insertRows);
    skipped += updateRows.length + (insertRows.length - inserted);
  } else if (mode === "update-only") {
    updated = await updateWithdrawalRows(updateRows);
    skipped += insertRows.length;
  } else {
    inserted = await createWithdrawalRows(insertRows);
    updated = await updateWithdrawalRows(updateRows);
    skipped += insertRows.length - inserted;
  }

  return {
    errors: errors.length > 0 ? errors : undefined,
    inserted,
    skipped,
    status: "ok" as const,
    toInsert: insertRows.length,
    toSkip: skipped,
    toUpdate: updateRows.length,
    updated,
  };
}

const csvUploadORPCRouterBase = {
  import: canWriteWithdrawals
    .route({
      method: "POST",
      path: "/import",
      summary: "Import CSV rows",
      tags: ["CSV Upload"],
    })
    .input(csvUploadContract.import["~orpc"].inputSchema)
    .output(csvUploadContract.import["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      if (input.table !== "withdrawals") {
        return {
          status: "ok" as const,
          inserted: 0,
          updated: 0,
          skipped: 0,
          toInsert: input.data.length,
          toUpdate: 0,
          toSkip: 0,
        };
      }

      const chunks = chunkRows(input.data, UPSERT_CHUNK_SIZE);
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let toInsert = 0;
      let toUpdate = 0;
      let toSkip = 0;
      const errors: string[] = [];

      for (const chunk of chunks) {
        const result = await importWithdrawals({
          data: chunk,
          mode: input.mode,
        });
        inserted += result.inserted;
        updated += result.updated;
        skipped += result.skipped;
        toInsert += result.toInsert;
        toUpdate += result.toUpdate;
        toSkip += result.toSkip;
        if (result.errors) {
          errors.push(...result.errors);
        }
      }

      return {
        errors: errors.length > 0 ? errors : undefined,
        inserted,
        skipped,
        status: "ok" as const,
        toInsert,
        toSkip,
        toUpdate,
        updated,
      };
    }),

  preview: canReadCsvUpload
    .route({
      method: "POST",
      path: "/preview",
      summary: "Preview CSV import",
      tags: ["CSV Upload"],
    })
    .input(csvUploadContract.preview["~orpc"].inputSchema)
    .output(csvUploadContract.preview["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      if (input.table !== "withdrawals") {
        return {
          status: "ok" as const,
          toInsert: input.data.length,
          toUpdate: 0,
          toSkip: 0,
        };
      }

      const mode = input.mode ?? "insert-only";
      const { errors, validRows } = parseWithdrawalRows(input.data);
      const { insertRows, updateRows } = await classifyWithdrawalRows(validRows);

      return buildWithdrawalPreview({
        errors,
        includeInsertRowIndexes: input.includeInsertRowIndexes,
        includeUpdateRows: input.includeUpdateRows,
        insertRows,
        mode,
        updateRows,
      });
    }),
};

export const csvUploadORPCRouter = base
  .prefix("/api/orpc/csv-upload")
  .tag("CSV Upload")
  .router(csvUploadORPCRouterBase);

export const csvUploadORPCHandler = new SuperJSONRPCHandler(csvUploadORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("csv-upload.orpc", error, {});
    }),
  ],
});

export const csvUploadOpenAPIHandler = new OpenAPIHandler(csvUploadORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia CSV Upload API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia CSV Upload API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("csv-upload.openapi", error, {});
    }),
  ],
});

export type CsvUploadORPCRouter = typeof csvUploadORPCRouter;
