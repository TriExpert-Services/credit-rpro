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

// Disable rate limiters for tests
jest.mock('../../middleware/rateLimiters', () => {
  const passthrough = (req, res, next) => next();
  return {
    generalLimiter: passthrough,
    authLimiter: passthrough,
    sensitiveLimiter: passthrough,
    writeLimiter: passthrough,
    aiLimiter: passthrough,
    uploadLimiter: passthrough,
  };
});

// Mock services used by creditReportAnalysis routes
const mockCreditReportAnalyzer = {
  analyzeMultipleReports: jest.fn(),
  processUploadedReport: jest.fn(),
  getClientAnalysisSummary: jest.fn(),
};
jest.mock('../../utils/creditReportAnalyzer', () => mockCreditReportAnalyzer);

const mockGenerateDisputeLetter = jest.fn();
jest.mock('../../utils/openaiService', () => ({
  generateDisputeLetter: mockGenerateDisputeLetter,
}));

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

// ---------------------------------------------------------------------------
// GET /api/credit-reports/items/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/credit-reports/items/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/credit-reports/items/some-id');
    expect(res.status).toBe(401);
  });

  it('should return 403 when client accesses another client data', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/credit-reports/items/other-client-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return items for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const items = [
      { id: 'i1', creditor_name: 'Bank A', status: 'identified', bureau: 'experian' },
    ];
    mockQuery.mockResolvedValueOnce({ rows: items });

    const res = await request(app)
      .get(`/api/credit-reports/items/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('should return items for the client themselves', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/credit-reports/items/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-reports/scores/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/credit-reports/scores/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/credit-reports/scores/some-id');
    expect(res.status).toBe(401);
  });

  it('should return scores for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    // latestScores
    mockQuery.mockResolvedValueOnce({ rows: [{ bureau: 'experian', score: 700, score_date: '2025-01-01', notes: '' }] });
    // scoreHistory
    mockQuery.mockResolvedValueOnce({ rows: [{ bureau: 'experian', score: 680, score_date: '2024-06-01' }] });
    // firstScores
    mockQuery.mockResolvedValueOnce({ rows: [{ bureau: 'experian', score: 680 }] });

    const res = await request(app)
      .get(`/api/credit-reports/scores/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.latestScores).toHaveLength(1);
    expect(res.body.improvements).toHaveProperty('experian');
    expect(res.body.averageScore).toBe(700);
  });

  it('should return 403 for unauthorized client', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/credit-reports/scores/other-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-reports/summary/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/credit-reports/summary/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return summary for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockCreditReportAnalyzer.getClientAnalysisSummary.mockResolvedValue({ totalItems: 5 });
    // disputeStats
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'pending', count: 3 }] });
    // recentActivity
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/credit-reports/summary/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(5);
    expect(res.body.disputeStats).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/credit-reports/analyze/:documentId
// ---------------------------------------------------------------------------
describe('POST /api/credit-reports/analyze/:documentId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 404 when document not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/credit-reports/analyze/no-doc')
      .set('Authorization', `Bearer ${token}`)
      .send({ bureau: 'experian' });

    expect(res.status).toBe(404);
  });

  it('should analyze existing document for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const doc = { id: 'd1', file_path: '/tmp/report.pdf', client_id: testUsers.client.id };
    mockQuery.mockResolvedValueOnce({ rows: [doc] });

    mockCreditReportAnalyzer.processUploadedReport.mockResolvedValue({ success: true, items: [] });

    const res = await request(app)
      .post('/api/credit-reports/analyze/d1')
      .set('Authorization', `Bearer ${token}`)
      .send({ bureau: 'experian' });

    expect(res.status).toBe(200);
    expect(mockCreditReportAnalyzer.processUploadedReport).toHaveBeenCalledWith(
      testUsers.client.id, '/tmp/report.pdf', 'experian', 'd1'
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/credit-reports/generate-disputes/:clientId
// ---------------------------------------------------------------------------
describe('POST /api/credit-reports/generate-disputes/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post(`/api/credit-reports/generate-disputes/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('should return 404 when client not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // clientResult
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/credit-reports/generate-disputes/no-client')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('should generate disputes for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    // clientResult
    const client = { id: testUsers.client.id, first_name: 'Client', last_name: 'User', address: '123 St', city: 'Miami', state: 'FL', zip_code: '33101', ssn_last_four: '1234', date_of_birth: '1990-01-01' };
    mockQuery.mockResolvedValueOnce({ rows: [client] });

    // itemsResult
    const items = [{ id: 'ci1', creditor_name: 'Bank', account_number: '1234', balance: 500, status: 'identified', description: 'Late', bureau: 'experian' }];
    mockQuery.mockResolvedValueOnce({ rows: items });

    // generateDisputeLetter
    mockGenerateDisputeLetter.mockResolvedValue('Dear Bureau...');

    // INSERT disputes
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'disp1' }] });
    // UPDATE credit_items status
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // INSERT activity_log
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/api/credit-reports/generate-disputes/${testUsers.client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ disputeType: 'inaccurate_info' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disputesGenerated).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/credit-reports/add-score
// ---------------------------------------------------------------------------
describe('POST /api/credit-reports/add-score', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 400 when bureau or score missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-reports/add-score')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: testUsers.client.id });

    expect(res.status).toBe(400);
  });

  it('should add score for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const scoreRow = { id: 's1', client_id: testUsers.client.id, bureau: 'experian', score: 720 };
    // INSERT credit_scores
    mockQuery.mockResolvedValueOnce({ rows: [scoreRow] });
    // INSERT credit_score_audit
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/credit-reports/add-score')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: testUsers.client.id, bureau: 'experian', score: 720 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.score.bureau).toBe('experian');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/credit-reports/items/:itemId
// ---------------------------------------------------------------------------
describe('PUT /api/credit-reports/items/:itemId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 404 when item not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/credit-reports/items/no-item')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });

  it('should return 400 when no fields provided', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const item = { id: 'i1', client_id: testUsers.admin.id };
    mockQuery.mockResolvedValueOnce({ rows: [item] });

    const res = await request(app)
      .put('/api/credit-reports/items/i1')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should update item for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const item = { id: 'i1', client_id: testUsers.client.id };
    mockQuery.mockResolvedValueOnce({ rows: [item] });

    const updated = { id: 'i1', status: 'resolved', description: 'Fixed' };
    mockQuery.mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app)
      .put('/api/credit-reports/items/i1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', description: 'Fixed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.item.status).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/credit-reports/items/:itemId
// ---------------------------------------------------------------------------
describe('DELETE /api/credit-reports/items/:itemId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 404 when item not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/credit-reports/items/no-item')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'i1' }] });

    const res = await request(app)
      .delete('/api/credit-reports/items/i1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should soft-delete item for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'i1' }] });
    // soft delete disputes
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // soft delete item
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/credit-reports/items/i1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Item deleted');
  });
});
