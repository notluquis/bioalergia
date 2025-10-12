import assert from "node:assert/strict";
import http from "node:http";

// Minimal integration test harness using http requests to the running dev server
// Note: Requires server to be running locally on :4000 with valid session cookie.
// To keep it safe for CI-less env, this test only runs when RUN_EMPLOYEE_IT=1.

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
          // NOTE: requires an authenticated cookie in TEST_COOKIE for protected routes
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
  if (process.env.RUN_EMPLOYEE_IT !== '1') {
    console.log('Skipping employees integration tests. Set RUN_EMPLOYEE_IT=1 to run.');
    return;
  }

  // Create
  const payload = {
    full_name: 'Test User ' + Date.now(),
    role: 'Tester',
    email: null,
    rut: '12.345.678-5',
    bank_name: 'BancoEstado',
    bank_account_type: 'RUT',
    bank_account_number: '12345678',
    hourly_rate: 5000,
    overtime_rate: null,
    retention_rate: 0.145,
  };

  interface CreateEmployeeResponse {
    status: string;
    employee?: { id: number };
    message?: string;
  }

  const created = await request<CreateEmployeeResponse>('POST', '/api/employees', payload);
  assert.equal(created.status, 201, 'create should return 201');
  assert.equal(created.json?.status, 'ok');
  const id = created.json?.employee?.id;
  assert.ok(id, 'created employee id');

  // Update
  interface UpdateEmployeeResponse {
    status: string;
    employee?: { bank_account_number?: string };
    message?: string;
  }

  const updated = await request<UpdateEmployeeResponse>('PUT', `/api/employees/${id}`, { bank_account_number: '99999999' });
  assert.equal(updated.status, 200);
  assert.equal(updated.json?.employee?.bank_account_number, '99999999');

  // List
  interface ListEmployeesResponse {
    status: string;
    employees?: Array<{ id: number; bank_name?: string }>;
    message?: string;
  }

  const list = await request<ListEmployeesResponse>('GET', '/api/employees');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.json?.employees));
  const found = list.json?.employees?.find((employee) => employee.id === id);
  assert.ok(found, 'employee should be in list');
  assert.equal(found.bank_name, 'BancoEstado');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
