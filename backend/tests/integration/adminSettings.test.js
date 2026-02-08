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

// Mock settingsService used by adminSettings routes
const mockSettingsService = {
  getAllSettings: jest.fn(),
  getSetting: jest.fn(),
  getSettingValue: jest.fn(),
  saveSetting: jest.fn(),
  deleteSetting: jest.fn(),
  testApiKey: jest.fn(),
  getIntegrationStatus: jest.fn(),
  auditSetting: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../utils/settingsService', () => mockSettingsService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const { pool } = require('../../config/database');

// ---------------------------------------------------------------------------
// GET /api/admin/settings
// ---------------------------------------------------------------------------
describe('GET /api/admin/settings', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 with settings for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const settings = [
      { setting_key: 'OPENAI_KEY', setting_type: 'api_key', setting_value: '***' },
    ];
    mockSettingsService.getAllSettings.mockResolvedValue(settings);

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('settings');
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/settings/:key
// ---------------------------------------------------------------------------
describe('GET /api/admin/settings/:key', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .get('/api/admin/settings/OPENAI_KEY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 when setting not found', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.getSetting.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/admin/settings/NONEXISTENT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 200 with the setting for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.getSetting.mockResolvedValue({
      setting_key: 'OPENAI_KEY', setting_value: 'sk-abc', is_encrypted: true, setting_type: 'api_key',
    });

    const res = await request(app)
      .get('/api/admin/settings/OPENAI_KEY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.setting.setting_value).toBe('***ENCRYPTED***');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/settings
// ---------------------------------------------------------------------------
describe('POST /api/admin/settings', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const validBody = {
    settingKey: 'STRIPE_SECRET',
    settingValue: 'sk_test_123',
    settingType: 'api_key',
    description: 'Stripe secret key',
  };

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('should return 400 when required fields are missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ settingKey: 'INCOMPLETE' }); // missing settingValue, settingType

    expect(res.status).toBe(400);
  });

  it('should return 201 on successful save', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.saveSetting.mockResolvedValue({ setting_key: 'STRIPE_SECRET', setting_type: 'api_key' });

    const res = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/settings/:key
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/settings/:key', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .delete('/api/admin/settings/OPENAI_KEY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 on successful delete', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.deleteSetting.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/admin/settings/OLD_KEY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/settings/test
// ---------------------------------------------------------------------------
describe('POST /api/admin/settings/test', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .post('/api/admin/settings/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiType: 'openai', apiKey: 'sk-test' });

    expect(res.status).toBe(403);
  });

  it('should return 400 when apiType or apiKey missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/admin/settings/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiType: 'openai' }); // missing apiKey

    expect(res.status).toBe(400);
  });

  it('should return 200 with test result on success', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.testApiKey.mockResolvedValue({ success: true, message: 'API key valid' });

    const res = await request(app)
      .post('/api/admin/settings/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiType: 'openai', apiKey: 'sk-test-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/integrations/status
// ---------------------------------------------------------------------------
describe('GET /api/admin/integrations/status', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/admin/integrations/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 with integration status for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockSettingsService.getIntegrationStatus.mockResolvedValue([
      { name: 'OpenAI', configured: true },
      { name: 'Stripe', configured: false },
    ]);

    const res = await request(app)
      .get('/api/admin/integrations/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('integrations');
    expect(res.body.totalConfigured).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/test-email
// ---------------------------------------------------------------------------
describe('POST /api/admin/test-email', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/admin/test-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'test@test.com' });

    expect(res.status).toBe(403);
  });

  it('should return 400 when SMTP is not configured', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    // getSettingValue returns null for all SMTP settings
    mockSettingsService.getSettingValue.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/test-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/compliance-stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/compliance-stats', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for non-admin user', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/admin/compliance-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 200 with compliance stats for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    // compliance-stats route does: const pool = require('../config/database')
    // then pool.query(...) — which maps to our mockQuery
    // 4 parallel pool.query calls via Promise.all
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })   // total contracts
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })    // active contracts
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })    // cancellations
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });   // pending compliance

    const res = await request(app)
      .get('/api/admin/compliance-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      totalContracts: 10,
      activeContracts: 7,
      cancellations: 2,
      pendingCompliance: 3,
    });
  });
});
