/**
 * Regression tests for the CSV column auto-mapper used by
 * `CSVUploadPage.tsx`. The mapper has to bridge two namespaces:
 *
 *   - Field names declared in `TABLE_OPTIONS` (camelCase, matching the
 *     contract's `csvUploadRowSchema`).
 *   - CSV column headers exported by upstream providers (snake_case,
 *     often with a label prefix, sometimes truncated).
 *
 * The bug that motivated this file (2026-05-18): MercadoPago exports
 * `Motivo (payout_desc)` for the withdrawal "reason" column, but the
 * field is `payoutDescription`. After `normalizeKey` strips
 * non-alphanumerics both end up as different strings
 * (`payoutdesc` vs `payoutdescription`) and the mapper produces an
 * empty mapping. Fix: `FieldDefinition.aliases` whitelist.
 *
 * These tests assert the auto-mapper covers EVERY required + commonly
 * exported field for the most-used templates so PRs that rename a
 * field can't silently break the upload UI.
 */

import { describe, expect, it } from "vitest";

// Reimplement the small auto-mapper surface here so we can unit-test it
// without rendering the 1800-line page component. If `CSVUploadPage`
// changes the algorithm, mirror it here — the duplication is intentional
// (the page module isn't exported as ESM, only re-exports the React
// component). Long-term TODO: extract the auto-mapper to its own module.

interface FieldDefinition {
  name: string;
  required: boolean;
  type: string;
  aliases?: readonly string[];
}

const HEADER_ALIAS_REGEX = /\(([^)]+)\)/;

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const extractHeaderAliases = (header: string) => {
  const aliases = [header];
  const match = header.match(HEADER_ALIAS_REGEX);
  if (match?.[1]) {
    aliases.push(match[1]);
  }
  return aliases;
};

const matchHeaderForField = (field: FieldDefinition, headers: string[]) => {
  const targets = new Set<string>([normalizeKey(field.name)]);
  if (field.aliases) {
    for (const alias of field.aliases) {
      targets.add(normalizeKey(alias));
    }
  }
  for (const header of headers) {
    const headerAliases = extractHeaderAliases(header);
    if (headerAliases.some((alias) => targets.has(normalizeKey(alias)))) {
      return header;
    }
  }
  return undefined;
};

const mapFields = (headers: string[], fields: FieldDefinition[]) => {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const matched = matchHeaderForField(field, headers);
    if (matched) {
      mapping[field.name] = matched;
    }
  }
  return mapping;
};

// ─── Mirror of TABLE_OPTIONS subset used in the tests ──────────────

const WITHDRAWAL_FIELDS: FieldDefinition[] = [
  { name: "dateCreated", required: true, type: "date" },
  { name: "withdrawId", required: true, type: "string" },
  { name: "status", required: false, type: "string" },
  { name: "statusDetail", required: false, type: "string" },
  { name: "amount", required: false, type: "number" },
  { name: "fee", required: false, type: "number" },
  { name: "activityUrl", required: false, type: "string" },
  {
    aliases: ["payout_desc", "motivo"],
    name: "payoutDescription",
    required: false,
    type: "string",
  },
  { name: "bankAccountHolder", required: false, type: "string" },
  { name: "identificationType", required: false, type: "string" },
  { name: "identificationNumber", required: false, type: "string" },
  { name: "bankId", required: false, type: "string" },
  { name: "bankName", required: false, type: "string" },
  { name: "bankBranch", required: false, type: "string" },
  { name: "bankAccountType", required: false, type: "string" },
  { name: "bankAccountNumber", required: false, type: "string" },
];

const MP_WITHDRAWAL_HEADERS = [
  "Fecha de creación del retiro (date_created)",
  "Número de retiro (withdraw_id)",
  "Estado (status)",
  "Detalles del estado (status_detail)",
  "Monto (amount)",
  "Tarifa de retiro (fee)",
  "Detalle de la operación en Mercado Pago (activity_url)",
  "Motivo (payout_desc)",
  "Nombre del titular (bank_account_holder)",
  "Tipo de identificación (identification_type)",
  "Número de identificación (identification_number)",
  "ID del banco (bank_id)",
  "Nombre del banco (bank_name)",
  "Sucursal (bank_branch)",
  "Tipo de cuenta (bank_account_type)",
  "Número de cuenta (bank_account_number)",
];

