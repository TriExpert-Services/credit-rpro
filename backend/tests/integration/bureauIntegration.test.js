/**
 * Integration tests for Bureau Integration routes
 * POST /api/bureau/pull/:clientId/:bureau
 * POST /api/bureau/pull-all/:clientId
 * POST /api/bureau/pull-own/:bureau
 * GET  /api/bureau/status
 * PUT  /api/bureau/connections/:bureau
 * GET  /api/bureau/snapshots/:clientId
 * GET  /api/bureau/snapshots/:clientId/:bureau
 * GET  /api/bureau/snapshot/:snapshotId
 * GET  /api/bureau/changes/:clientId
 * GET  /api/bureau/changes/:clientId/timeline
 * GET  /api/bureau/compare/:clientId
 * GET  /api/bureau/pull-history/:clientId
 * GET  /api/bureau/auto-pull/:clientId
 * PUT  /api/bureau/auto-pull/:clientId
 */

require('../helpers/env');

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: (...args) => mockQuery(...args),
  transaction: (...args) => mockTransaction(...args),
  getPoolStats: jest.fn().mockReturnValue({}),
}));

jest.mock('../../utils/auditLogger', () => ({
  auditMiddleware: () => (req, res, next) => next(),
  recordAudit: jest.fn(),
  auditFromRequest: jest.fn(),
  AUDIT_ACTIONS: {},
  getAuditLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
}));

jest.mock('../../utils/sentry', () => ({
  initSentry: jest.fn(),
  sentryErrorHandler: () => (err, req, res, next) => next(err),
  captureError: jest.fn(),
  captureMessage: jest.fn(),
  Sentry: {},
}));

jest.mock('../../utils/bureauService', () => ({
  getBureauStatus: jest.fn().mockReturnValue({
    experian: { name: 'Experian', configured: false, mode: 'sandbox' },
    equifax: { name: 'Equifax', configured: false, mode: 'sandbox' },
    transunion: { name: 'TransUnion', configured: false, mode: 'sandbox' },
  }),
  getConnectionStatus: jest.fn().mockResolvedValue({ bureau: 'experian', isConfigured: false, mode: 'sandbox', connection: null }),
  saveConnection: jest.fn().mockResolvedValue({ id: 'c0000000-0000-4000-a000-000000000001', bureau: 'experian' }),
  pullReport: jest.fn().mockResolvedValue({
    pullId: 'p0000000-0000-4000-a000-000000000001',
    snapshot: { id: 's0000000-0000-4000-a000-000000000001' },
    report: { bureau: 'experian', score: { value: 720 } },
    changesDetected: [],
  }),
  pullAllBureaus: jest.fn().mockResolvedValue({
    results: {
      experian: { success: true },
      equifax: { success: true },
      transunion: { success: true },
    },
    crossBureauAnalysis: { scores: {}, discrepancies: [] },
    pulledAt: new Date().toISOString(),
  }),
  getLatestSnapshots: jest.fn().mockResolvedValue([
    { id: 's0000000-0000-4000-a000-000000000001', bureau: 'experian', score: 720 },
  ]),
  getChangeHistory: jest.fn().mockResolvedValue({ changes: [], total: 0, limit: 50, offset: 0 }),
  getChangeTimeline: jest.fn().mockResolvedValue([]),
  analyzeCrossBureau: jest.fn().mockResolvedValue({ scores: {}, discrepancies: [] }),
  getPullHistory: jest.fn().mockResolvedValue([]),
}));

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

// RFC4122-compliant UUIDs
const ADMIN_ID = testUsers.admin.id;
const STAFF_ID = testUsers.staff.id;
const CLIENT_ID = 'a0000000-0000-4000-a000-000000000003';
const SNAPSHOT_ID = 's0000000-0000-4000-a000-000000000001';

const adminToken = generateTestToken(ADMIN_ID);
const staffToken = generateTestToken(STAFF_ID);
const clientToken = generateTestToken(CLIENT_ID);

const mockAdminUser = { ...testUsers.admin };
const mockStaffUser = { ...testUsers.staff };
const mockClientUser = { ...testUsers.client, id: CLIENT_ID };

const bureauService = require('../../utils/bureauService');

describe('GET /api/bureau/status', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/bureau/status');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin/staff', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const res = await request(app)
      .get('/api/bureau/status')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 with bureau statuses for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get('/api/bureau/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(bureauService.getBureauStatus).toHaveBeenCalled();
  });
});

describe('PUT /api/bureau/connections/:bureau', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).put('/api/bureau/connections/experian');
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid bureau', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .put('/api/bureau/connections/invalid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: 'test' });
    expect(res.status).toBe(400);
  });

  it('should return 200 when admin updates connection', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .put('/api/bureau/connections/experian')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: 'exp_123', apiUrl: 'https://api.experian.com' });
    expect(res.status).toBe(200);
    expect(bureauService.saveConnection).toHaveBeenCalledWith('experian', expect.any(Object), ADMIN_ID);
  });
});

