import http from "node:http";
import { describe, it, expect } from "vitest";

// Minimal integration test for preview -> import flow
// Run with: RUN_WITHDRAWALS_IT=1 TEST_COOKIE="mp_session=..." node test/withdrawals.integration.test.ts

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpJsonResponse<T> {
  status: number;
  json: T | null;
  headers: http.IncomingHttpHeaders;
}

function request<TResponse = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<HttpJsonResponse<TResponse>> {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request(
      new URL(path, BASE_URL),
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data ? String(data.length) : "0",
          Accept: "application/json",
          ...(process.env.TEST_COOKIE ? { Cookie: process.env.TEST_COOKIE } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          let parsed: unknown = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, json: parsed as TResponse | null, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const runWithdrawalsIntegrationTests = process.env.RUN_WITHDRAWALS_IT === "1";

describe.runIf(runWithdrawalsIntegrationTests)("withdrawals integration tests", () => {
  it("allows preview/import with idempotent results", async () => {
    const uniqueId = `test-withdraw-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const previewBefore = await request("POST", "/api/transactions/withdrawals/preview", { ids: [uniqueId] });
    expect(previewBefore.status).toBe(200);
    const existing = (previewBefore.json as { existing?: Record<string, unknown> })?.existing ?? {};
    expect(existing[uniqueId]).toBeUndefined();

    const payout = {
      withdrawId: uniqueId,
      dateCreated: new Date().toISOString(),
      status: "PAID",
      statusDetail: null,
      amount: 1000,
      fee: 10,
      activityUrl: null,
      payoutDesc: "Integration test payout",
      bankAccountHolder: "Test User",
      identificationType: null,
      identificationNumber: null,
      bankId: null,
      bankName: "Banco de Prueba",
      bankBranch: null,
      bankAccountType: "RUT",
      bankAccountNumber: "11111111",
      raw: { test: "data" },
    };

    const importResp = await request("POST", "/api/transactions/withdrawals/import", { payouts: [payout] });
    expect(importResp.status).toBe(200);
    const summary1 = importResp.json as {
      status?: string;
      total?: number;
      inserted?: number;
      updated?: number;
      skipped?: number;
    };
    expect(summary1.status).toBe("ok");
    expect(summary1.total).toBe(1);
    expect(summary1.inserted! + (summary1.updated ?? 0) + (summary1.skipped ?? 0)).toBe(1);

    const importResp2 = await request("POST", "/api/transactions/withdrawals/import", { payouts: [payout] });
    expect(importResp2.status).toBe(200);
    const summary2 = importResp2.json as typeof summary1;
    expect(summary2.total).toBe(1);
    expect(summary2.inserted! <= (summary1.inserted ?? 1)).toBe(true);
    expect(summary2.inserted! + (summary2.updated ?? 0) + (summary2.skipped ?? 0)).toBe(1);
  });
});
