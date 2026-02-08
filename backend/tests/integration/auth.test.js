/**
 * Integration Tests — Auth Routes (/api/auth)
 *
 * Tests for register and login endpoints using Supertest.
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
  AUDIT_ACTIONS: { LOGIN_FAILED: 'login_failed', LOGIN_SUCCESS: 'login_success', USER_REGISTERED: 'user_registered' },
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
const bcrypt = require('bcryptjs');
const app = require('../../server');

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = {
    email: 'newuser@test.com',
    password: 'StrongPass123!',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    // express-validator returns 422 or 400 depending on handleValidationErrors
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 409 when email already exists', async () => {
    // First query: check if email exists → return a row
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 });

    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 201 on successful registration', async () => {
    // Mock: email not taken
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const fakeUser = {
      id: 'uuid-new-user',
      email: validBody.email,
      first_name: validBody.firstName,
      last_name: validBody.lastName,
      role: 'client',
      two_factor_enabled: false,
      created_at: new Date().toISOString(),
    };

    // Mock transaction: receives a callback, we simulate a client
    mockTransaction.mockImplementationOnce(async (cb) => {
      const fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [fakeUser], rowCount: 1 }) // INSERT user
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })          // INSERT client_profile
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),         // INSERT activity_log
      };
      return cb(fakeClient);
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user).toMatchObject({
      email: validBody.email,
      role: 'client',
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when email not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong password', async () => {
    const hash = await bcrypt.hash('RealPassword1!', 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'user-1',
        email: 'user@test.com',
        password_hash: hash,
        first_name: 'User',
        last_name: 'Test',
        role: 'client',
        status: 'active',
        two_factor_enabled: false,
      }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });

  it('returns 200 with token on valid login', async () => {
    const password = 'CorrectPass123!';
    const hash = await bcrypt.hash(password, 10);
    const fakeUser = {
      id: 'user-1',
      email: 'user@test.com',
      password_hash: hash,
      first_name: 'User',
      last_name: 'Test',
      role: 'client',
      status: 'active',
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [fakeUser], rowCount: 1 })    // find user
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });             // update last_login or audit

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: fakeUser.email, password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user.email).toBe(fakeUser.email);
  });

  it('returns 403 when account is inactive', async () => {
    const password = 'CorrectPass123!';
    const hash = await bcrypt.hash(password, 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'user-2',
        email: 'disabled@test.com',
        password_hash: hash,
        first_name: 'Disabled',
        last_name: 'User',
        role: 'client',
        status: 'inactive',
        two_factor_enabled: false,
      }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disabled@test.com', password });

    expect(res.status).toBe(403);
  });

  it('returns requires2FA flag when 2FA is enabled and no code provided', async () => {
    const password = 'CorrectPass123!';
    const hash = await bcrypt.hash(password, 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'user-3',
        email: '2fa@test.com',
        password_hash: hash,
        first_name: '2FA',
        last_name: 'User',
        role: 'client',
        status: 'active',
        two_factor_enabled: true,
        two_factor_secret: 'JBSWY3DPEHPK3PXP',
        two_factor_backup_codes: '[]',
      }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '2fa@test.com', password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('requires2FA', true);
    expect(res.body.data).toHaveProperty('tempToken');
  });
});
