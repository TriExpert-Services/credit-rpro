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

// RFC4122-compliant UUIDs (version 4 format required by validators)
const CLIENT_ID = 'a0000000-0000-4000-a000-000000000003';
const OTHER_CLIENT_ID = 'b0000000-0000-4000-a000-000000000099';
const DISPUTE_ID = 'c0000000-0000-4000-a000-000000000010';
const CREDIT_ITEM_ID = 'd0000000-0000-4000-a000-000000000020';

// Mock client user matching CLIENT_ID for route-level ownership checks
const mockClientUser = { ...testUsers.client, id: CLIENT_ID };

// ---------------------------------------------------------------------------
// GET /api/disputes/client/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/disputes/client/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/disputes/client/${CLIENT_ID}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when a client tries to view another client disputes', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth

    const res = await request(app)
      .get(`/api/disputes/client/${OTHER_CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 when a client views own disputes', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DISPUTE_ID, status: 'draft' }] }); // disputes list

    const res = await request(app)
      .get(`/api/disputes/client/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disputes).toBeDefined();
    expect(res.body.data.disputes).toHaveLength(1);
  });

  it('should return 200 when admin views any client disputes', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [] }); // disputes list

    const res = await request(app)
      .get(`/api/disputes/client/${OTHER_CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disputes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/disputes
// ---------------------------------------------------------------------------
describe('POST /api/disputes', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  const validBody = {
    clientId: CLIENT_ID,
    creditItemId: CREDIT_ITEM_ID,
    disputeType: 'not_mine',
    bureau: 'experian',
  };

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .post('/api/disputes')
      .send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when a client creates a dispute for another client', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth

    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, clientId: OTHER_CLIENT_ID });

    expect(res.status).toBe(403);
  });

  it('should return 404 when client or credit item not found', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }); // auth
    mockQuery.mockResolvedValueOnce({ rows: [] }); // client profile lookup - empty
    mockQuery.mockResolvedValueOnce({ rows: [] }); // credit item lookup - empty

    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it('should return 403 when credit item does not belong to client', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ first_name: 'Client', last_name: 'User', address_line1: '123 St', city: 'NY', state: 'NY', zip_code: '10001', ssn_last_4: '1234' }] }) // client profile
      .mockResolvedValueOnce({ rows: [{ id: CREDIT_ITEM_ID, creditor_name: 'Acme', account_number: '123', description: 'Test' }] }) // credit item
      .mockResolvedValueOnce({ rows: [] }); // ownership check - empty = not owned

    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('should return 201 when a client creates a dispute successfully', async () => {
    const token = generateTestToken(mockClientUser.id);
    const now = new Date().toISOString();
    mockQuery
      .mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ first_name: 'Client', last_name: 'User', address_line1: '123 St', city: 'NY', state: 'NY', zip_code: '10001', ssn_last_4: '1234' }] }) // client profile
      .mockResolvedValueOnce({ rows: [{ id: CREDIT_ITEM_ID, creditor_name: 'Acme', account_number: '123', description: 'Test item' }] }) // credit item
      .mockResolvedValueOnce({ rows: [{ client_id: CLIENT_ID }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ id: DISPUTE_ID, client_id: CLIENT_ID, credit_item_id: CREDIT_ITEM_ID, dispute_type: 'not_mine', bureau: 'experian', letter_content: 'Letter', status: 'draft', created_at: now }] }) // insert dispute
      .mockResolvedValueOnce({ rowCount: 1 }); // update credit item status

    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.dispute).toBeDefined();
    expect(res.body.data.dispute.id).toBe(DISPUTE_ID);
    expect(res.body.data.dispute.status).toBe('draft');
    expect(res.body.message).toMatch(/created/i);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/disputes/:id/status
// ---------------------------------------------------------------------------
describe('PUT /api/disputes/:id/status', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .put(`/api/disputes/${DISPUTE_ID}/status`)
      .send({ status: 'sent' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 when dispute is not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [] }); // ownership check - dispute not found

    const res = await request(app)
      .put(`/api/disputes/${DISPUTE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });

    expect(res.status).toBe(404);
  });

  it('should return 403 when client does not own the dispute', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ client_id: OTHER_CLIENT_ID }] }); // ownership - belongs to someone else

    const res = await request(app)
      .put(`/api/disputes/${DISPUTE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });

    expect(res.status).toBe(403);
  });

  it('should return 200 when admin updates dispute status', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ client_id: CLIENT_ID }] })     // ownership check
      .mockResolvedValueOnce({ rowCount: 1 });                          // update

    const res = await request(app)
      .put(`/api/disputes/${DISPUTE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/disputes/:id
// ---------------------------------------------------------------------------
describe('GET /api/disputes/:id', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/disputes/${DISPUTE_ID}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 when dispute is not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [] }); // ownership check - not found

    const res = await request(app)
      .get(`/api/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 when client does not own the dispute', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ client_id: OTHER_CLIENT_ID }] }); // belongs to someone else

    const res = await request(app)
      .get(`/api/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 when admin fetches a dispute by ID', async () => {
    const token = generateTestToken(testUsers.admin.id);
    const disputeRow = {
      id: DISPUTE_ID,
      client_id: CLIENT_ID,
      credit_item_id: CREDIT_ITEM_ID,
      dispute_type: 'not_mine',
      bureau: 'experian',
      status: 'sent',
      letter_content: 'Letter text',
      creditor_name: 'Acme',
      account_number: '123',
      first_name: 'Client',
      last_name: 'User',
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ client_id: CLIENT_ID }] })     // ownership check
      .mockResolvedValueOnce({ rows: [disputeRow] });                   // dispute with joins

    const res = await request(app)
      .get(`/api/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispute).toBeDefined();
    expect(res.body.data.dispute.id).toBe(DISPUTE_ID);
    expect(res.body.data.dispute.bureau).toBe('experian');
  });

  it('should return 200 when client fetches own dispute', async () => {
    const token = generateTestToken(mockClientUser.id);
    mockQuery
      .mockResolvedValueOnce({ rows: [mockClientUser], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ client_id: CLIENT_ID }] })      // ownership check - own
      .mockResolvedValueOnce({ rows: [{ id: DISPUTE_ID, client_id: CLIENT_ID, status: 'draft' }] }); // dispute

    const res = await request(app)
      .get(`/api/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispute).toBeDefined();
    expect(res.body.data.dispute.status).toBe('draft');
  });
});
