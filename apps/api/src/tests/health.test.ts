import { describe, expect, it, vi } from 'vitest';
import app from '../app';

// Mock the database to strictly prevent any accidental connections
// even though this test shouldn't touch them.
vi.mock('@finanzas/db', () => ({
  authDb: {},
  schema: {},
}));

describe('API Health Check', () => {
  it('GET /health should return 200 OK', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/health should return 200 OK', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
