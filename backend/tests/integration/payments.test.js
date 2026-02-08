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
// GET /api/payments/client/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/payments/client/:clientId', () => {
  beforeEach(() => jest.clearAllMocks());

  const clientId = testUsers.client.id;
  const otherClientId = 'c0000000-0000-0000-0000-000000000099';

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/payments/client/${clientId}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 with payments for own client', async () => {
    const token = generateTestToken(testUsers.client.id);
    const paymentRows = [
      {
        id: 'p0000000-0000-4000-a000-000000000001',
        client_id: clientId,
        amount: '99.99',
        payment_method: 'credit_card',
        payment_status: 'completed',
        description: 'Monthly fee',
        payment_date: '2026-01-15T00:00:00Z',
        created_at: '2026-01-15T00:00:00Z',
      },
    ];
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // SELECT payments
    mockQuery.mockResolvedValueOnce({ rows: paymentRows, rowCount: 1 });
    // COUNT query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

    const res = await request(app)
      .get(`/api/payments/client/${clientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0].amount).toBe('99.99');
    expect(res.body.data.total).toBe(1);
  });

  it('should return 403 when client accesses another clients payments', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get(`/api/payments/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('should return 200 when admin accesses any client payments', async () => {
    const token = generateTestToken(testUsers.admin.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // SELECT payments
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // COUNT query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

    const res = await request(app)
      .get(`/api/payments/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.payments).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('should return 200 when staff accesses any client payments', async () => {
    const token = generateTestToken(testUsers.staff.id);
    const paymentRows = [
      {
        id: 'p0000000-0000-4000-a000-000000000002',
        client_id: otherClientId,
        amount: '49.99',
        payment_method: 'bank_transfer',
        payment_status: 'completed',
        description: 'Setup fee',
        payment_date: '2026-02-01T00:00:00Z',
        created_at: '2026-02-01T00:00:00Z',
      },
    ];
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // SELECT payments
    mockQuery.mockResolvedValueOnce({ rows: paymentRows, rowCount: 1 });
    // COUNT query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

    const res = await request(app)
      .get(`/api/payments/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.payments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/payments
// ---------------------------------------------------------------------------
describe('POST /api/payments', () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    clientId: 'c0000000-0000-4000-a000-000000000010',
    amount: 99.99,
    paymentMethod: 'credit_card',
    description: 'Monthly service fee',
  };

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/payments').send(validPayload);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when client tries to create a payment', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 201 when staff creates a payment', async () => {
    const token = generateTestToken(testUsers.staff.id);
    const paymentRow = {
      id: 'p0000000-0000-4000-a000-000000000010',
      client_id: validPayload.clientId,
      amount: '99.99',
      payment_method: 'credit_card',
      payment_status: 'completed',
      description: 'Monthly service fee',
      payment_date: '2026-02-08T00:00:00Z',
      created_at: '2026-02-08T00:00:00Z',
    };
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // INSERT returning
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.payment.id).toBe(paymentRow.id);
    expect(res.body.message).toMatch(/recorded/i);
  });

  it('should return 201 when admin creates a payment', async () => {
    const token = generateTestToken(testUsers.admin.id);
    const paymentRow = {
      id: 'p0000000-0000-4000-a000-000000000011',
      client_id: validPayload.clientId,
      amount: '99.99',
      payment_method: 'credit_card',
      payment_status: 'completed',
      description: 'Monthly service fee',
      payment_date: '2026-02-08T00:00:00Z',
      created_at: '2026-02-08T00:00:00Z',
    };
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // INSERT returning
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toBeDefined();
  });

  it('should return 400 when required fields are missing', async () => {
    const token = generateTestToken(testUsers.staff.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when amount is missing', async () => {
    const token = generateTestToken(testUsers.staff.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: validPayload.clientId, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
