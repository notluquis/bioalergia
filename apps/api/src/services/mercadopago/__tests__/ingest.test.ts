import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, insertIntoMock } = vi.hoisted(() => {
  const executeMock = vi.fn<() => Promise<Array<{ inserted: boolean; sourceId: string }>>>();
  const insertIntoMock = vi.fn<(table: string) => unknown>();
  return { executeMock, insertIntoMock };
});

vi.mock("@finanzas/db", () => {
  const builder = {
    execute: executeMock,
    onConflict: vi.fn<(callback: (oc: unknown) => unknown) => unknown>((callback) => {
      callback({
        column: vi.fn<(column: string) => unknown>(() => ({
          doUpdateSet: vi.fn<(update: unknown) => unknown>(() => ({
            where: vi.fn<(expression: unknown) => undefined>(() => undefined),
          })),
        })),
      });
      return builder;
    }),
    returning: vi.fn<(selection: unknown) => unknown>(() => builder),
    values: vi.fn<(values: unknown) => unknown>(() => builder),
  };

  insertIntoMock.mockReturnValue(builder);

  return {
    db: {
      $qb: {
        insertInto: insertIntoMock,
      },
    },
    kysely: {},
  };
});

describe("processReportUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MP_ACCESS_TOKEN = "test-token";
  });

  it("counts upserted report rows as updated instead of duplicate", async () => {
    executeMock.mockResolvedValue([{ inserted: false, sourceId: "MP-1" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const csv = [
          "SOURCE_ID,DATE,GROSS_AMOUNT,ISSUER_NAME",
          "MP-1,2026-05-08T10:00:00Z,100,Issuer Nuevo",
        ].join("\n");
        return new Response(csv, {
          headers: { "content-type": "text/csv" },
          status: 200,
        });
      })
    );

    const { processReportUrl } = await import("../ingest.ts");
    const stats = await processReportUrl("https://example.test/release.csv", "release");

    expect(insertIntoMock).toHaveBeenCalledWith("ReleaseTransaction");
    expect(stats).toMatchObject({
      duplicateRows: 0,
      insertedRows: 0,
      totalRows: 1,
      unchangedRows: 0,
      updatedRows: 1,
      validRows: 1,
    });
    expect(stats.processedSourceIds).toEqual(["MP-1"]);
  });

  it("counts rows skipped by DO UPDATE WHERE as unchanged", async () => {
    executeMock.mockResolvedValue([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const csv = ["SOURCE_ID,DATE,GROSS_AMOUNT", "MP-1,2026-05-08T10:00:00Z,100"].join("\n");
        return new Response(csv, {
          headers: { "content-type": "text/csv" },
          status: 200,
        });
      })
    );

    const { processReportUrl } = await import("../ingest.ts");
    const stats = await processReportUrl("https://example.test/release.csv", "release");

    expect(stats).toMatchObject({
      duplicateRows: 1,
      insertedRows: 0,
      unchangedRows: 1,
      updatedRows: 0,
      validRows: 1,
    });
  });
});

describe("serializeRowForPg", () => {
  it("massages Decimal → numeric string and Json object/array → JSON string for the raw $qb bind", async () => {
    const { Decimal } = await import("decimal.js");
    const { serializeRowForPg } = await import("../ingest.ts");

    const txDate = new Date("2026-06-07T07:45:56.000Z");
    const out = serializeRowForPg({
      sourceId: "abc",
      transactionDate: txDate,
      transactionAmount: new Decimal(-23090),
      feeAmount: new Decimal("0.00"),
      userId: "2040207498",
      installments: 1,
      metadata: { foo: "bar" },
      operationTags: [{}],
    });

    // Decimal → plain numeric string (else pg quotes it → 22P02 numeric)
    expect(out.transactionAmount).toBe("-23090");
    expect(typeof out.transactionAmount).toBe("string");
    expect(out.feeAmount).toBe("0");
    // Json object / array → JSON string (else a JS array binds as pg array
    // literal {"{}"} → 22P02 invalid json)
    expect(out.metadata).toBe('{"foo":"bar"}');
    expect(out.operationTags).toBe("[{}]");
    // Date binds natively, untouched; primitives pass through
    expect(out.transactionDate).toBe(txDate);
    expect(out.sourceId).toBe("abc");
    expect(out.userId).toBe("2040207498");
    expect(out.installments).toBe(1);
  });
});
