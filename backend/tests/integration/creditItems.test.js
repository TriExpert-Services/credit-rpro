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

// Reset the mockResolvedValueOnce queue before every test so unconsumed
// values from a previous test never leak into the next one.
beforeEach(() => {
  mockQuery.mockReset();
  mockTransaction.mockReset();
});

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const sampleItem = {
  id: 'item-0000-0000-0000-000000000001',
  client_id: testUsers.client.id,
  item_type: 'collection',
  creditor_name: 'Acme Collections',
  account_number: '****1234',
  bureau: 'experian',
  balance: 1500,
  status: 'identified',
  date_opened: '2024-06-01',
  description: 'Medical debt',
  created_at: '2025-01-10T00:00:00Z',
  updated_at: '2025-01-10T00:00:00Z',
  dispute_count: '0',
};

const otherClientId = 'a0000000-0000-0000-0000-000000000099';

// Valid UUIDs that pass the express-validator UUID regex (version 4, variant a)
const validClientId = 'a0000000-0000-4000-a000-000000000003';
const validOtherClientId = 'a0000000-0000-4000-a000-000000000099';

// Test users whose ids satisfy UUID validation (for POST body checks)
const validClient = { ...testUsers.client, id: validClientId };
const validAdmin = { ...testUsers.admin, id: 'a0000000-0000-4000-a000-000000000001' };

// ---------------------------------------------------------------------------
// GET /api/credit-items
// ---------------------------------------------------------------------------
describe('GET /api/credit-items', () => {

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/credit-items');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 with items for authenticated client', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // items query
    mockQuery.mockResolvedValueOnce({ rows: [sampleItem], rowCount: 1 });
    // count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/credit-items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toHaveProperty('creditor_name', 'Acme Collections');
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(50);
  });

  it('should return 200 with empty items when none exist', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // items query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/credit-items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('should respect page and limit query params', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // items query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/credit-items?page=2&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.limit).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-items/client/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/credit-items/client/:clientId', () => {

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/credit-items/client/${testUsers.client.id}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 when client views own items', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [sampleItem], rowCount: 1 });

    const res = await request(app)
      .get(`/api/credit-items/client/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toHaveProperty('bureau', 'experian');
  });

  it('should return 403 when client tries to view another client items', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get(`/api/credit-items/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 when admin views any client items', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [sampleItem], rowCount: 1 });

    const res = await request(app)
      .get(`/api/credit-items/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
  });

  it('should return 200 when staff views any client items', async () => {
    const token = generateTestToken(testUsers.staff.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // route query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get(`/api/credit-items/client/${otherClientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/credit-items
// ---------------------------------------------------------------------------
describe('POST /api/credit-items', () => {
  const validBody = {
    clientId: validClientId,
    itemType: 'collection',
    creditorName: 'Acme Collections',
    accountNumber: '1234',
    bureau: 'experian',
  };

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/credit-items').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 201 when client creates own item', async () => {
    const token = generateTestToken(validClient.id);

    const createdItem = {
      id: 'item-new-0000-0000-000000000001',
      client_id: validClientId,
      item_type: 'collection',
      creditor_name: 'Acme Collections',
      account_number: '****1234',
      bureau: 'experian',
      balance: null,
      status: 'identified',
      date_opened: null,
      description: null,
      created_at: '2025-06-01T00:00:00Z',
    };

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [validClient], rowCount: 1 });
    // INSERT query
    mockQuery.mockResolvedValueOnce({ rows: [createdItem], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-items')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.item).toHaveProperty('id', createdItem.id);
    expect(res.body.data.item).toHaveProperty('status', 'identified');
    expect(res.body.message).toBe('Credit item added');
  });

  it('should return 403 when client tries to add item for another client', async () => {
    const token = generateTestToken(validClient.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [validClient], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, clientId: validOtherClientId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 201 when admin creates item for any client', async () => {
    const token = generateTestToken(validAdmin.id);

    const createdItem = {
      id: 'item-new-0000-0000-000000000002',
      client_id: validOtherClientId,
      item_type: 'collection',
      creditor_name: 'Acme Collections',
      account_number: '1234',
      bureau: 'experian',
      balance: null,
      status: 'identified',
      date_opened: null,
      description: null,
      created_at: '2025-06-01T00:00:00Z',
    };

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [validAdmin], rowCount: 1 });
    // INSERT query
    mockQuery.mockResolvedValueOnce({ rows: [createdItem], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, clientId: validOtherClientId });

    expect(res.status).toBe(201);
    expect(res.body.data.item).toHaveProperty('client_id', validOtherClientId);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/credit-items/:id/status
// ---------------------------------------------------------------------------
describe('PUT /api/credit-items/:id/status', () => {

  const itemId = sampleItem.id;

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .send({ status: 'disputing' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 when client updates own item status', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check (verifyItemOwnership)
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: testUsers.client.id }], rowCount: 1 });
    // UPDATE query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disputing' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Status updated successfully');
  });

  it('should return 403 when client updates another client item', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check — belongs to other client
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: otherClientId }], rowCount: 1 });

    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disputing' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 when item does not exist', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check — not found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disputing' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('should return 400 for invalid status value', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 when admin updates any item status', async () => {
    const token = generateTestToken(testUsers.admin.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // ownership check — belongs to other client, but admin bypasses
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: otherClientId }], rowCount: 1 });
    // UPDATE query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .put(`/api/credit-items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Status updated successfully');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/credit-items/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/credit-items/:id', () => {

  const itemId = sampleItem.id;

  it('should return 401 without a token', async () => {
    const res = await request(app).delete(`/api/credit-items/${itemId}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 when client deletes own item', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: testUsers.client.id }], rowCount: 1 });
    // soft-delete UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/credit-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Credit item deleted');
  });

  it('should return 403 when client deletes another client item', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check — belongs to other client
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: otherClientId }], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/credit-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 when item does not exist', async () => {
    const token = generateTestToken(testUsers.client.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // ownership check — not found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .delete(`/api/credit-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('should return 200 when staff deletes any item', async () => {
    const token = generateTestToken(testUsers.staff.id);

    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });
    // ownership check — belongs to other client, staff bypasses
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: otherClientId }], rowCount: 1 });
    // soft-delete UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete(`/api/credit-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Credit item deleted');
  });
});
