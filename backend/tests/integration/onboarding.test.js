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
const { pool } = require('../../config/database');

// Mock pool.connect for transactional routes
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
pool.connect = jest.fn().mockResolvedValue(mockClient);

describe('Onboarding Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
  });

  // ─── GET /api/onboarding/data ───────────────────────────────────────

  describe('GET /api/onboarding/data', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return onboarding data for authenticated user', async () => {
      const token = generateTestToken(testUsers.client.id);
      // Auth middleware
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      // pool.query calls inside the route handler:
      // 1. user data
      pool.query
        .mockResolvedValueOnce({ rows: [{ first_name: 'Client', last_name: 'User', email: 'client@test.com', phone: '555-0000' }] })
        // 2. profile data
        .mockResolvedValueOnce({ rows: [{ firstName: 'Client', lastName: 'User', email: 'client@test.com', onboarding_completed: false }] })
        // 3. current address
        .mockResolvedValueOnce({ rows: [{ street1: '123 Main', city: 'Miami', state: 'FL', zipCode: '33101' }] })
        // 4. previous addresses
        .mockResolvedValueOnce({ rows: [] })
        // 5. onboarding progress
        .mockResolvedValueOnce({ rows: [{ current_step: 3, form_data: {}, status: 'in_progress' }] })
        // 6. authorizations
        .mockResolvedValueOnce({ rows: [] })
        // 7. documents
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/onboarding/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.firstName).toBe('Client');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/onboarding/data');
      expect(res.status).toBe(401);
    });

    it('should return 500 on database error', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      pool.query.mockRejectedValueOnce(new Error('DB down'));

      const res = await request(app)
        .get('/api/onboarding/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/onboarding/save-progress ─────────────────────────────

  describe('POST /api/onboarding/save-progress', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should save progress for a valid step', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      // client.query: BEGIN, INSERT progress, UPDATE step bool, COMMIT
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT/UPSERT progress
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE step bool
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/onboarding/save-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ step: 2, data: { city: 'Miami' } });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.message).toBe('Progress saved');
    });

    it('should reject invalid step number', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const res = await request(app)
        .post('/api/onboarding/save-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ step: 99, data: {} });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/onboarding/status ─────────────────────────────────────

  describe('GET /api/onboarding/status', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return status when progress record exists', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      pool.query.mockResolvedValueOnce({
        rows: [{
          current_step: 4,
          status: 'in_progress',
          step_1_personal_info: true,
          step_2_current_address: true,
          step_3_address_history: true,
          step_4_employment: false,
          step_5_documents: false,
          step_6_authorizations: false,
          step_7_signature: false,
          completed_at: null,
          onboarding_completed: false,
        }],
      });

      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.currentStep).toBe(4);
      expect(res.body.data.steps.personalInfo).toBe(true);
    });

    it('should return not_started when no progress record', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('not_started');
      expect(res.body.data.currentStep).toBe(1);
      expect(res.body.data.completed).toBe(false);
    });
  });

  // ─── POST /api/onboarding/complete ──────────────────────────────────

  describe('POST /api/onboarding/complete', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should complete onboarding with valid data', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      // Mock all client.query calls inside the transaction
      mockClient.query.mockResolvedValue({ rows: [{ id: 1, status: 'active', plan_name: 'Basic' }], rowCount: 1 });

      const body = {
        firstName: 'Client',
        lastName: 'User',
        dateOfBirth: '1990-01-15',
        ssn: '123-45-6789',
        phone: '555-1234',
        email: 'client@test.com',
        currentAddress: { street1: '123 Main St', city: 'Miami', state: 'FL', zipCode: '33101' },
        authorizations: {
          fcraConsent: true,
          creditPullConsent: true,
          termsOfService: true,
          privacyPolicy: true,
        },
        signature: 'Client User',
        signatureDate: '2026-01-01T00:00:00Z',
        ipAddress: '127.0.0.1',
      };

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.data.completed).toBe(true);
    });

    it('should return 400 when subscription is missing', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      // BEGIN succeeds, then subscription check returns empty
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // subscription check

      const body = {
        firstName: 'Client',
        lastName: 'User',
        dateOfBirth: '1990-01-15',
        ssn: '123-45-6789',
        phone: '555-1234',
        email: 'client@test.com',
        currentAddress: { street1: '123 Main St', city: 'Miami', state: 'FL', zipCode: '33101' },
        authorizations: {
          fcraConsent: true,
          creditPullConsent: true,
          termsOfService: true,
          privacyPolicy: true,
        },
        signature: 'Client User',
        signatureDate: '2026-01-01T00:00:00Z',
      };

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/onboarding/legal-documents ────────────────────────────

  describe('GET /api/onboarding/legal-documents', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return legal documents', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const docs = [
        { document_type: 'terms', title: 'Terms of Service', content: '...', version: '1.0' },
        { document_type: 'privacy', title: 'Privacy Policy', content: '...', version: '1.0' },
      ];
      pool.query.mockResolvedValueOnce({ rows: docs });

      const res = await request(app)
        .get('/api/onboarding/legal-documents')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  // ─── GET /api/onboarding/legal-documents/:type ──────────────────────

  describe('GET /api/onboarding/legal-documents/:type', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return a specific legal document', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      pool.query.mockResolvedValueOnce({
        rows: [{ document_type: 'terms', title: 'Terms of Service', content: 'Full text', version: '1.0' }],
      });

      const res = await request(app)
        .get('/api/onboarding/legal-documents/terms')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document_type).toBe('terms');
    });

    it('should return 404 when document type not found', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/onboarding/legal-documents/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/onboarding/pending (staff/admin) ─────────────────────

  describe('GET /api/onboarding/pending', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return pending onboardings for admin', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

      const pending = [
        { id: 'c1', email: 'c1@test.com', current_step: 2, status: 'in_progress' },
      ];
      pool.query.mockResolvedValueOnce({ rows: pending });

      const res = await request(app)
        .get('/api/onboarding/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 403 for non-staff user', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const res = await request(app)
        .get('/api/onboarding/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/onboarding/client/:id (staff/admin) ──────────────────

  describe('GET /api/onboarding/client/:id', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should return client onboarding details for staff', async () => {
      const token = generateTestToken(testUsers.staff.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

      // 6 pool.query calls: profile, addresses, authorizations, signatures, documents, progress
      pool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'c1', first_name: 'Test' }] }) // profile
        .mockResolvedValueOnce({ rows: [] }) // addresses
        .mockResolvedValueOnce({ rows: [] }) // authorizations
        .mockResolvedValueOnce({ rows: [] }) // signatures
        .mockResolvedValueOnce({ rows: [] }) // documents
        .mockResolvedValueOnce({ rows: [{ current_step: 5, status: 'in_progress' }] }); // progress

      const res = await request(app)
        .get(`/api/onboarding/client/${testUsers.client.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.progress).toBeDefined();
    });
  });

  // ─── POST /api/onboarding/verify/:id (staff/admin) ─────────────────

  describe('POST /api/onboarding/verify/:id', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);
    });

    it('should verify client profile as admin', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

      // client.query: BEGIN, UPDATE profile, INSERT activity_log, COMMIT
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({ rowCount: 1 }) // INSERT activity_log
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post(`/api/onboarding/verify/${testUsers.client.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ verified: true, notes: 'All docs verified' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Profile verified successfully');
    });

    it('should return 403 for non-staff user', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const res = await request(app)
        .post(`/api/onboarding/verify/${testUsers.client.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ verified: true });

      expect(res.status).toBe(403);
    });
  });
});
