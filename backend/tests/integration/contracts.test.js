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

// Mock contractService — routes delegate to it
jest.mock('../../utils/contractService', () => ({
  getContractForSigning: jest.fn(),
  getTemplate: jest.fn(),
  signContract: jest.fn(),
  getClientSignedContracts: jest.fn(),
  hasSignedContract: jest.fn(),
  getAllTemplates: jest.fn(),
  createTemplate: jest.fn(),
  getComplianceInfo: jest.fn(),
}));

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');
const contractService = require('../../utils/contractService');

// ---------------------------------------------------------------------------
// GET /api/contracts/:contractType
// Note: This parameterised route is defined first in contracts.js, so it
//       handles all GET /api/contracts/<segment> requests (including paths
//       like /signed, /templates, etc.).
// ---------------------------------------------------------------------------
describe('GET /api/contracts/:contractType', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/contracts/service_agreement');
    expect(res.status).toBe(401);
  });

  it('should return 200 with contract data for authenticated user', async () => {
    const token = generateTestToken(testUsers.client.id);
    // 1. auth middleware user lookup
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    contractService.getContractForSigning.mockResolvedValueOnce({
      id: 'tmpl-1',
      contractType: 'service_agreement',
      version: 1,
      content: '<p>Service Agreement</p>',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const res = await request(app)
      .get('/api/contracts/service_agreement')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.contract).toBeDefined();
    expect(res.body.contract.contractType).toBe('service_agreement');
    expect(contractService.getContractForSigning).toHaveBeenCalledWith(
      'service_agreement',
      expect.objectContaining({ clientName: 'Client User' }),
    );
  });

  it('should return 404 when contract template is not found', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    contractService.getContractForSigning.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/contracts/nonexistent_type')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Contract not found');
  });

  it('should return 500 when the service throws', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    contractService.getContractForSigning.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .get('/api/contracts/service_agreement')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/contracts/:contractType/sign
// ---------------------------------------------------------------------------
describe('POST /api/contracts/:contractType/sign', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/contracts/service_agreement/sign');
    expect(res.status).toBe(401);
  });

  it('should return 400 when signatureData is missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/contracts/service_agreement/sign')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Signature data required');
  });

  it('should return 404 when contract template does not exist', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    contractService.getTemplate.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/contracts/service_agreement/sign')
      .set('Authorization', `Bearer ${token}`)
      .send({ signatureData: 'Client User' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Contract not found');
  });

  it('should return 201 on successful contract signing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    contractService.getTemplate.mockResolvedValueOnce({
      id: 'tmpl-1',
      contract_type: 'service_agreement',
    });
    contractService.signContract.mockResolvedValueOnce({
      id: 'sig-1',
      signed_date: '2026-02-08T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/contracts/service_agreement/sign')
      .set('Authorization', `Bearer ${token}`)
      .send({ signatureData: 'Client User', signatureMethod: 'digital' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('signed successfully');
    expect(res.body.signature).toBeDefined();
    expect(contractService.signContract).toHaveBeenCalledWith(
      testUsers.client.id,
      'tmpl-1',
      'Client User',
      'digital',
      expect.any(String), // ip
      expect.toBeOneOf ? expect.toBeOneOf([expect.any(String), undefined]) : undefined, // user-agent may be undefined in test
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/contracts/templates  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/contracts/templates', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for a non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/contracts/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractType: 'service_agreement',
        templateContent: '<p>Test</p>',
        effectiveDate: '2026-06-01',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
  });

  it('should return 400 when required fields are missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/contracts/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractType: 'service_agreement' }); // missing templateContent, effectiveDate

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing required fields');
  });

  it('should return 201 when admin creates a template successfully', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    contractService.createTemplate.mockResolvedValueOnce({
      id: 'tmpl-new',
      contract_type: 'service_agreement',
      template_version: 1,
      effective_date: '2026-06-01',
    });

    const res = await request(app)
      .post('/api/contracts/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractType: 'service_agreement',
        templateContent: '<p>New Service Agreement v2</p>',
        effectiveDate: '2026-06-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.template).toBeDefined();
    expect(contractService.createTemplate).toHaveBeenCalledWith(
      'service_agreement',
      expect.any(String),
      '2026-06-01',
      testUsers.admin.id,
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/contracts/cancel  (CROA 3-day right to cancel)
// ---------------------------------------------------------------------------
describe('POST /api/contracts/cancel', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/contracts/cancel');
    expect(res.status).toBe(401);
  });

  it('should process cancellation within the CROA 3-day period', async () => {
    const token = generateTestToken(testUsers.client.id);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // 1. auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 2. SELECT client_contracts (recently signed)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'contract-1', signed_date: yesterday.toISOString() }],
      rowCount: 1,
    });
    // 3. INSERT cancellation_requests
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 4. UPDATE client_contracts (invalidate — within CROA)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 5. UPDATE subscriptions (cancel — within CROA)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 6. INSERT audit_log
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/contracts/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Changed my mind', submittedAt: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.withinCroaPeriod).toBe(true);
    expect(res.body.cancellationDeadline).toBeDefined();
  });

  it('should flag review when cancellation is outside the CROA period', async () => {
    const token = generateTestToken(testUsers.client.id);
    const oldDate = new Date('2025-01-01');

    // 1. auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // 2. SELECT client_contracts (old contract — outside CROA window)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'contract-old', signed_date: oldDate.toISOString() }],
      rowCount: 1,
    });
    // 3. INSERT cancellation_requests
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 4. INSERT audit_log (no contract/subscription updates — outside period)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/contracts/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'No longer needed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.withinCroaPeriod).toBe(false);
  });
});
