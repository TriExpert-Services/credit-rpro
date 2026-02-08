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

const mockInvoiceService = {
  getClientInvoices: jest.fn(),
  getInvoice: jest.fn(),
  generateInvoice: jest.fn(),
  sendInvoice: jest.fn(),
  processPayment: jest.fn(),
  getUnpaidInvoices: jest.fn(),
  updateOverdueInvoices: jest.fn(),
  getBillingStats: jest.fn(),
  generateMonthlyReport: jest.fn(),
};
jest.mock('../../utils/invoiceService', () => mockInvoiceService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

// ---------------------------------------------------------------------------
// GET /api/invoices  (auth)
// ---------------------------------------------------------------------------
describe('GET /api/invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('should return invoices for a client user (own invoices)', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const invoices = [
      { id: 'inv-1', total_amount: '100.00', status: 'pending' },
      { id: 'inv-2', total_amount: '50.00', status: 'paid' },
    ];
    mockInvoiceService.getClientInvoices.mockResolvedValueOnce(invoices);

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoices).toHaveLength(2);
    expect(res.body.totalCount).toBe(2);
    // Client sees own invoices — service called with client's id
    expect(mockInvoiceService.getClientInvoices).toHaveBeenCalledWith(testUsers.client.id, undefined);
  });

  it('should allow admin to filter by clientId', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const invoices = [{ id: 'inv-3', total_amount: '200.00', status: 'pending' }];
    mockInvoiceService.getClientInvoices.mockResolvedValueOnce(invoices);

    const res = await request(app)
      .get('/api/invoices?clientId=some-client-id&status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockInvoiceService.getClientInvoices).toHaveBeenCalledWith('some-client-id', 'pending');
  });

  it('should return 500 when service throws', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getClientInvoices.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/invoices/:id  (auth + ownership)
// ---------------------------------------------------------------------------
describe('GET /api/invoices/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/invoices/inv-1');
    expect(res.status).toBe(401);
  });

  it('should return 404 when invoice not found', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/invoices/inv-999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 when client tries to access another user invoice', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce({
      id: 'inv-1',
      client_id: 'some-other-user-id',
      total_amount: '100.00',
    });

    const res = await request(app)
      .get('/api/invoices/inv-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return invoice when client is the owner', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce({
      id: 'inv-1',
      client_id: testUsers.client.id,
      total_amount: '100.00',
    });

    const res = await request(app)
      .get('/api/invoices/inv-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice.id).toBe('inv-1');
  });

  it('should allow admin to access any invoice', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce({
      id: 'inv-1',
      client_id: 'some-other-user-id',
      total_amount: '100.00',
    });

    const res = await request(app)
      .get('/api/invoices/inv-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.invoice.id).toBe('inv-1');
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'c1', amount: 100, description: 'Service fee' });

    expect(res.status).toBe(403);
  });

  it('should return 400 when required fields are missing', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'c1' }); // missing amount and description

    expect(res.status).toBe(400);
  });

  it('should create invoice for admin with valid data', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const newInvoice = { id: 'inv-new', client_id: 'c1', total_amount: 150, status: 'pending' };
    mockInvoiceService.generateInvoice.mockResolvedValueOnce(newInvoice);

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'c1', amount: 150, description: 'Monthly service' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice.id).toBe('inv-new');
    expect(mockInvoiceService.generateInvoice).toHaveBeenCalledWith('c1', 150, 'Monthly service', null, null);
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices/:id/send  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/invoices/:id/send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/invoices/inv-1/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientEmail: 'client@test.com' });

    expect(res.status).toBe(403);
  });

  it('should send invoice for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockInvoiceService.sendInvoice.mockResolvedValueOnce({ sent: true });

    const res = await request(app)
      .post('/api/invoices/inv-1/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientEmail: 'client@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockInvoiceService.sendInvoice).toHaveBeenCalledWith('inv-1', 'client@test.com');
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices/:id/pay  (auth)
// ---------------------------------------------------------------------------
describe('POST /api/invoices/:id/pay', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/invoices/inv-1/pay');
    expect(res.status).toBe(401);
  });

  it('should return 400 when paymentMethod is missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/invoices/inv-1/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should process payment successfully', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    mockInvoiceService.processPayment.mockResolvedValueOnce({ paid: true });

    const res = await request(app)
      .post('/api/invoices/inv-1/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentMethod: 'card', stripePaymentId: 'pi_123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockInvoiceService.processPayment).toHaveBeenCalledWith('inv-1', 'card', 'pi_123');
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices/:id/pay  (error case)
// ---------------------------------------------------------------------------
describe('POST /api/invoices/:id/pay (service error)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 500 when processPayment throws', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.processPayment.mockRejectedValueOnce(new Error('Payment gateway error'));

    const res = await request(app)
      .post('/api/invoices/inv-1/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentMethod: 'card' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices (admin — service error)
// ---------------------------------------------------------------------------
describe('POST /api/invoices (service error)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 500 when generateInvoice throws', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockInvoiceService.generateInvoice.mockRejectedValueOnce(new Error('DB constraint'));

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'c1', amount: 100, description: 'Fee' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/invoices/unpaid  (shadowed by /:id — Express matches /:id first)
// ---------------------------------------------------------------------------
describe('GET /api/invoices/unpaid', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 404 because /:id route matches first (id="unpaid")', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/invoices/unpaid')
      .set('Authorization', `Bearer ${token}`);

    // /:id catches 'unpaid' as an id, getInvoice returns null → 404
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/invoices/update-overdue  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/invoices/update-overdue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/invoices/update-overdue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should update overdue invoices for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const updated = [{ id: 'inv-1' }, { id: 'inv-2' }];
    mockInvoiceService.updateOverdueInvoices.mockResolvedValueOnce(updated);

    const res = await request(app)
      .post('/api/invoices/update-overdue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('2');
  });
});

// ---------------------------------------------------------------------------
// GET /api/invoices/stats  (shadowed by /:id — Express matches /:id first)
// ---------------------------------------------------------------------------
describe('GET /api/invoices/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 404 because /:id route matches first (id="stats")', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockInvoiceService.getInvoice.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/invoices/stats')
      .set('Authorization', `Bearer ${token}`);

    // /:id catches 'stats' as an id, getInvoice returns null → 404
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/invoices/report/:year/:month  (admin only)
// ---------------------------------------------------------------------------
describe('GET /api/invoices/report/:year/:month', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/invoices/report/2026/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return monthly report for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const report = { total: 10, revenue: 1500 };
    mockInvoiceService.generateMonthlyReport.mockResolvedValueOnce(report);

    const res = await request(app)
      .get('/api/invoices/report/2026/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.total).toBe(10);
    expect(mockInvoiceService.generateMonthlyReport).toHaveBeenCalledWith(2026, 1);
  });
});
