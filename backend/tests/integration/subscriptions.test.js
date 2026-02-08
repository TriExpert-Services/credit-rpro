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

const mockStripeService = {
  getPlans: jest.fn(),
  getClientSubscription: jest.fn(),
  getAccessStatus: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  cancelSubscription: jest.fn(),
  getPaymentHistory: jest.fn(),
  processRefund: jest.fn(),
};
jest.mock('../../utils/stripeService', () => mockStripeService);

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');
const { generateTestToken, testUsers } = require('../helpers/setup');

// ---------------------------------------------------------------------------
// GET /api/subscriptions/plans  (no auth)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/plans', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return plans without authentication', async () => {
    const plans = [
      { id: 1, name: 'Basic', price: 49.99 },
      { id: 2, name: 'Pro', price: 99.99 },
    ];
    mockStripeService.getPlans.mockResolvedValueOnce(plans);

    const res = await request(app).get('/api/subscriptions/plans');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(plans);
    expect(mockStripeService.getPlans).toHaveBeenCalledTimes(1);
  });

  it('should return 500 when stripeService.getPlans throws', async () => {
    mockStripeService.getPlans.mockRejectedValueOnce(new Error('Stripe down'));

    const res = await request(app).get('/api/subscriptions/plans');

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/current  (auth)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/current', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/subscriptions/current');
    expect(res.status).toBe(401);
  });

  it('should return hasSubscription false when no subscription', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockStripeService.getClientSubscription.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasSubscription).toBe(false);
  });

  it('should return subscription data when subscription exists', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const sub = {
      id: 'sub-1',
      plan_name: 'Pro',
      plan_description: 'Pro Plan',
      features: ['feature1'],
      status: 'active',
      billing_cycle: 'monthly',
      current_period_start: '2026-01-01',
      current_period_end: '2026-02-01',
      cancel_at_period_end: false,
      guarantee_start_date: '2026-01-01',
      guarantee_end_date: '2026-04-01',
      disputes_this_month: 2,
      max_disputes_per_month: 10,
    };
    mockStripeService.getClientSubscription.mockResolvedValueOnce(sub);

    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasSubscription).toBe(true);
    expect(res.body.data.subscription.planName).toBe('Pro');
    expect(res.body.data.subscription.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/access-status  (auth)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/access-status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/subscriptions/access-status');
    expect(res.status).toBe(401);
  });

  it('should return admin bypass for admin users', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const res = await request(app)
      .get('/api/subscriptions/access-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(true);
    expect(res.body.data.hasAccess).toBe(true);
    expect(mockStripeService.getAccessStatus).not.toHaveBeenCalled();
  });

  it('should return admin bypass for staff users', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .get('/api/subscriptions/access-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(true);
    expect(res.body.data.hasAccess).toBe(true);
  });

  it('should call getAccessStatus for client users', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const accessData = { hasAccess: true, onboardingComplete: true, hasSubscription: true, subscriptionStatus: 'active' };
    mockStripeService.getAccessStatus.mockResolvedValueOnce(accessData);

    const res = await request(app)
      .get('/api/subscriptions/access-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(false);
    expect(res.body.data.hasAccess).toBe(true);
    expect(mockStripeService.getAccessStatus).toHaveBeenCalledWith(testUsers.client.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscriptions/checkout  (auth)
// ---------------------------------------------------------------------------
describe('POST /api/subscriptions/checkout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/subscriptions/checkout');
    expect(res.status).toBe(401);
  });

  it('should return 400 when planId is missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 when profile not found', async () => {
    const token = generateTestToken(testUsers.client.id);
    // auth middleware
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    // pool.query for profile check
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 'plan-1' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when step_6_authorizations not completed', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    pool.query.mockResolvedValueOnce({
      rows: [{ step_6_authorizations: false, current_step: 5, first_name: 'Client', last_name: 'User' }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 'plan-1' });

    expect(res.status).toBe(400);
  });

  it('should create checkout session when valid', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    pool.query.mockResolvedValueOnce({
      rows: [{ step_6_authorizations: true, current_step: 7, first_name: 'Client', last_name: 'User' }],
      rowCount: 1,
    });
    mockStripeService.createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/session/cs_123',
    });

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 'plan-1', billingCycle: 'monthly' });

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe('cs_123');
    expect(res.body.data.checkoutUrl).toContain('stripe.com');
    expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(testUsers.client.id, 'plan-1', 'monthly');
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscriptions/portal  (auth)
// ---------------------------------------------------------------------------
describe('POST /api/subscriptions/portal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/subscriptions/portal');
    expect(res.status).toBe(401);
  });

  it('should return portal URL', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockStripeService.createPortalSession.mockResolvedValueOnce({ url: 'https://billing.stripe.com/session/ps_123' });

    const res = await request(app)
      .post('/api/subscriptions/portal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('stripe.com');
    expect(mockStripeService.createPortalSession).toHaveBeenCalledWith(testUsers.client.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscriptions/cancel  (auth)
// ---------------------------------------------------------------------------
describe('POST /api/subscriptions/cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/subscriptions/cancel');
    expect(res.status).toBe(401);
  });

  it('should return 400 when reason is missing', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should cancel subscription with reason', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
    mockStripeService.cancelSubscription.mockResolvedValueOnce({ canceledAt: '2026-03-01' });

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Too expensive' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBeDefined();
    expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith(testUsers.client.id, 'Too expensive', false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/payments  (auth)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/payments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/subscriptions/payments');
    expect(res.status).toBe(401);
  });

  it('should return payment history', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const history = { payments: [{ id: 'pay-1', amount: 99.99 }], total: 1 };
    mockStripeService.getPaymentHistory.mockResolvedValueOnce(history);

    const res = await request(app)
      .get('/api/subscriptions/payments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.payments).toHaveLength(1);
    expect(mockStripeService.getPaymentHistory).toHaveBeenCalledWith(testUsers.client.id, 20, 0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscriptions/guarantee-claim  (auth)
// ---------------------------------------------------------------------------
describe('POST /api/subscriptions/guarantee-claim', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/subscriptions/guarantee-claim');
    expect(res.status).toBe(401);
  });

  it('should return 400 when reason is too short', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    // pool.connect for the transaction client
    const mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/subscriptions/guarantee-claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'short' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/admin/stats  (admin only)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/admin/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/subscriptions/admin/stats');
    expect(res.status).toBe(401);
  });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/subscriptions/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return stats for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    // active subs query
    pool.query
      .mockResolvedValueOnce({ rows: [{ active_subscriptions: '5', trialing: '1' }] })
      // monthly revenue
      .mockResolvedValueOnce({ rows: [{ subscription_revenue: '500.00', refunds: '50.00', payment_count: '5' }] })
      // guarantee claims
      .mockResolvedValueOnce({ rows: [{ total_claims: '2', pending_claims: '1', total_refunded: '100.00' }] })
      // plan distribution
      .mockResolvedValueOnce({ rows: [{ name: 'Pro', subscribers: '3' }] });

    const res = await request(app)
      .get('/api/subscriptions/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.subscriptions.active).toBe(5);
    expect(res.body.data.monthlyRevenue.gross).toBe(500);
    expect(res.body.data.guaranteeClaims.pending).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/admin/guarantee-claims  (admin only)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/admin/guarantee-claims', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/subscriptions/admin/guarantee-claims')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return claims for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const claims = [{ id: 'claim-1', client_id: testUsers.client.id, status: 'pending' }];
    pool.query.mockResolvedValueOnce({ rows: claims });

    const res = await request(app)
      .get('/api/subscriptions/admin/guarantee-claims')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('claim-1');
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscriptions/admin/process-claim/:claimId  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/subscriptions/admin/process-claim/:claimId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/subscriptions/admin/process-claim/claim-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', notes: 'ok' });

    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid action', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/subscriptions/admin/process-claim/claim-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'invalid', notes: 'test' });

    expect(res.status).toBe(400);
  });

  it('should deny a claim successfully', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    // BEGIN
    mockClient.query.mockResolvedValueOnce({});
    // SELECT claim
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'claim-1', client_id: testUsers.client.id, total_paid: 99.99, status: 'pending' }],
    });
    // UPDATE claim
    mockClient.query.mockResolvedValueOnce({});
    // INSERT notification
    mockClient.query.mockResolvedValueOnce({});
    // COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/subscriptions/admin/process-claim/claim-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'deny', notes: 'Not eligible' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('denied');
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscriptions/admin/transactions  (admin only)
// ---------------------------------------------------------------------------
describe('GET /api/subscriptions/admin/transactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get('/api/subscriptions/admin/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return transactions for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    const txns = [
      { id: 'txn-1', amount: 99.99, email: 'client@test.com', plan_name: 'Pro' },
    ];
    pool.query.mockResolvedValueOnce({ rows: txns });

    const res = await request(app)
      .get('/api/subscriptions/admin/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('txn-1');
  });
});
