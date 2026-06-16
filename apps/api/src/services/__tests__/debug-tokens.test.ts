import { beforeEach, describe, expect, it, vi } from "vitest";

// debug-tokens.ts imports `db` from @finanzas/db at module load. We mock `db`
// covering the ORM model method the service touches (debugToken.create) and the
// $qb fluent builder used by consumeDebugTokenRecord (updateTable ...
// returning -> executeTakeFirst). $setOptions keeps @finanzas/db + /slices from
// throwing at import. We capture .set(...) and each .where(...) arg so tests can
// assert the atomic conditional-consume shape without inspecting raw SQL text.
const { noopDb, mockDebugTokenCreate, mockQbExecuteTakeFirst, qbCalls, qbBuilder } = vi.hoisted(
  () => {
    const mockDebugTokenCreate = vi.fn();
    const mockQbExecuteTakeFirst = vi.fn();
    const qbCalls = {
      updateTable: undefined as unknown,
      set: undefined as unknown,
      where: [] as unknown[],
      returning: undefined as unknown,
    };
    const qbBuilder = {
      updateTable: (t: unknown) => {
        qbCalls.updateTable = t;
        return qbBuilder;
      },
      set: (s: unknown) => {
        qbCalls.set = s;
        return qbBuilder;
      },
      where: (...a: unknown[]) => {
        qbCalls.where.push(a);
        return qbBuilder;
      },
      returning: (cols: unknown) => {
        qbCalls.returning = cols;
        return qbBuilder;
      },
      executeTakeFirst: (...a: unknown[]) => mockQbExecuteTakeFirst(...a),
    };
    const noopDb = {
      $setOptions: () => noopDb,
      $qb: qbBuilder,
      debugToken: {
        create: (...a: unknown[]) => mockDebugTokenCreate(...a),
      },
    };
    return { noopDb, mockDebugTokenCreate, mockQbExecuteTakeFirst, qbCalls, qbBuilder };
  }
);

vi.mock("@finanzas/db", () => ({ db: noopDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: noopDb }));

import { consumeDebugTokenRecord, createDebugTokenRecord } from "../debug-tokens.ts";

beforeEach(() => {
  mockDebugTokenCreate.mockReset();
  mockQbExecuteTakeFirst.mockReset();
  qbCalls.updateTable = undefined;
  qbCalls.set = undefined;
  qbCalls.where = [];
  qbCalls.returning = undefined;
});

describe("createDebugTokenRecord", () => {
  it("creates a row via the ORM with normalized scopes and the raw Date", async () => {
    mockDebugTokenCreate.mockResolvedValue({ id: 1 });
    const expiresAt = new Date("2026-07-01T00:00:00.000Z");

    await createDebugTokenRecord({
      audience: "debug-cli",
      expiresAt,
      issuedByUserId: 10,
      jti: "jti-abc",
      reason: "investigate",
      // out-of-order + whitespace + an empty/invalid entry to exercise normalize
      scopes: [
        { action: "  read ", subject: " Patient " },
        { action: "delete", subject: "Patient" },
        { action: "", subject: "Empty" },
      ],
      targetUserId: 20,
    });

    expect(mockDebugTokenCreate).toHaveBeenCalledTimes(1);
    const arg = mockDebugTokenCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.jti).toBe("jti-abc");
    expect(arg.data.issuedByUserId).toBe(10);
    expect(arg.data.targetUserId).toBe(20);
    expect(arg.data.audience).toBe("debug-cli");
    expect(arg.data.reason).toBe("investigate");
    // raw Date passed through (NOT an ISO string)
    expect(arg.data.expiresAt).toBeInstanceOf(Date);
    expect(arg.data.expiresAt).toBe(expiresAt);
    // scopes passed as a value (array), NOT a JSON string; trimmed, sorted by
    // `subject:action`, empty entry dropped.
    expect(arg.data.scopes).toEqual([
      { action: "delete", subject: "Patient" },
      { action: "read", subject: "Patient" },
    ]);
    // @default(now()) columns must not be supplied.
    expect(arg.data).not.toHaveProperty("createdAt");
    expect(arg.data).not.toHaveProperty("updatedAt");
  });
});

describe("consumeDebugTokenRecord", () => {
  it("atomically flips used_at via $qb and maps the returned row", async () => {
    mockQbExecuteTakeFirst.mockResolvedValue({
      audience: "debug-playwright",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      id: 5,
      issuedByUserId: 11,
      jti: "jti-xyz",
      reason: "qa",
      scopes: [{ action: "read", subject: "Patient" }],
      targetUserId: 22,
      usedAt: new Date("2026-06-16T00:00:00.000Z"),
    });

    const result = await consumeDebugTokenRecord("jti-xyz");

    expect(qbCalls.updateTable).toBe("DebugToken");
    // three guards: jti match, used_at IS NULL, expires_at > NOW()
    expect(qbCalls.where).toHaveLength(3);
    expect(qbCalls.where[0]).toEqual(["jti", "=", "jti-xyz"]);
    expect(qbCalls.where[1]).toEqual(["usedAt", "is", null]);
    // mapped result preserves the model shape via mapStoredToken/parseScopes
    expect(result).not.toBeNull();
    expect(result?.id).toBe(5);
    expect(result?.jti).toBe("jti-xyz");
    expect(result?.audience).toBe("debug-playwright");
    expect(result?.scopes).toEqual([{ action: "read", subject: "Patient" }]);
    expect(result?.usedAt).toBeInstanceOf(Date);
  });

  it("returns null when no row matches the conditional update", async () => {
    mockQbExecuteTakeFirst.mockResolvedValue(undefined);
    const result = await consumeDebugTokenRecord("missing");
    expect(result).toBeNull();
    expect(qbCalls.updateTable).toBe("DebugToken");
  });

  it("drops malformed scope entries when parsing the stored row", async () => {
    mockQbExecuteTakeFirst.mockResolvedValue({
      audience: "debug-cli",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      id: 6,
      issuedByUserId: 1,
      jti: "jti-mixed",
      reason: "qa",
      scopes: [
        { action: "read", subject: "Patient" },
        { action: 123, subject: "Bad" },
        null,
        "not-an-object",
        { subject: "NoAction" },
      ],
      targetUserId: 2,
      usedAt: null,
    });

    const result = await consumeDebugTokenRecord("jti-mixed");
    expect(result?.scopes).toEqual([{ action: "read", subject: "Patient" }]);
    expect(result?.usedAt).toBeNull();
  });
});