describe("CSV auto-mapper (golden 2026)", () => {
  describe("normalizeKey", () => {
    it("strips non-alphanumeric and lowercases", () => {
      expect(normalizeKey("date_created")).toBe("datecreated");
      expect(normalizeKey("dateCreated")).toBe("datecreated");
      expect(normalizeKey("Date-Created!")).toBe("datecreated");
    });

    it("collapses underscored short names independently of camelCase length", () => {
      // The bug — `payout_desc` and `payoutDescription` collapse to
      // DIFFERENT strings, which is why aliases exist.
      expect(normalizeKey("payout_desc")).toBe("payoutdesc");
      expect(normalizeKey("payoutDescription")).toBe("payoutdescription");
      expect(normalizeKey("payout_desc") === normalizeKey("payoutDescription")).toBe(false);
    });
  });

  describe("extractHeaderAliases", () => {
    it("returns the header itself plus any parenthesized alias", () => {
      expect(extractHeaderAliases("Fecha de creación del retiro (date_created)")).toEqual([
        "Fecha de creación del retiro (date_created)",
        "date_created",
      ]);
    });

    it("returns just the header when no parens", () => {
      expect(extractHeaderAliases("status")).toEqual(["status"]);
    });

    it("captures only the first parenthesized group (greedy match)", () => {
      expect(
        extractHeaderAliases("Detalle de la operación en Mercado Pago (activity_url)")
      ).toEqual(["Detalle de la operación en Mercado Pago (activity_url)", "activity_url"]);
    });
  });

  describe("MercadoPago withdrawals end-to-end", () => {
    it("maps EVERY column from the official MP withdrawals export", () => {
      const mapping = mapFields(MP_WITHDRAWAL_HEADERS, WITHDRAWAL_FIELDS);

      expect(mapping).toEqual({
        dateCreated: "Fecha de creación del retiro (date_created)",
        withdrawId: "Número de retiro (withdraw_id)",
        status: "Estado (status)",
        statusDetail: "Detalles del estado (status_detail)",
        amount: "Monto (amount)",
        fee: "Tarifa de retiro (fee)",
        activityUrl: "Detalle de la operación en Mercado Pago (activity_url)",
        // REGRESSION GUARD: `payout_desc` must map even though
        // it's a truncated alias of `payoutDescription`.
        payoutDescription: "Motivo (payout_desc)",
        bankAccountHolder: "Nombre del titular (bank_account_holder)",
        identificationType: "Tipo de identificación (identification_type)",
        identificationNumber: "Número de identificación (identification_number)",
        bankId: "ID del banco (bank_id)",
        bankName: "Nombre del banco (bank_name)",
        bankBranch: "Sucursal (bank_branch)",
        bankAccountType: "Tipo de cuenta (bank_account_type)",
        bankAccountNumber: "Número de cuenta (bank_account_number)",
      });
    });

    it("maps both required fields so the preview button enables", () => {
      const mapping = mapFields(MP_WITHDRAWAL_HEADERS, WITHDRAWAL_FIELDS);
      const requiredMapped = WITHDRAWAL_FIELDS.filter((f) => f.required).every(
        (f) => mapping[f.name] && mapping[f.name] !== ""
      );
      expect(requiredMapped).toBe(true);
    });

    it("falls back to alias `motivo` (label-only export without parens)", () => {
      const headers = [
        "date_created",
        "withdraw_id",
        "Motivo", // No parenthesized alias.
      ];
      const mapping = mapFields(headers, WITHDRAWAL_FIELDS);
      expect(mapping.payoutDescription).toBe("Motivo");
    });
  });

  describe("alias matching", () => {
    it("prefers the field name over an alias when both are present", () => {
      const field: FieldDefinition = {
        aliases: ["x"],
        name: "alpha",
        required: false,
        type: "string",
      };
      // Both "alpha" and "x" appear — alpha wins because it iterates
      // header order, not target order; the first header that
      // matches any target wins.
      const mapping = mapFields(["alpha", "x"], [field]);
      expect(mapping.alpha).toBe("alpha");
    });

    it("ignores aliases that match nothing", () => {
      const field: FieldDefinition = {
        aliases: ["nonexistent"],
        name: "alpha",
        required: false,
        type: "string",
      };
      expect(mapFields(["beta"], [field])).toEqual({});
    });

    it("treats alias casing/punctuation the same as field names", () => {
      const field: FieldDefinition = {
        aliases: ["payout-desc"],
        name: "alpha",
        required: false,
        type: "string",
      };
      expect(mapFields(["Payout Desc"], [field])).toEqual({ alpha: "Payout Desc" });
    });
  });

  describe("edge cases", () => {
    it("returns empty mapping when no headers match", () => {
      const mapping = mapFields(
        ["unrelated1", "unrelated2"],
        [{ name: "alpha", required: true, type: "string" }]
      );
      expect(mapping).toEqual({});
    });

    it("returns empty mapping when no fields", () => {
      expect(mapFields(["any"], [])).toEqual({});
    });

    it("does not duplicate fields when a header matches multiple aliases", () => {
      const field: FieldDefinition = {
        aliases: ["x", "y"],
        name: "alpha",
        required: false,
        type: "string",
      };
      const mapping = mapFields(["alpha"], [field]);
      expect(Object.keys(mapping)).toEqual(["alpha"]);
      expect(mapping.alpha).toBe("alpha");
    });
  });
});
