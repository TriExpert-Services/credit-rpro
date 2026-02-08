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

// Mock plaidService
const mockPlaidService = {
  createLinkToken: jest.fn(),
  exchangePublicToken: jest.fn(),
  getUserAccounts: jest.fn(),
  getVerificationStatus: jest.fn(),
  getIdentity: jest.fn(),
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  removeItem: jest.fn(),
  handleWebhook: jest.fn(),
};
jest.mock('../../utils/plaidService', () => mockPlaidService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

// ---------------------------------------------------------------------------
// POST /api/plaid/create-link-token
// ---------------------------------------------------------------------------
describe('POST /api/plaid/create-link-token', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/plaid/create-link-token');
    expect(res.status).toBe(401);
  });

  it('should create link token for authenticated user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.createLinkToken.mockResolvedValue({ link_token: 'link-sandbox-xxx', expiration: '2025-12-31' });

    const res = await request(app)
      .post('/api/plaid/create-link-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ products: ['auth'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('link_token');
    expect(mockPlaidService.createLinkToken).toHaveBeenCalledWith(
      testUsers.client.id,
      'TriExpert Credit Repair',
      ['auth']
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/plaid/exchange-token
// ---------------------------------------------------------------------------
describe('POST /api/plaid/exchange-token', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 400 when publicToken missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/plaid/exchange-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should exchange token successfully', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.exchangePublicToken.mockResolvedValue({ accessToken: 'access-xxx', itemId: 'item-1' });
    mockPlaidService.getIdentity.mockResolvedValue({});
    mockPlaidService.getAccounts.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/plaid/exchange-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ publicToken: 'public-sandbox-xxx' });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.itemId).toBe('item-1');
  });

  it('should update institution info when metadata provided', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.exchangePublicToken.mockResolvedValue({ accessToken: 'access-xxx', itemId: 'item-1' });
    // UPDATE plaid_items with institution info
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockPlaidService.getIdentity.mockResolvedValue({});
    mockPlaidService.getAccounts.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/plaid/exchange-token')
      .set('Authorization', `Bearer ${token}`)
      .send({
        publicToken: 'public-sandbox-xxx',
        metadata: { institution: { institution_id: 'ins_1', name: 'Chase' } },
      });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE plaid_items'),
      ['ins_1', 'Chase', 'item-1']
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/plaid/accounts
// ---------------------------------------------------------------------------
describe('GET /api/plaid/accounts', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return accounts for authenticated user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const accounts = [{ id: 'acc1', name: 'Checking', type: 'depository' }];
    mockPlaidService.getUserAccounts.mockResolvedValue(accounts);

    const res = await request(app)
      .get('/api/plaid/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accounts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/plaid/verification-status
// ---------------------------------------------------------------------------
describe('GET /api/plaid/verification-status', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return verification status', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.getVerificationStatus.mockResolvedValue({
      verification_status: 'verified',
      verified_name: 'Client User',
      verified_at: '2025-01-01',
      verified_email: 'client@test.com',
      verified_phone: '555-0001',
    });

    const res = await request(app)
      .get('/api/plaid/verification-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isVerified).toBe(true);
    expect(res.body.data.verifiedName).toBe('Client User');
  });

  it('should return not verified when status is pending', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.getVerificationStatus.mockResolvedValue({ verification_status: 'pending' });

    const res = await request(app)
      .get('/api/plaid/verification-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isVerified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/plaid/refresh-identity
// ---------------------------------------------------------------------------
describe('POST /api/plaid/refresh-identity', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 404 when no active plaid item exists', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // query for plaid_items
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/plaid/refresh-identity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should refresh identity for user with active item', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // query for plaid_items
    mockQuery.mockResolvedValueOnce({ rows: [{ access_token: 'access-xxx' }] });

    mockPlaidService.getIdentity.mockResolvedValue({ name: 'Client User' });

    const res = await request(app)
      .post('/api/plaid/refresh-identity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(mockPlaidService.getIdentity).toHaveBeenCalledWith('access-xxx', testUsers.client.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/plaid/get-transactions
// ---------------------------------------------------------------------------
describe('POST /api/plaid/get-transactions', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 404 when no active plaid item', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/plaid/get-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('should return transactions', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ access_token: 'access-xxx' }] });

    mockPlaidService.getTransactions.mockResolvedValue({ transactions: [{ amount: 100 }] });

    const res = await request(app)
      .post('/api/plaid/get-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 15 });

    expect(res.status).toBe(200);
    expect(mockPlaidService.getTransactions).toHaveBeenCalledWith('access-xxx', testUsers.client.id, 15);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/plaid/accounts/:itemId
// ---------------------------------------------------------------------------
describe('DELETE /api/plaid/accounts/:itemId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should remove linked account', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockPlaidService.removeItem.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/plaid/accounts/item-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(mockPlaidService.removeItem).toHaveBeenCalledWith('item-1', testUsers.client.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/plaid/webhook
// ---------------------------------------------------------------------------
describe('POST /api/plaid/webhook', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should handle webhook without auth', async () => {
    mockPlaidService.handleWebhook.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/plaid/webhook')
      .send({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('should return 500 when webhook processing fails', async () => {
    mockPlaidService.handleWebhook.mockRejectedValue(new Error('processing error'));

    const res = await request(app)
      .post('/api/plaid/webhook')
      .send({ webhook_type: 'ITEM', webhook_code: 'ERROR' });

    expect(res.status).toBe(500);
  });
});
