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

// compliance.js does `const pool = require('../config/database')` then
// calls pool.connect() for transactions and pool.query() for reads.
// pool.query() maps to mockQuery via the factory above.
// pool.connect() needs to be wired up manually.
const db = require('../../config/database');
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

function resetConnectMock() {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
  db.connect = jest.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  });
}

// ---------------------------------------------------------------------------
// POST /api/compliance/sign-contract
// ---------------------------------------------------------------------------
describe('POST /api/compliance/sign-contract', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/compliance/sign-contract');
    expect(res.status).toBe(401);
  });

  it('should return 400 when signature or acknowledgments are missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/compliance/sign-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractType: 'service_agreement' }); // missing signature & acknowledgments

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('firma');
  });

  it('should return 400 when signature does not match user full name', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // inner SELECT users
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ first_name: 'Client', last_name: 'User', email: 'client@test.com' }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/compliance/sign-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractType: 'service_agreement',
        signature: 'Wrong Name',
        acknowledgments: { terms: true },
        signedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('firma');
  });

  it('should return 404 when user is not found in the inner lookup', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // inner SELECT users — empty
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/compliance/sign-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractType: 'service_agreement',
        signature: 'Client User',
        acknowledgments: { terms: true },
        signedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 200 and sign the contract successfully', async () => {
    const token = generateTestToken(testUsers.client.id);
    const signedAt = new Date().toISOString();

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT users (verify name)
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ first_name: 'Client', last_name: 'User', email: 'client@test.com' }],
      rowCount: 1,
    });
    // 2. BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 3. INSERT client_contracts RETURNING
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'contract-1', cancellation_deadline: '2026-02-11T00:00:00.000Z' }],
      rowCount: 1,
    });
    // 4. INSERT consumer_rights_acknowledgments
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 5. INSERT compliance_events
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 6. COMMIT
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/compliance/sign-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractType: 'service_agreement',
        signature: 'Client User',
        acknowledgments: { terms: true, privacy: true },
        signedAt,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contractId).toBe('contract-1');
    expect(res.body.data.cancellationDeadline).toBeDefined();
    expect(mockRelease).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/compliance/acknowledge-rights
// ---------------------------------------------------------------------------
describe('POST /api/compliance/acknowledge-rights', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 200 and record the rights acknowledgment', async () => {
    const token = generateTestToken(testUsers.client.id);
    const acknowledgedAt = new Date().toISOString();

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 2. INSERT/UPSERT consumer_rights_acknowledgments RETURNING id
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'ack-1' }], rowCount: 1 });
    // 3. INSERT compliance_events
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 4. COMMIT
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/compliance/acknowledge-rights')
      .set('Authorization', `Bearer ${token}`)
      .send({ acknowledgedAt, rightsVersion: '1.0', acknowledgments: { understood: true } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.acknowledgmentId).toBe('ack-1');
    expect(mockRelease).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/compliance/acknowledge-fees
// ---------------------------------------------------------------------------
describe('POST /api/compliance/acknowledge-fees', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 200 and record the fee disclosure acknowledgment', async () => {
    const token = generateTestToken(testUsers.client.id);
    const acknowledgedAt = new Date().toISOString();

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 2. INSERT fee_disclosures RETURNING id
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'fee-1' }], rowCount: 1 });
    // 3. INSERT compliance_events
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 4. COMMIT
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/compliance/acknowledge-fees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planType: 'premium',
        totalAmount: 149.99,
        paymentSchedule: 'monthly',
        acknowledgments: { feesUnderstood: true },
        acknowledgedAt,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.disclosureId).toBe('fee-1');
    expect(mockRelease).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/compliance/status
// ---------------------------------------------------------------------------
describe('GET /api/compliance/status', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/compliance/status');
    expect(res.status).toBe(401);
  });

  it('should return 200 with full compliance status', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT client_contracts
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'c-1',
        contract_type: 'service_agreement',
        signed_date: '2026-02-01',
        signed_at: '2026-02-01T12:00:00Z',
        effective_date: '2026-02-01',
        cancellation_deadline: '2026-02-04T00:00:00Z',
        status: 'active',
        cancelled_at: null,
      }],
      rowCount: 1,
    });
    // 2. SELECT consumer_rights_acknowledgments
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ack-1', acknowledged_at: '2026-02-01T12:00:00Z', version: '1.0' }],
      rowCount: 1,
    });
    // 3. SELECT fee_disclosures
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'fee-1', plan_type: 'premium', total_cost: 149.99, acknowledged_at: '2026-02-01T12:30:00Z' }],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/compliance/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isCompliant).toBe(true);
    expect(res.body.data.contract).toBeDefined();
    expect(res.body.data.rightsAcknowledgment).toBeDefined();
    expect(res.body.data.feeDisclosure).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/compliance/events
// ---------------------------------------------------------------------------
describe('GET /api/compliance/events', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 200 with compliance events for a non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT role FROM users
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'client' }], rowCount: 1 });
    // 2. SELECT compliance_events WHERE user_id
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ev-1', event_type: 'contract_signed', compliance_law: 'CROA', created_at: '2026-02-01' },
      ],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/compliance/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/compliance/cancel-contract
// ---------------------------------------------------------------------------
describe('POST /api/compliance/cancel-contract', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 404 when contract is not found', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT client_contracts — empty
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/compliance/cancel-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractId: 'nonexistent', reason: 'Test' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('should return 400 when contract is no longer active', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT client_contracts — cancelled
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'c-1', client_id: testUsers.client.id, status: 'cancelled', cancellation_deadline: '2026-01-10' }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/compliance/cancel-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractId: 'c-1', reason: 'Want to cancel again' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('should return 200 and cancel the contract successfully', async () => {
    const token = generateTestToken(testUsers.client.id);
    const futureDeadline = new Date();
    futureDeadline.setDate(futureDeadline.getDate() + 2);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 1. SELECT client_contracts — active, within cancellation window
    mockClientQuery.mockResolvedValueOnce({
      rows: [{
        id: 'c-1',
        client_id: testUsers.client.id,
        status: 'active',
        cancellation_deadline: futureDeadline.toISOString(),
      }],
      rowCount: 1,
    });
    // 2. BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 3. UPDATE client_contracts
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 4. INSERT cancellation_requests
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 5. INSERT compliance_events
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 6. COMMIT
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/compliance/cancel-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractId: 'c-1', reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contractId).toBe('c-1');
    expect(res.body.data.withinCancellationPeriod).toBe(true);
    expect(res.body.data.refundEligible).toBe(true);
    expect(mockRelease).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/compliance/contract/:contractId/download
// ---------------------------------------------------------------------------
describe('GET /api/compliance/contract/:contractId/download', () => {
  beforeEach(() => { jest.clearAllMocks(); resetConnectMock(); });

  it('should return 404 when contract is not found', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // SELECT client_contracts JOIN users — empty
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/compliance/contract/nonexistent/download')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 200 with contract data for download', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // SELECT client_contracts JOIN users
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'c-1',
        first_name: 'Client',
        last_name: 'User',
        email: 'client@test.com',
        contract_type: 'service_agreement',
        signed_at: '2026-02-01T12:00:00Z',
        signed_date: '2026-02-01',
        effective_date: '2026-02-01',
        cancellation_deadline: '2026-02-04',
        digital_signature: 'Client User',
        acknowledgments: '{"terms":true}',
        status: 'active',
      }],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/compliance/contract/c-1/download')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contractId).toBe('c-1');
    expect(res.body.data.clientName).toBe('Client User');
    expect(res.body.data.contractType).toBe('service_agreement');
    expect(res.body.data.digitalSignature).toBe('Client User');
  });
});
