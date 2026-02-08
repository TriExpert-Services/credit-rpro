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

// Disable rate limiters so all 20+ requests go through
const passThroughLimiter = (req, res, next) => next();
jest.mock('../../middleware/rateLimiters', () => ({
  generalLimiter: passThroughLimiter,
  apiLimiter: passThroughLimiter,
  authLimiter: passThroughLimiter,
  sensitiveLimiter: passThroughLimiter,
  sensitiveOpsLimiter: passThroughLimiter,
  writeLimiter: passThroughLimiter,
  aiLimiter: passThroughLimiter,
  uploadLimiter: passThroughLimiter,
}));

// Mock the AI dispute service
const mockGenerateDispute = jest.fn();
const mockSaveDispute = jest.fn();
const mockGetUserDisputes = jest.fn();
const mockGetDispute = jest.fn();
const mockSendDispute = jest.fn();
const mockDeleteDispute = jest.fn();

jest.mock('../../utils/aiDispute', () => ({
  generateDispute: (...args) => mockGenerateDispute(...args),
  saveDispute: (...args) => mockSaveDispute(...args),
  getUserDisputes: (...args) => mockGetUserDisputes(...args),
  getDispute: (...args) => mockGetDispute(...args),
  sendDispute: (...args) => mockSendDispute(...args),
  deleteDispute: (...args) => mockDeleteDispute(...args),
}));

// Mock the dispute strategy module
const mockDetermineCurrentRound = jest.fn();
const mockGetCompleteStrategy = jest.fn();
const mockEstimateScoreImprovement = jest.fn();

jest.mock('../../utils/disputeStrategy', () => ({
  determineCurrentRound: (...args) => mockDetermineCurrentRound(...args),
  getCompleteStrategy: (...args) => mockGetCompleteStrategy(...args),
  estimateScoreImprovement: (...args) => mockEstimateScoreImprovement(...args),
  STRATEGY_ROUNDS: { 1: { id: 1, name: 'Initial Dispute' }, 2: { id: 2, name: 'Verification Challenge' } },
  BUREAU_STRATEGIES: { equifax: { name: 'Equifax' }, experian: { name: 'Experian' }, transunion: { name: 'TransUnion' } },
  ITEM_TYPE_STRATEGIES: {},
}));

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const { pool } = require('../../config/database');

// ---------------------------------------------------------------------------
// GET /api/ai-disputes/strategy/:creditItemId
// ---------------------------------------------------------------------------
describe('GET /api/ai-disputes/strategy/:creditItemId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/ai-disputes/strategy/some-id');
    expect(res.status).toBe(401);
  });

  it('should return 404 when credit item not found', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // pool.query — credit item lookup
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/ai-disputes/strategy/a0000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 200 with strategy for valid item', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const creditItem = {
      id: 'item-1', item_type: 'late_payment', creditor_name: 'Bank A',
      account_number: '1234', balance: 500, status: 'negative', bureau: 'equifax',
      date_opened: '2024-01-01', date_reported: '2024-06-01',
    };
    // pool.query — credit item
    pool.query.mockResolvedValueOnce({ rows: [creditItem], rowCount: 1 });

    mockDetermineCurrentRound.mockResolvedValue({ round: 1, previousResult: null });
    mockGetCompleteStrategy.mockReturnValue({ approach: 'FCRA §611', tips: [] });

    // pool.query — score lookup
    pool.query.mockResolvedValueOnce({ rows: [{ score: 620 }], rowCount: 1 });
    // pool.query — count negative items
    pool.query.mockResolvedValueOnce({ rows: [{ total: '3' }], rowCount: 1 });

    mockEstimateScoreImprovement.mockReturnValue({ min: 10, max: 30 });

    const res = await request(app)
      .get('/api/ai-disputes/strategy/item-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('strategy');
    expect(res.body.data).toHaveProperty('currentRound', 1);
    expect(res.body.data).toHaveProperty('scoreImpact');
  });
});

