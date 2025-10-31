import assert from "node:assert/strict";
import http from "node:http";

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
          'Content-Type': 'application/json',
          'Content-Length': data ? String(data.length) : '0',
          'Accept': 'application/json',
          ...(process.env.TEST_COOKIE ? { Cookie: process.env.TEST_COOKIE } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
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
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  if (process.env.RUN_WITHDRAWALS_IT !== '1') {
    console.log('Skipping withdrawals integration tests. Set RUN_WITHDRAWALS_IT=1 to run.');
    return;
  }

  // Use a unique withdrawId to avoid collisions
  const uniqueId = `test-withdraw-${Date.now()}-${Math.floor(Math.random()*10000)}`;

  // Preview: should be empty
  const previewBefore = await request('POST', '/api/transactions/withdrawals/preview', { ids: [uniqueId] });
  assert.equal(previewBefore.status, 200);
  const existing = (previewBefore.json as any)?.existing ?? {};
  assert.ok(existing[uniqueId] === undefined || existing[uniqueId] === null);

  // Import: create one payout
  const payout = {
    withdrawId: uniqueId,
    dateCreated: new Date().toISOString(),
    status: 'PAID',
    statusDetail: null,
    amount: 1000,
    fee: 10,
    activityUrl: null,
    payoutDesc: 'Integration test payout',
    bankAccountHolder: 'Test User',
    identificationType: null,
    identificationNumber: null,
    bankId: null,
    bankName: 'Banco de Prueba',
    bankBranch: null,
    bankAccountType: 'RUT',
    bankAccountNumber: '11111111',
    raw: { test: 'data' },
  };

  const importResp = await request('POST', '/api/transactions/withdrawals/import', { payouts: [payout] });
  assert.equal(importResp.status, 200);
  assert.equal((importResp.json as any)?.status, 'ok');
  const summary1 = importResp.json as any;
  assert.equal(summary1.total, 1);
  assert.equal(summary1.inserted + summary1.updated + (summary1.skipped ?? 0), 1);

  // Re-import identical payload: should not insert again; check that totals still add up
  const importResp2 = await request('POST', '/api/transactions/withdrawals/import', { payouts: [payout] });
  assert.equal(importResp2.status, 200);
  const summary2 = importResp2.json as any;
  assert.equal(summary2.total, 1);
  // inserted should be <= previous inserted
  assert.ok(summary2.inserted <= (summary1.inserted ?? 1));
  assert.equal(summary2.inserted + summary2.updated + (summary2.skipped ?? 0), 1);

  console.log('Preview->Import integration test completed successfully');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
