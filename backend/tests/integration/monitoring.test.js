const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: (...args) => mockQuery(...args),
  transaction: (...args) => mockTransaction(...args),
  getPoolStats: jest.fn().mockReturnValue({}),
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

// Mock healthCheck
const mockHealthCheck = {
  runHealthChecks: jest.fn(),
  livenessProbe: jest.fn(),
  readinessProbe: jest.fn(),
};
jest.mock('../../utils/healthCheck', () => mockHealthCheck);

// Mock apm middleware
const mockApm = {
  apmMiddleware: jest.fn((req, res, next) => next()),
  getMetrics: jest.fn(),
  resetMetrics: jest.fn(),
};
jest.mock('../../middleware/apm', () => mockApm);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const { getAuditLogs } = require('../../utils/auditLogger');

// ---------------------------------------------------------------------------
// GET /api/monitoring/liveness
// ---------------------------------------------------------------------------
describe('GET /api/monitoring/liveness', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 200 with alive status (no auth required)', async () => {
    mockHealthCheck.livenessProbe.mockReturnValue({
      status: 'alive',
      timestamp: '2025-01-01T00:00:00.000Z',
      uptime: 100,
    });

    const res = await request(app).get('/api/monitoring/liveness');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/readiness
// ---------------------------------------------------------------------------
describe('GET /api/monitoring/readiness', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 200 when ready', async () => {
    mockHealthCheck.readinessProbe.mockResolvedValue({
      status: 'ready',
      timestamp: '2025-01-01T00:00:00.000Z',
      database: 'healthy',
    });

    const res = await request(app).get('/api/monitoring/readiness');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('should return 503 when not ready', async () => {
    mockHealthCheck.readinessProbe.mockResolvedValue({
      status: 'not_ready',
      timestamp: '2025-01-01T00:00:00.000Z',
      database: 'unhealthy',
    });

    const res = await request(app).get('/api/monitoring/readiness');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
  });
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/health
// ---------------------------------------------------------------------------
describe('GET /api/monitoring/health', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/monitoring/health');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/monitoring/health')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return health for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockHealthCheck.runHealthChecks.mockResolvedValue({
      status: 'healthy',
      timestamp: '2025-01-01T00:00:00.000Z',
      checks: { database: { status: 'healthy' } },
      system: {},
    });

    const res = await request(app)
      .get('/api/monitoring/health')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/metrics
// ---------------------------------------------------------------------------
describe('GET /api/monitoring/metrics', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/monitoring/metrics');
    expect(res.status).toBe(401);
  });

  it('should return 403 for staff user', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .get('/api/monitoring/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return metrics for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockApm.getMetrics.mockReturnValue({
      totalRequests: 100,
      avgLatency: 45,
      errorRate: 0.02,
    });

    const res = await request(app)
      .get('/api/monitoring/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalRequests).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// POST /api/monitoring/metrics/reset
// ---------------------------------------------------------------------------
describe('POST /api/monitoring/metrics/reset', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for client user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/monitoring/metrics/reset')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should reset metrics for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/monitoring/metrics/reset')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Metrics reset successfully');
    expect(mockApm.resetMetrics).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/audit-logs
// ---------------------------------------------------------------------------
describe('GET /api/monitoring/audit-logs', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/monitoring/audit-logs');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .get('/api/monitoring/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return audit logs for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    getAuditLogs.mockResolvedValue({ rows: [{ id: 'a1', action: 'login' }], total: 1 });

    const res = await request(app)
      .get('/api/monitoring/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('should pass query filters to getAuditLogs', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    getAuditLogs.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/api/monitoring/audit-logs?userId=u1&action=login&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', action: 'login', limit: '5' })
    );
  });
});