// ---------------------------------------------------------------------------
// GET /api/ai-disputes/strategies/overview
// ---------------------------------------------------------------------------
describe('GET /api/ai-disputes/strategies/overview', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/ai-disputes/strategies/overview');
    expect(res.status).toBe(401);
  });

  it('should return 200 with overview data', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/ai-disputes/strategies/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('rounds');
    expect(res.body.data).toHaveProperty('bureaus');
    expect(res.body.data).toHaveProperty('itemTypes');
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai-disputes/generate
// ---------------------------------------------------------------------------
describe('POST /api/ai-disputes/generate', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const validBody = {
    creditItemId: 'a0000000-0000-0000-0000-000000000010',
    disputeType: 'not_mine',
    bureau: 'equifax',
  };

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/ai-disputes/generate').send(validBody);
    expect(res.status).toBe(401);
  });

  it('should return 200 and generated letter on success', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockGenerateDispute.mockResolvedValue({
      letter: 'Dear Equifax...',
      creditItem: { id: validBody.creditItemId, creditor_name: 'Bank A', account_number: '1234', balance: 500, status: 'negative' },
      bureau: 'equifax',
      disputeType: 'not_mine',
    });

    const res = await request(app)
      .post('/api/ai-disputes/generate')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('letter');
    expect(res.body.data).toHaveProperty('bureau', 'equifax');
  });

  it('should return 500 when generateDispute service throws', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockGenerateDispute.mockRejectedValue(new Error('OpenAI error'));

    const res = await request(app)
      .post('/api/ai-disputes/generate')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai-disputes/save
// ---------------------------------------------------------------------------
describe('POST /api/ai-disputes/save', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const validBody = {
    creditItemId: 'a0000000-0000-0000-0000-000000000010',
    content: 'Dear Bureau, I dispute this item...',
    disputeType: 'not_mine',
    bureau: 'equifax',
  };

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/ai-disputes/save').send(validBody);
    expect(res.status).toBe(401);
  });

  it('should return 400 when required fields are missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/ai-disputes/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ creditItemId: validBody.creditItemId }); // missing content, disputeType, bureau

    expect(res.status).toBe(400);
  });

  it('should return 201 on successful save', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockSaveDispute.mockResolvedValue({
      id: 'dispute-1',
      status: 'draft',
      created_at: '2026-01-01T00:00:00Z',
    });

    const res = await request(app)
      .post('/api/ai-disputes/save')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id', 'dispute-1');
    expect(res.body.data).toHaveProperty('status', 'draft');
  });
});

// ---------------------------------------------------------------------------
// GET /api/ai-disputes/drafts
// ---------------------------------------------------------------------------
describe('GET /api/ai-disputes/drafts', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/ai-disputes/drafts');
    expect(res.status).toBe(401);
  });

  it('should return 200 with user drafts', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockGetUserDisputes.mockResolvedValue([
      { id: 'd1', status: 'draft', bureau: 'equifax' },
    ]);

    const res = await request(app)
      .get('/api/ai-disputes/drafts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/ai-disputes/:id
// ---------------------------------------------------------------------------
describe('GET /api/ai-disputes/:id', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/ai-disputes/dispute-1');
    expect(res.status).toBe(401);
  });

  it('should return 200 with dispute details', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockGetDispute.mockResolvedValue({
      id: 'dispute-1', content: 'Dear Bureau...', status: 'draft', bureau: 'equifax',
    });

    const res = await request(app)
      .get('/api/ai-disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', 'dispute-1');
  });

  it('should return 404 when dispute not found', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockGetDispute.mockRejectedValue(new Error('Dispute not found'));

    const res = await request(app)
      .get('/api/ai-disputes/not-exist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/ai-disputes/:id/send
// ---------------------------------------------------------------------------
describe('PATCH /api/ai-disputes/:id/send', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).patch('/api/ai-disputes/dispute-1/send');
    expect(res.status).toBe(401);
  });

  it('should return 200 when dispute is marked as sent', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockSendDispute.mockResolvedValue({
      id: 'dispute-1', status: 'sent', tracking_number: 'TRK-123',
    });

    const res = await request(app)
      .patch('/api/ai-disputes/dispute-1/send')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status', 'sent');
  });

  it('should return 404 when dispute not found for send', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockSendDispute.mockRejectedValue(new Error('Dispute not found'));

    const res = await request(app)
      .patch('/api/ai-disputes/not-exist/send')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/ai-disputes/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/ai-disputes/:id', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).delete('/api/ai-disputes/dispute-1');
    expect(res.status).toBe(401);
  });

  it('should return 200 when dispute is deleted', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockDeleteDispute.mockResolvedValue({ deleted: true });

    const res = await request(app)
      .delete('/api/ai-disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 when dispute not found for delete', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockDeleteDispute.mockRejectedValue(new Error('Dispute not found'));

    const res = await request(app)
      .delete('/api/ai-disputes/not-exist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 when dispute cannot be deleted (already sent)', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockDeleteDispute.mockRejectedValue(new Error('Sent dispute cannot be deleted'));

    const res = await request(app)
      .delete('/api/ai-disputes/dispute-sent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
