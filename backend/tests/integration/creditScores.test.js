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

const mockCreditScoreService = {
  recordScore: jest.fn(),
  getLatestScores: jest.fn(),
  getScoreHistory: jest.fn(),
  calculateTrend: jest.fn(),
  getScoreFactors: jest.fn(),
  getBureauComparison: jest.fn(),
  generateReport: jest.fn(),
  detectAnomalies: jest.fn(),
  projectImprovement: jest.fn(),
  getDetailedFactors: jest.fn(),
};

jest.mock('../../utils/creditScoreService', () => mockCreditScoreService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const CLIENT_ID = 'c0000000-0000-0000-0000-000000000010';

// ---------------------------------------------------------------------------
// POST /api/credit-scores
// ---------------------------------------------------------------------------
describe('POST /api/credit-scores', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .post('/api/credit-scores')
      .send({ clientId: CLIENT_ID, bureau: 'experian', score: 720 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 for a client role user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'experian', score: 720 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/staff/i);
  });

  it('should return 201 when admin records a score', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const scoreResult = { id: 'score-1', clientId: CLIENT_ID, bureau: 'experian', score: 720 };
    mockCreditScoreService.recordScore.mockResolvedValueOnce(scoreResult);

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'experian', score: 720 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.score).toEqual(scoreResult);
    expect(mockCreditScoreService.recordScore).toHaveBeenCalledWith(
      CLIENT_ID, 'experian', 720, 'manual_entry', undefined
    );
  });

  it('should return 201 when staff records a score with optional fields', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const scoreResult = { id: 'score-2', clientId: CLIENT_ID, bureau: 'transunion', score: 680 };
    mockCreditScoreService.recordScore.mockResolvedValueOnce(scoreResult);

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'transunion', score: 680, source: 'report_pull', notes: 'Q1 check' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockCreditScoreService.recordScore).toHaveBeenCalledWith(
      CLIENT_ID, 'transunion', 680, 'report_pull', 'Q1 check'
    );
  });

  it('should return 400 for invalid bureau', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'invalid_bureau', score: 700 });

    expect(res.status).toBe(400);
  });

  it('should return 400 for score out of range', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'equifax', score: 200 });

    expect(res.status).toBe(400);
  });

  it('should return 500 when service throws', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockCreditScoreService.recordScore.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/credit-scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, bureau: 'experian', score: 750 });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('DB connection lost');
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/latest
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/latest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/credit-scores/${CLIENT_ID}/latest`);
    expect(res.status).toBe(401);
  });

  it('should return latest scores for authenticated user', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const scores = [
      { bureau: 'experian', score: 720, recorded_at: '2026-01-15' },
      { bureau: 'equifax', score: 710, recorded_at: '2026-01-15' },
    ];
    mockCreditScoreService.getLatestScores.mockResolvedValueOnce(scores);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/latest`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scores).toEqual(scores);
    expect(res.body.bureaus).toEqual(['experian', 'equifax']);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/history/:bureau
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/history/:bureau', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return score history', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const history = [{ score: 700, recorded_at: '2026-01-01' }, { score: 710, recorded_at: '2026-02-01' }];
    mockCreditScoreService.getScoreHistory.mockResolvedValueOnce(history);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/history/experian`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bureau).toBe('experian');
    expect(res.body.history).toEqual(history);
    expect(res.body.totalRecords).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/trend/:bureau
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/trend/:bureau', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return score trend', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const trend = { direction: 'up', changePerMonth: 5 };
    mockCreditScoreService.calculateTrend.mockResolvedValueOnce(trend);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/trend/equifax`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bureau).toBe('equifax');
    expect(res.body.trend).toEqual(trend);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/factors
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/factors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return score factors', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const factors = { analysis: 'good standing', items: ['on-time payments'] };
    mockCreditScoreService.getScoreFactors.mockResolvedValueOnce(factors);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/factors`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.factors).toEqual(factors);
    expect(res.body.analysis).toBe('good standing');
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/comparison
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/comparison', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return bureau comparison', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const comparison = { interpretation: 'scores are aligned', bureaus: {} };
    mockCreditScoreService.getBureauComparison.mockResolvedValueOnce(comparison);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/comparison`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.comparison).toEqual(comparison);
    expect(res.body.interpretation).toBe('scores are aligned');
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/report
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/report', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return credit report summary', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const report = { recommendations: ['pay on time'], summary: 'fair' };
    mockCreditScoreService.generateReport.mockResolvedValueOnce(report);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/report`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report).toEqual(report);
    expect(res.body.recommendations).toEqual(['pay on time']);
  });

  it('should return 500 when service throws', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockCreditScoreService.generateReport.mockRejectedValueOnce(new Error('Report generation failed'));

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/report`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Report generation failed');
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/anomalies
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/anomalies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return anomalies', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const anomalies = { alerts: [], hasAnomalies: false };
    mockCreditScoreService.detectAnomalies.mockResolvedValueOnce(anomalies);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/anomalies`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hasAnomalies).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/projections
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/projections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return projections', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const projections = { projectedScore: 780, timeline: '6 months' };
    mockCreditScoreService.projectImprovement.mockResolvedValueOnce(projections);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/projections`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projectedScore).toBe(780);
    expect(res.body.timeline).toBe('6 months');
  });
});

// ---------------------------------------------------------------------------
// GET /api/credit-scores/:clientId/detailed-factors
// ---------------------------------------------------------------------------
describe('GET /api/credit-scores/:clientId/detailed-factors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return detailed FICO factors', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const factors = { paymentHistory: 35, creditUtilization: 30 };
    mockCreditScoreService.getDetailedFactors.mockResolvedValueOnce(factors);

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/detailed-factors`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.factors).toEqual(factors);
  });

  it('should return 500 when service throws', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockCreditScoreService.getDetailedFactors.mockRejectedValueOnce(new Error('Factor analysis unavailable'));

    const res = await request(app)
      .get(`/api/credit-scores/${CLIENT_ID}/detailed-factors`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Factor analysis unavailable');
  });
});
