/**
 * Integration Tests — Health & Root endpoints
 *
 * These are the simplest integration tests: no auth or DB mocking required
 * since /health and / don't touch the database directly.
 *
 * We mock config/database to prevent real PG connections.
 */

// ── Module mocks (before require) ───────────────────────────────────────────
jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  transaction: jest.fn(),
  getPoolStats: jest.fn().mockReturnValue({ totalCount: 0, idleCount: 0, waitingCount: 0 }),
}));

jest.mock('../../utils/auditLogger', () => ({
  AUDIT_ACTIONS: {},
  recordAudit: jest.fn().mockResolvedValue(undefined),
  auditMiddleware: () => (req, res, next) => next(),
  auditFromRequest: jest.fn().mockResolvedValue(undefined),
  getAuditLogs: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../../utils/sentry', () => ({
  initSentry: jest.fn(),
  sentryErrorHandler: () => (err, req, res, next) => next(err),
  captureError: jest.fn(),
  captureMessage: jest.fn(),
  Sentry: {},
}));

const request = require('supertest');
const app = require('../../server');

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  it('returns 200 with OK status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
    // timestamp should be a valid ISO string
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});

describe('GET /', () => {
  it('returns API info', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: expect.stringContaining('Credit Repair'),
      version: expect.any(String),
      status: 'running',
    });
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Endpoint not found');
  });
});
