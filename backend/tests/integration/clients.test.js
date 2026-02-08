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

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------
describe('GET /api/clients', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 for a client role user', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 with clients list for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);

    const clientRows = [
      {
        id: 'c0000000-0000-0000-0000-000000000010',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '555-1234',
        created_at: '2025-01-01T00:00:00Z',
        subscription_status: 'active',
        subscription_start_date: '2025-01-01',
        monthly_fee: 99.99,
        total_items: '3',
        total_disputes: '1',
      },
      {
        id: 'c0000000-0000-0000-0000-000000000011',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '555-5678',
        created_at: '2025-02-15T00:00:00Z',
        subscription_status: 'pending',
        subscription_start_date: null,
        monthly_fee: 49.99,
        total_items: '0',
        total_disputes: '0',
      },
    ];

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: clientRows, rowCount: clientRows.length });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(2);
    expect(res.body.clients[0]).toHaveProperty('email', 'john@example.com');
    expect(res.body.clients[1]).toHaveProperty('subscription_status', 'pending');
  });

  it('should return 200 with clients list for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);

    const clientRows = [
      {
        id: 'c0000000-0000-0000-0000-000000000010',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '555-1234',
        created_at: '2025-01-01T00:00:00Z',
        subscription_status: 'active',
        subscription_start_date: '2025-01-01',
        monthly_fee: 99.99,
        total_items: '5',
        total_disputes: '2',
      },
    ];

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: clientRows, rowCount: clientRows.length });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
    expect(res.body.clients[0]).toHaveProperty('total_items', '5');
  });

  it('should return 200 with empty array when no clients exist', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // route query – no clients
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clients).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/clients/:id
// ---------------------------------------------------------------------------
describe('GET /api/clients/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  const clientId = 'c0000000-0000-0000-0000-000000000010';

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/clients/${clientId}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 with client details for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);

    const clientRow = {
      id: clientId,
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'client',
      status: 'active',
      subscription_status: 'active',
      monthly_fee: 99.99,
    };

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [clientRow], rowCount: 1 });

    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.client).toBeDefined();
    expect(res.body.client.email).toBe('john@example.com');
    expect(res.body.client.monthly_fee).toBe(99.99);
  });

  it('should return 200 for a client user viewing details', async () => {
    const token = generateTestToken(testUsers.client.id);

    const clientRow = {
      id: clientId,
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'client',
      status: 'active',
      subscription_status: 'active',
      monthly_fee: 49.99,
    };

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [clientRow], rowCount: 1 });

    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.client).toBeDefined();
    expect(res.body.client.id).toBe(clientId);
  });

  it('should return 404 when client is not found', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // route query – no rows
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Client not found');
  });

  it('should return 200 for staff viewing client details', async () => {
    const token = generateTestToken(testUsers.staff.id);

    const clientRow = {
      id: clientId,
      email: 'staff-viewed@example.com',
      first_name: 'Viewed',
      last_name: 'Client',
      role: 'client',
      status: 'active',
      subscription_status: 'active',
      monthly_fee: 79.99,
    };

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [clientRow], rowCount: 1 });

    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.client.email).toBe('staff-viewed@example.com');
  });
});
