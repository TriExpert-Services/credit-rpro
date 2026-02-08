/**
 * Integration tests for Company Settings routes
 * GET  /api/company
 * PUT  /api/company
 */

require('../helpers/env');

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: (...args) => mockQuery(...args),
  transaction: (...args) => mockTransaction(...args),
  getPoolStats: jest.fn().mockReturnValue({}),
}));

jest.mock('../../utils/auditLogger', () => ({
  auditMiddleware: () => (req, res, next) => next(),
  recordAudit: jest.fn(),
  auditFromRequest: jest.fn(),
  AUDIT_ACTIONS: {},
  getAuditLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
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

const CLIENT_ID = 'a0000000-0000-4000-a000-000000000003';
const COMPANY_ID = 'c0000000-0000-4000-a000-000000000050';

const mockClientUser = { ...testUsers.client, id: CLIENT_ID };

// ---------------------------------------------------------------------------
// GET /api/company
// ---------------------------------------------------------------------------
describe('GET /api/company', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/company');
    expect(res.status).toBe(401);
  });

  it('should return default profile when no company exists', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no company profile

    const res = await request(app)
      .get('/api/company')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.company_name).toBe('Credit Repair Pro');
  });

  it('should return existing company profile', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: COMPANY_ID,
        company_name: 'Test Corp',
        email: 'info@test.com',
        phone: '555-0100',
      }],
    });

    const res = await request(app)
      .get('/api/company')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.company_name).toBe('Test Corp');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/company
// ---------------------------------------------------------------------------
describe('PUT /api/company', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .put('/api/company')
      .send({ company_name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin users', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth

    const res = await request(app)
      .put('/api/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Test Corp' });

    expect(res.status).toBe(403);
  });

  it('should return 400 when company_name is missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth

    const res = await request(app)
      .put('/api/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: '' });

    expect(res.status).toBe(400);
  });

  it('should create company profile when none exists', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing profile
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: COMPANY_ID,
        company_name: 'New Corp',
        email: 'info@new.com',
      }],
    }); // insert result

    const res = await request(app)
      .put('/api/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'New Corp', email: 'info@new.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.company_name).toBe('New Corp');
  });

  it('should update existing company profile', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [{ id: COMPANY_ID }] }); // existing profile
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: COMPANY_ID,
        company_name: 'Updated Corp',
        phone: '555-9999',
        address_city: 'Miami',
      }],
    }); // update result

    const res = await request(app)
      .put('/api/company')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company_name: 'Updated Corp',
        phone: '555-9999',
        address_city: 'Miami',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.company_name).toBe('Updated Corp');
    expect(res.body.data.profile.address_city).toBe('Miami');
  });

  it('should allow staff to view but not edit', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 }); // auth

    const res = await request(app)
      .put('/api/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Staff Edit' });

    expect(res.status).toBe(403);
  });
});
