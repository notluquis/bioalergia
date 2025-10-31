import express from "express";
import multer from "multer";
import Papa from "papaparse";
import type { ParseError } from "papaparse";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  asyncHandler,
  authenticate,
  requireRole,
} from "../lib/index.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import {
  DEFAULT_SETTINGS,
  getPool,
  loadSettings,
  upsertWithdrawals,
} from "../db.js";
import { buildMovements, type CsvRow } from "../transform.js";
import { buildPayouts, type PayoutCsvRow } from "../transformPayouts.js";
import { buildTransactionsQuery, clampLimit, EFFECTIVE_TIMESTAMP_EXPR, } from "../lib/transactions.js";
import {
  formatLocalDateForMySQL,
  normalizeDate,
  normalizeTimestamp,
  normalizeTimestampString,
} from "../lib/time.js";
import { roundCurrency } from "../../shared/currency.js";
import {
  transactionsQuerySchema,
  statsQuerySchema,
  participantLeaderboardQuerySchema,
} from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export function registerTransactionRoutes(app: express.Express) {
  app.post(
    "/api/transactions/upload",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    upload.single("file"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.file) {
        return res.status(400).json({ status: "error", message: "Selecciona un archivo CSV" });
      }

      logEvent("transactions/upload:start", requestContext(req, {
        file: req.file.originalname,
        size: req.file.size,
      }));

      const text = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toUpperCase(),
      });

      if (parsed.errors.length) {
        const details = parsed.errors.slice(0, 3).map((err: ParseError) => err.message);
        return res.status(400).json({ status: "error", message: "No se pudo leer el CSV", details });
      }

      const rows = parsed.data.filter((row: CsvRow) =>
        Object.values(row).some((value) => value != null && String(value).trim() !== "")
      );

      if (!rows.length) {
        logWarn("transactions/upload:empty", requestContext(req, { file: req.file.originalname }));
        return res.status(400).json({ status: "error", message: "El archivo no contiene filas válidas" });
      }

      const settings = await loadSettings();
      const accountName = settings.orgName || DEFAULT_SETTINGS.orgName;
      const movements = buildMovements(rows, accountName);
      if (!movements.length) {
        logWarn("transactions/upload:no-movements", requestContext(req, { file: req.file.originalname }));
        return res
          .status(400)
          .json({ status: "error", message: "No se detectaron movimientos a partir del CSV" });
      }

      const pool = getPool();
      const values = movements.map((movement) => [
        movement.timestampRaw,
        formatLocalDateForMySQL(movement.timestamp),
        movement.description ?? null,
        movement.origin ?? null,
        movement.destination ?? null,
        movement.sourceId ?? null,
        movement.direction,
        movement.amount,
        JSON.stringify(movement.raw),
        req.file?.originalname ?? null,
      ]);

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO mp_transactions
          (timestamp_raw, timestamp, description, origin, destination, source_id, direction, amount, raw_json, source_file)
         VALUES ?`,
        [values]
      );

      logEvent("transactions/upload:complete", requestContext(req, {
        file: req.file.originalname,
        parsedRows: rows.length,
        inserted: result.affectedRows,
        skipped: movements.length - result.affectedRows,
      }));
      res.json({
        status: "ok",
        inserted: result.affectedRows,
        skipped: movements.length - result.affectedRows,
        total: movements.length,
      });
    })
  );

  // NOTE: legacy server-side CSV upload for withdrawals removed in favor of
  // client-side parse + preview → import flow. Use:
  // - POST /api/transactions/withdrawals/preview  (send { ids: string[] })
  // - POST /api/transactions/withdrawals/import   (send { payouts: PayoutRecord[] })

    // Compatibility wrapper: accept a file upload and perform the same import
    // flow as the client-side import. This preserves backwards compatibility
    // for external scripts that still POST files to the old endpoint.
    app.post(
      "/api/transactions/withdrawals/upload",
      authenticate,
      requireRole("GOD", "ADMIN", "ANALYST"),
      upload.single("file"),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        if (!req.file) return res.status(400).json({ status: "error", message: "Selecciona un archivo CSV" });

        logEvent("withdrawals/upload-compat:start", requestContext(req, {
          file: req.file.originalname,
          size: req.file.size,
        }));

        const text = req.file.buffer.toString("utf-8");
        const parsed = Papa.parse<PayoutCsvRow>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
        });

        if (parsed.errors.length) {
          const details = parsed.errors.slice(0, 3).map((err: ParseError) => err.message);
          return res.status(400).json({ status: "error", message: "No se pudo leer el CSV", details });
        }

        const rows = parsed.data.filter((row: PayoutCsvRow) =>
          Object.values(row).some((value) => value != null && String(value).trim() !== "")
        );

        if (!rows.length) return res.status(400).json({ status: "error", message: "El archivo no contiene filas válidas" });

        const payouts = buildPayouts(rows);
        if (!payouts.length) return res.status(400).json({ status: "error", message: "No se detectaron retiros válidos en el CSV" });

        const result = await upsertWithdrawals(payouts as any);

        logEvent("withdrawals/upload-compat:complete", requestContext(req, {
          file: req.file.originalname,
          detected: payouts.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: (result as any).skipped ?? 0,
        }));

        res.json({ status: "ok", inserted: result.inserted, updated: result.updated, skipped: (result as any).skipped ?? 0, total: payouts.length });
      })
    );

  // Preview existing withdrawals for a set of withdrawIds. The client should
  // perform CSV parsing and send the extracted withdrawIds here to keep heavy
  // parsing work on the client.
  app.post(
    "/api/transactions/withdrawals/preview",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
      if (!ids.length) return res.json({ status: "ok", existing: {} });

      const pool = getPool();
      const CHUNK = 500;
      const existing: Record<string, string | null> = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => "?").join(",");
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT withdraw_id, raw_json FROM mp_withdrawals WHERE withdraw_id IN (${placeholders})`,
          chunk
        );
        for (const r of rows) {
          existing[String(r.withdraw_id)] = r.raw_json == null ? null : String(r.raw_json);
        }
      }

      res.json({ status: "ok", existing });
    })
  );

  // Import payouts provided as JSON (client-side parsed). This avoids re-parsing
  // the CSV on the server. The payload should be an array of payouts matching
  // the PayoutRecord shape used by upsertWithdrawals.
  app.post(
    "/api/transactions/withdrawals/import",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const payouts = Array.isArray(req.body?.payouts) ? req.body.payouts : [];
      if (!payouts.length) return res.status(400).json({ status: "error", message: "No hay retiros para importar" });

      const result = await upsertWithdrawals(payouts as any);

      logEvent("withdrawals/import:complete", requestContext(req, {
        imported: result.inserted,
        updated: result.updated,
        skipped: (result as any).skipped ?? 0,
        total: (result as any).total ?? payouts.length,
      }));

      res.json({ status: "ok", ...result, total: (result as any).total ?? payouts.length });
    })
  );

  app.get(
    "/api/transactions",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = transactionsQuerySchema.parse(req.query);
      const limit = clampLimit(parsed.limit);
      const includeAmounts = parsed.includeAmounts === "true";

      const page = parsed.page ?? 1;
      const pageSize = parsed.pageSize ?? limit;

      logEvent("transactions/list", requestContext(req, {
        limit,
        includeAmounts,
        filters: parsed,
        page,
        pageSize,
      }));

      const { sql, dataParams, countSql, countParams, page: finalPage, pageSize: finalPageSize } =
        buildTransactionsQuery({
          limit,
          includeAmounts,
          from: parsed.from,
          to: parsed.to,
          description: parsed.description,
          origin: parsed.origin,
          destination: parsed.destination,
          sourceId: parsed.sourceId,
          direction: parsed.direction,
          file: parsed.file,
          page,
          pageSize,
        });

      const pool = getPool();
      const [[totalRow]] = await pool.query<RowDataPacket[]>(countSql, countParams);
      const total = Number(totalRow?.total ?? 0);
      const [rows] = await pool.query<RowDataPacket[]>(sql, dataParams);

      const data = rows.map((row) => {
        const payout =
          row.payout_withdraw_id != null
            ? {
                withdrawId: String(row.payout_withdraw_id),
                dateCreated: normalizeTimestampString(row.payout_date_created as string | null) || null,
                status: (row.payout_status as string) ?? null,
                statusDetail: (row.payout_status_detail as string) ?? null,
                amount: row.payout_amount != null ? Number(row.payout_amount) : null,
                fee: row.payout_fee != null ? Number(row.payout_fee) : null,
                payoutDesc: (row.payout_desc as string) ?? null,
                bankAccountHolder: (row.payout_bank_account_holder as string) ?? null,
                bankName: (row.payout_bank_name as string) ?? null,
                bankAccountType: (row.payout_bank_account_type as string) ?? null,
                bankAccountNumber: (row.payout_bank_account_number as string) ?? null,
                bankBranch: (row.payout_bank_branch as string) ?? null,
                identificationType: (row.payout_identification_type as string) ?? null,
                identificationNumber: (row.payout_identification_number as string) ?? null,
              }
            : null;

        const originalDestination = (row.destination as string) ?? null;
        const destination =
          (row.direction as string) === "OUT" && payout?.bankAccountHolder
            ? `${payout.bankAccountHolder}${payout.bankName ? ` · ${payout.bankName}` : ""}`
            : originalDestination;

        const loanSchedule =
          row.loan_schedule_id != null
            ? {
                id: Number(row.loan_schedule_id),
                installmentNumber: Number(row.loan_installment_number ?? 0),
                status: (row.loan_schedule_status as string) ?? "PENDING",
                dueDate: row.loan_due_date ? String(row.loan_due_date).slice(0, 10) : null,
                expectedAmount: row.loan_expected_amount != null ? Number(row.loan_expected_amount) : null,
                loanTitle: row.loan_title != null ? String(row.loan_title) : null,
                loanPublicId: row.loan_public_id != null ? String(row.loan_public_id) : null,
              }
            : null;

        const serviceSchedule =
          row.service_schedule_id != null
            ? {
                id: Number(row.service_schedule_id),
                status: (row.service_schedule_status as string) ?? "PENDING",
                dueDate: row.service_due_date ? String(row.service_due_date).slice(0, 10) : null,
                expectedAmount: row.service_expected_amount != null ? Number(row.service_expected_amount) : null,
                serviceName: row.service_name != null ? String(row.service_name) : null,
                servicePublicId: row.service_public_id != null ? String(row.service_public_id) : null,
                periodStart: row.service_period_start ? String(row.service_period_start).slice(0, 10) : null,
              }
            : null;

        return {
          id: Number(row.id),
          timestamp: normalizeTimestamp(row.timestamp as string | Date, row.timestamp_raw as string | null),
          timestamp_raw: (row.timestamp_raw as string) ?? null,
          description: (row.description as string) ?? payout?.payoutDesc ?? null,
          origin: (row.origin as string) ?? null,
          destination,
          source_id: (row.source_id as string) ?? null,
          direction: row.direction as "IN" | "OUT" | "NEUTRO",
          amount: row.amount != null ? Number(row.amount) : null,
          created_at: row.created_at as string,
          payout,
          loanSchedule,
          serviceSchedule,
        };
      });

      res.json({ status: "ok", data, hasAmounts: includeAmounts, total, page: finalPage, pageSize: finalPageSize });
    })
  );

  app.get(
    "/api/transactions/stats",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = statsQuerySchema.parse(req.query);
      const from = parsed.from ? normalizeDate(parsed.from, "start") : null;
      const to = parsed.to ? normalizeDate(parsed.to, "end") : null;

      const pool = getPool();

      const conditions: string[] = [];
      const params: Array<string | number> = [];

      if (from) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} >= ?`);
        params.push(from);
      }
      if (to) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} <= ?`);
        params.push(to);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const monthlySql = `SELECT DATE_FORMAT(${EFFECTIVE_TIMESTAMP_EXPR}, '%Y-%m-01') AS month,
        SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) AS sum_in,
        SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) AS sum_out
        FROM mp_transactions
        ${whereClause}
        GROUP BY month
        ORDER BY month ASC`;

      const totalsSql = `SELECT direction, SUM(amount) AS total
        FROM mp_transactions
        ${whereClause}
        GROUP BY direction`;

      const typeSql = `SELECT description, direction, SUM(amount) AS total
        FROM mp_transactions
        ${whereClause}
        GROUP BY description, direction
        ORDER BY total DESC`;

      const [monthlyRows] = await pool.query<RowDataPacket[]>(monthlySql, params);
      const [totalsRows] = await pool.query<RowDataPacket[]>(totalsSql, params);
      const [typeRows] = await pool.query<RowDataPacket[]>(typeSql, params);

      const monthly = monthlyRows.map((row) => ({
        month: String(row.month),
        in: Number(row.sum_in ?? 0),
        out: Number(row.sum_out ?? 0),
        net: Number(row.sum_in ?? 0) - Number(row.sum_out ?? 0),
      }));

      const totals = totalsRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.direction as string] = Number(row.total ?? 0);
        return acc;
      }, {});

      const byType = typeRows.map((row) => ({
        description: row.description as string | null,
        direction: row.direction as "IN" | "OUT" | "NEUTRO",
        total: Number(row.total ?? 0),
      }));

      logEvent("transactions/stats", requestContext(req, { from, to }));

      res.json({
        status: "ok",
        monthly,
        totals,
        byType,
      });
    })
  );

  app.get(
    "/api/transactions/participants",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = participantLeaderboardQuerySchema.parse(req.query);
      const from = parsed.from ? normalizeDate(parsed.from, "start") : null;
      const to = parsed.to ? normalizeDate(parsed.to, "end") : null;
      const limit = Math.min(clampLimit(parsed.limit ?? 10), 100);
      const mode = parsed.mode ?? "combined";

      const conditions: string[] = [];
      const params: Array<string | number> = [];

      if (from) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} >= ?`);
        params.push(from);
      }

      if (to) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} <= ?`);
        params.push(to);
      }

      const baseClause = conditions.length ? conditions.join(" AND ") : "1=1";

      const leaderboardSql = `
        SELECT
          COALESCE(mw.identification_number, t.source_id, t.destination) AS participant_key,
          MAX(mw.identification_number) AS identification_number,
          MAX(mw.bank_account_holder) AS bank_account_holder,
          MAX(mw.bank_account_number) AS bank_account_number,
          MAX(mw.bank_account_type) AS bank_account_type,
          MAX(mw.bank_name) AS bank_name,
          MAX(mw.bank_branch) AS bank_branch,
          MAX(mw.withdraw_id) AS withdraw_id,
          COUNT(*) AS outgoing_count,
          SUM(t.amount) AS outgoing_amount
        FROM mp_transactions AS t
        LEFT JOIN mp_withdrawals AS mw ON t.source_id = mw.withdraw_id
        WHERE ${baseClause} AND t.direction = 'OUT'
        GROUP BY participant_key, identification_number, bank_account_number
        HAVING outgoing_count > 0
        ORDER BY outgoing_amount DESC, outgoing_count DESC, participant_key ASC
        LIMIT ?` as string;

      logEvent(
        "transactions/participants:leaderboard",
        requestContext(req, { mode, limit, from, to })
      );

      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(leaderboardSql, [...params, limit]);

      const participants = rows.map((row) => {
        const outgoingCount = Number(row.outgoing_count ?? 0);
        const outgoingAmountRaw = Number(row.outgoing_amount ?? 0);
        return {
          participant: (row.participant_key as string | null) || "",
          displayName:
            (row.bank_account_holder as string | null)?.trim() ||
            (row.identification_number as string | null)?.trim() ||
            (row.participant_key as string | null)?.trim() ||
            "(sin información)",
          identificationNumber: (row.identification_number as string | null) || null,
          bankAccountHolder: (row.bank_account_holder as string | null) || null,
          bankAccountNumber: (row.bank_account_number as string | null) || null,
          bankAccountType: (row.bank_account_type as string | null) || null,
          bankName: (row.bank_name as string | null) || null,
          bankBranch: (row.bank_branch as string | null) || null,
          withdrawId: (row.withdraw_id as string | null) || null,
          outgoingCount,
          outgoingAmount: roundCurrency(outgoingAmountRaw),
          incomingCount: 0,
          incomingAmount: 0,
          totalCount: outgoingCount,
          totalAmount: roundCurrency(outgoingAmountRaw),
        };
      });

      res.json({ status: "ok", participants });
    })
  );

  app.get(
    "/api/transactions/participants/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const participantId = req.params.id?.trim();
      if (!participantId) {
        return res.status(400).json({ status: "error", message: "El ID del participante es obligatorio." });
      }

      const from = req.query.from ? normalizeDate(String(req.query.from), "start") : null;
      const to = req.query.to ? normalizeDate(String(req.query.to), "end") : null;

      const conditions: string[] = ["(origin = ? OR destination = ?)"];
      const params: Array<string | number> = [participantId, participantId];

      if (from) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} >= ?`);
        params.push(from);
      }
      if (to) {
        conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} <= ?`);
        params.push(to);
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const pool = getPool();

      const [monthlyRows] = await pool.query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(${EFFECTIVE_TIMESTAMP_EXPR}, '%Y-%m') AS month,
                SUM(origin = ?) AS outgoing_count,
                SUM(destination = ?) AS incoming_count,
                SUM(CASE WHEN origin = ? THEN amount ELSE 0 END) AS outgoing_amount,
                SUM(CASE WHEN destination = ? THEN amount ELSE 0 END) AS incoming_amount
           FROM mp_transactions
          ${whereClause}
          GROUP BY month
          ORDER BY month DESC` as string,
        [participantId, participantId, participantId, participantId, ...params]
      );

      const [counterRows] = await pool.query<RowDataPacket[]>(
        `SELECT
            CASE
              WHEN mt.origin = ? THEN mt.destination
              ELSE mt.origin
            END AS counterpart,
            SUM(mt.origin = ?) AS outgoing_count,
            SUM(mt.destination = ?) AS incoming_count,
            SUM(CASE WHEN mt.origin = ? THEN mt.amount ELSE 0 END) AS outgoing_amount,
            SUM(CASE WHEN mt.destination = ? THEN mt.amount ELSE 0 END) AS incoming_amount,
            MAX(CASE WHEN mt.origin = ? THEN mw.withdraw_id END) AS payout_withdraw_id,
            MAX(CASE WHEN mt.origin = ? THEN mw.bank_account_holder END) AS payout_holder,
            MAX(CASE WHEN mt.origin = ? THEN mw.bank_name END) AS payout_bank_name,
            MAX(CASE WHEN mt.origin = ? THEN mw.bank_account_number END) AS payout_bank_account_number,
            MAX(CASE WHEN mt.origin = ? THEN mw.bank_account_type END) AS payout_bank_account_type,
            MAX(CASE WHEN mt.origin = ? THEN mw.bank_branch END) AS payout_bank_branch,
            MAX(CASE WHEN mt.origin = ? THEN mw.identification_type END) AS payout_identification_type,
            MAX(CASE WHEN mt.origin = ? THEN mw.identification_number END) AS payout_identification_number
         FROM mp_transactions AS mt
        LEFT JOIN mp_withdrawals AS mw ON mt.destination = mw.withdraw_id
       ${whereClause}
        GROUP BY counterpart
        ORDER BY
          SUM(CASE WHEN mt.origin = ? THEN mt.amount ELSE 0 END) DESC,
          SUM(mt.origin = ?) DESC,
          counterpart IS NULL,
          counterpart ASC` as string,
        [
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          participantId,
          ...params,
        ]
      );

      const monthly = monthlyRows.map((row) => ({
        month: String(row.month),
        outgoingCount: Number(row.outgoing_count ?? 0),
        incomingCount: Number(row.incoming_count ?? 0),
        outgoingAmount: roundCurrency(Number(row.outgoing_amount ?? 0)),
        incomingAmount: roundCurrency(Number(row.incoming_amount ?? 0)),
      }));

      const counterparts = counterRows
        .map((row) => {
          const counterpartId = row.counterpart != null ? String(row.counterpart) : null;
          const bankAccountHolder = row.payout_holder ? String(row.payout_holder) : null;
          const bankName = row.payout_bank_name ? String(row.payout_bank_name) : null;
          const bankAccountNumber = row.payout_bank_account_number ? String(row.payout_bank_account_number) : null;
          const bankAccountType = row.payout_bank_account_type ? String(row.payout_bank_account_type) : null;
          const bankBranch = row.payout_bank_branch ? String(row.payout_bank_branch) : null;
          const identificationType = row.payout_identification_type ? String(row.payout_identification_type) : null;
          const identificationNumber = row.payout_identification_number ? String(row.payout_identification_number) : null;
          const withdrawId = row.payout_withdraw_id ? String(row.payout_withdraw_id) : null;

          const counterpartLabel =
            bankAccountHolder || bankName || counterpartId || withdrawId || "(sin información)";
          const counterpart = counterpartLabel.trim() || "(sin información)";

          return {
            counterpart,
            counterpartId,
            withdrawId,
            bankAccountHolder,
            bankName,
            bankAccountNumber,
            bankAccountType,
            bankBranch,
            identificationType,
            identificationNumber,
            outgoingCount: Number(row.outgoing_count ?? 0),
            incomingCount: Number(row.incoming_count ?? 0),
            outgoingAmount: roundCurrency(Number(row.outgoing_amount ?? 0)),
            incomingAmount: roundCurrency(Number(row.incoming_amount ?? 0)),
          };
        })
        .filter((row) => row.counterpart.trim().length)
        .sort((a, b) => {
          const totalA = a.outgoingCount + a.incomingCount;
          const totalB = b.outgoingCount + b.incomingCount;
          if (totalA !== totalB) return totalB - totalA;
          const amountA = a.outgoingAmount + a.incomingAmount;
          const amountB = b.outgoingAmount + b.incomingAmount;
          if (amountA !== amountB) return amountB - amountA;
          return a.counterpart.localeCompare(b.counterpart);
        });

      res.json({
        status: "ok",
        participant: participantId,
        monthly,
        counterparts,
      });
    })
  );
}
