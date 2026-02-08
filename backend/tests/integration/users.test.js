/**
 * Integration Tests — Users Routes (/api/users)
 *
 * Tests for profile retrieval, profile update, user listing, and user deletion.
 * Database is mocked so no real PostgreSQL connection is needed.
 */

// ── Module mocks ────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: (...args) => mockQuery(...args),
  transaction: (...args) => mockTransaction(...args),
  getPoolStats: jest.fn().mockReturnValue({}),
}));

jest.mock('../../utils/auditLogger', () => ({
  AUDIT_ACTIONS: {
    LOGIN_FAILED: 'login_failed',
    LOGIN_SUCCESS: 'login_success',
    USER_REGISTERED: 'user_registered',
    USER_DELETED: 'user.deleted',
  },
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

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/users/profile
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/users/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user profile for authenticated user', async () => {
    const token = generateTestToken(testUsers.client.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // Route query: user LEFT JOIN client_profiles
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ...testUsers.client,
        date_of_birth: '1990-01-15',
        address_line1: '123 Main St',
        city: 'Miami',
        state: 'FL',
        zip_code: '33101',
        subscription_status: 'active',
      }],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUsers.client.email);
    expect(res.body.data.user.city).toBe('Miami');
  });

  it('returns 404 when user profile is not found in DB', async () => {
    const token = generateTestToken(testUsers.client.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // Route query returns no rows
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('works for admin users too', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // Route query
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...testUsers.admin, subscription_status: null }],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/users/profile
// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/users/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .send({ firstName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and updates profile for a client user', async () => {
    const token = generateTestToken(testUsers.client.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // Update users table
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Update client_profiles table (client role triggers this)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Updated',
        lastName: 'Client',
        phone: '3051234567',
        city: 'Orlando',
        state: 'FL',
        zipCode: '32801',
      });

    expect(res.status).toBe(200);
    // Verify the users UPDATE was called
    expect(mockQuery).toHaveBeenCalledTimes(3); // auth + users update + client_profiles update
  });

  it('returns 200 and updates profile for an admin (no client_profiles update)', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // Update users table only (admin role does NOT trigger client_profiles update)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'AdminUpdated' });

    expect(res.status).toBe(200);
    // Auth + users update = 2 queries (no client_profiles)
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/users
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/users', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 when a client tries to list users', async () => {
    const token = generateTestToken(testUsers.client.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated users for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    const usersList = [testUsers.admin, testUsers.staff, testUsers.client];

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // Main query: user list
    mockQuery.mockResolvedValueOnce({ rows: usersList, rowCount: usersList.length });
    // Count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(3);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.limit).toBeDefined();
    expect(res.body.data.offset).toBeDefined();
  });

  it('returns 200 with paginated users for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // Main query
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/users?role=client&limit=10&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.limit).toBe(10);
    expect(res.body.data.offset).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/users/:id
// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/users/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  const targetUser = {
    id: 'b0000000-0000-0000-0000-000000000099',
    email: 'victim@test.com',
    first_name: 'Target',
    last_name: 'User',
    role: 'client',
    status: 'active',
  };

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/api/users/${targetUser.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when a client tries to delete a user', async () => {
    const token = generateTestToken(testUsers.client.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 when staff tries to delete a user (admin only)', async () => {
    const token = generateTestToken(testUsers.staff.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when admin tries to delete themselves', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/users/${testUsers.admin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 when target user does not exist', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // SELECT target user → not found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to delete another admin', async () => {
    const otherAdmin = {
      id: 'c0000000-0000-0000-0000-000000000077',
      email: 'otheradmin@test.com',
      first_name: 'Other',
      last_name: 'Admin',
      role: 'admin',
      status: 'active',
    };

    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // SELECT target user → found, but it's an admin
    mockQuery.mockResolvedValueOnce({ rows: [otherAdmin], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/users/${otherAdmin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 and soft-deletes user with cascaded data', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // Auth middleware lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // SELECT target user
    mockQuery.mockResolvedValueOnce({ rows: [targetUser], rowCount: 1 });
    // Soft delete user
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Cascade soft deletes (6 Promise.all queries)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // credit_items
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // disputes
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // documents
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // payments
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // invoices
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // notifications

    const res = await request(app)
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedUser).toBeDefined();
    expect(res.body.data.deletedUser.id).toBe(targetUser.id);
    expect(res.body.data.deletedUser.email).toBe(targetUser.email);
  });
});