describe('POST /api/bureau/pull/:clientId/:bureau', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post(`/api/bureau/pull/${CLIENT_ID}/experian`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for clients', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const res = await request(app)
      .post(`/api/bureau/pull/${CLIENT_ID}/experian`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid bureau', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .post(`/api/bureau/pull/${CLIENT_ID}/badbureau`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('should return 201 for admin pulling report', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .post(`/api/bureau/pull/${CLIENT_ID}/experian`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(201);
    expect(bureauService.pullReport).toHaveBeenCalledWith(CLIENT_ID, 'experian', ADMIN_ID);
  });

  it('should return 201 for staff pulling report', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockStaffUser] });
    const res = await request(app)
      .post(`/api/bureau/pull/${CLIENT_ID}/transunion`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(201);
  });
});

describe('POST /api/bureau/pull-all/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post(`/api/bureau/pull-all/${CLIENT_ID}`);
    expect(res.status).toBe(401);
  });

  it('should return 201 for admin tri-bureau pull', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .post(`/api/bureau/pull-all/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(201);
    expect(bureauService.pullAllBureaus).toHaveBeenCalledWith(CLIENT_ID, ADMIN_ID);
  });
});

describe('POST /api/bureau/pull-own/:bureau', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/bureau/pull-own/experian');
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid bureau', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const res = await request(app)
      .post('/api/bureau/pull-own/badbureau')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(400);
  });

  it('should return 403 with inactive subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    // subscription check query
    mockQuery.mockResolvedValueOnce({ rows: [{ subscription_status: 'cancelled' }] });
    const res = await request(app)
      .post('/api/bureau/pull-own/experian')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 201 with active subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ subscription_status: 'active' }] });
    const res = await request(app)
      .post('/api/bureau/pull-own/equifax')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(201);
  });
});

describe('GET /api/bureau/snapshots/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/bureau/snapshots/${CLIENT_ID}`);
    expect(res.status).toBe(401);
  });

  it('should return 403 when client views another client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const otherId = 'b0000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .get(`/api/bureau/snapshots/${otherId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 for own snapshots', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const res = await request(app)
      .get(`/api/bureau/snapshots/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
  });

  it('should return 200 for admin viewing any client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/snapshots/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/bureau/snapshots/:clientId/:bureau', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 400 for invalid bureau', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/snapshots/${CLIENT_ID}/badbureau`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('should return 200 for valid request', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SNAPSHOT_ID, bureau: 'experian', score: 720 }] });
    const res = await request(app)
      .get(`/api/bureau/snapshots/${CLIENT_ID}/experian`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/bureau/snapshot/:snapshotId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/api/bureau/snapshot/${SNAPSHOT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 when client views other client snapshot', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SNAPSHOT_ID, client_id: 'b0000000-0000-4000-a000-000000000099', bureau: 'experian' }] });
    const res = await request(app)
      .get(`/api/bureau/snapshot/${SNAPSHOT_ID}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 for valid access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SNAPSHOT_ID, client_id: CLIENT_ID, bureau: 'experian', report_data: {} }] });
    const res = await request(app)
      .get(`/api/bureau/snapshot/${SNAPSHOT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/bureau/changes/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 403 when client views other client changes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const otherId = 'b0000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .get(`/api/bureau/changes/${otherId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 with change data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/changes/${CLIENT_ID}?bureau=experian&severity=high`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(bureauService.getChangeHistory).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ bureau: 'experian', severity: 'high' })
    );
  });
});

describe('GET /api/bureau/changes/:clientId/timeline', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 200 with timeline data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/changes/${CLIENT_ID}/timeline?months=6`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(bureauService.getChangeTimeline).toHaveBeenCalledWith(CLIENT_ID, 6);
  });
});

describe('GET /api/bureau/compare/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 200 with comparison', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/compare/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(bureauService.analyzeCrossBureau).toHaveBeenCalledWith(CLIENT_ID);
  });
});

describe('GET /api/bureau/pull-history/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 200 with pull history', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .get(`/api/bureau/pull-history/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(bureauService.getPullHistory).toHaveBeenCalledWith(CLIENT_ID, 20);
  });
});

describe('GET /api/bureau/auto-pull/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 403 when client views other client config', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const otherId = 'b0000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .get(`/api/bureau/auto-pull/${otherId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 with default config when none exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/api/bureau/auto-pull/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/bureau/auto-pull/:clientId', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('should return 400 for invalid frequency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .put(`/api/bureau/auto-pull/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, frequency: 'daily' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid bureaus', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    const res = await request(app)
      .put(`/api/bureau/auto-pull/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, bureaus: ['experian', 'fakeBureau'] });
    expect(res.status).toBe(400);
  });

  it('should return 200 when updating auto-pull config', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAdminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'x0000000-0000-4000-a000-000000000001', client_id: CLIENT_ID, enabled: true, frequency: 'monthly' }] });
    const res = await request(app)
      .put(`/api/bureau/auto-pull/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, frequency: 'monthly', bureaus: ['experian', 'equifax'] });
    expect(res.status).toBe(200);
  });

  it('should return 403 when client updates other client config', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockClientUser] });
    const otherId = 'b0000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .put(`/api/bureau/auto-pull/${otherId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ enabled: true, frequency: 'monthly' });
    expect(res.status).toBe(403);
  });
});
