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

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const CLIENT_ID = testUsers.client.id;
const OTHER_CLIENT_ID = 'a0000000-0000-0000-0000-000000000099';

// Helper: mock the 5 parallel queries that the client dashboard handler runs
function mockClientDashboardQueries() {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ bureau: 'experian', score: 720 }] })       // scores
    .mockResolvedValueOnce({ rows: [{ status: 'identified', count: '3' }] })      // items
    .mockResolvedValueOnce({ rows: [{ status: 'pending', count: '2' }] })         // disputes
    .mockResolvedValueOnce({ rows: [] })                                           // activity
    .mockResolvedValueOnce({ rows: [] });                                          // improvement
}

// Helper: mock the 6 parallel queries that the admin stats handler runs
function mockAdminStatsQueries() {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ total: '25' }] })                           // clients count
    .mockResolvedValueOnce({ rows: [{ active: '10' }] })                          // active subs
    .mockResolvedValueOnce({ rows: [{ status: 'pending', count: '5' }] })         // disputes by status
    .mockResolvedValueOnce({ rows: [{ revenue: '4500.00' }] })                    // monthly revenue
    .mockResolvedValueOnce({ rows: [{ id: 'u1', first_name: 'John', last_name: 'Doe', email: 'j@t.com', created_at: '2026-01-01', subscription_status: 'active' }] }) // recent clients
    .mockResolvedValueOnce({ rows: [] });                                          // revenue trend
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/client/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/client/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/dashboard/client/${CLIENT_ID}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when a client tries to access another client dashboard', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 }); // auth

    const res = await request(app)
      .get(`/api/dashboard/client/${OTHER_CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 when a client accesses their own dashboard', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 }); // auth
    mockClientDashboardQueries();

    const res = await request(app)
      .get(`/api/dashboard/client/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.currentScores).toEqual([{ bureau: 'experian', score: 720 }]);
    expect(res.body.data.itemsSummary).toEqual([{ status: 'identified', count: '3' }]);
    expect(res.body.data.disputesSummary).toEqual([{ status: 'pending', count: '2' }]);
    expect(res.body.data.recentActivity).toEqual([]);
    expect(res.body.data.scoreImprovement).toEqual([]);
  });

  it('should return 200 when admin accesses any client dashboard', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockClientDashboardQueries();

    const res = await request(app)
      .get(`/api/dashboard/client/${OTHER_CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.currentScores).toBeDefined();
  });

  it('should return 200 when staff accesses any client dashboard', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 }); // auth
    mockClientDashboardQueries();

    const res = await request(app)
      .get(`/api/dashboard/client/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.currentScores).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/admin/stats
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/admin/stats', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when a client tries to access admin stats', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 }); // auth

    const res = await request(app)
      .get('/api/dashboard/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 for admin on admin stats', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockAdminStatsQueries();

    const res = await request(app)
      .get('/api/dashboard/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.totalClients).toBe(25);
    expect(res.body.data.activeSubscriptions).toBe(10);
    expect(res.body.data.monthlyRevenue).toBe(4500);
    expect(res.body.data.recentClients).toHaveLength(1);
    expect(res.body.data.disputesByStatus).toBeDefined();
    expect(res.body.data.revenueTrend).toEqual([]);
  });

  it('should return 200 for staff on admin stats', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 }); // auth
    mockAdminStatsQueries();

    const res = await request(app)
      .get('/api/dashboard/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.totalClients).toBe(25);
  });
});
