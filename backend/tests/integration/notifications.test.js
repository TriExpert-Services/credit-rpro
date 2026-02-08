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

const mockNotificationService = {
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  markAllAsRead: jest.fn(),
  send: jest.fn(),
  sendTemplateNotification: jest.fn(),
  getStats: jest.fn(),
};
jest.mock('../../utils/notificationService', () => mockNotificationService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

describe('Notifications Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/notifications ─────────────────────────────────────────

  describe('GET /api/notifications', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return notifications for authenticated user', async () => {
      const token = generateTestToken(testUsers.client.id);
      // Auth middleware user lookup
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const notifications = [
        { id: 1, subject: 'Welcome', message: 'Hello', is_read: false },
        { id: 2, subject: 'Update', message: 'Status changed', is_read: true },
      ];
      mockNotificationService.getNotifications.mockResolvedValueOnce(notifications);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.unreadCount).toBe(1);
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(testUsers.client.id, false);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(401);
    });

    it('should filter unread-only when query param set', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.getNotifications.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(testUsers.client.id, true);
    });

    it('should return 500 when service throws', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.getNotifications.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/notifications/:id/read ──────────────────────────────

  describe('PATCH /api/notifications/:id/read', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should mark notification as read', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.markAsRead.mockResolvedValueOnce();

      const res = await request(app)
        .patch('/api/notifications/42/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Notification marked as read');
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('42');
    });
  });

  // ─── PUT /api/notifications/:id/read ────────────────────────────────

  describe('PUT /api/notifications/:id/read', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should mark notification as read via PUT', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.markAsRead.mockResolvedValueOnce();

      const res = await request(app)
        .put('/api/notifications/99/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('99');
    });
  });

  // ─── DELETE /api/notifications/:id ──────────────────────────────────

  describe('DELETE /api/notifications/:id', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should delete a notification', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.deleteNotification.mockResolvedValueOnce();

      const res = await request(app)
        .delete('/api/notifications/10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Notification deleted');
      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith('10', testUsers.client.id);
    });
  });

  // ─── PUT /api/notifications/read-all ────────────────────────────────

  describe('PUT /api/notifications/read-all', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should mark all notifications as read', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });
      mockNotificationService.markAllAsRead.mockResolvedValueOnce();

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('All notifications marked as read');
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(testUsers.client.id);
    });
  });

  // ─── POST /api/notifications/send (admin) ──────────────────────────

  describe('POST /api/notifications/send', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send notification as admin', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
      mockNotificationService.send.mockResolvedValueOnce({ id: 'notif-1' });

      const res = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientId: testUsers.client.id,
          subject: 'Important',
          message: 'Please check your account',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Notification sent successfully');
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        testUsers.client.id,
        'admin_alert',
        'Important',
        'Please check your account',
        ['email', 'in_app']
      );
    });

    it('should return 403 for non-admin user', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const res = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: 'x', subject: 'Hi', message: 'Test' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when required fields are missing', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

      const res = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: testUsers.client.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing required fields');
    });
  });

  // ─── POST /api/notifications/send-template (admin) ─────────────────

  describe('POST /api/notifications/send-template', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send template notification as admin', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
      mockNotificationService.sendTemplateNotification.mockResolvedValueOnce({ id: 'tmpl-1' });

      const res = await request(app)
        .post('/api/notifications/send-template')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientId: testUsers.client.id,
          templateName: 'welcome',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Template notification sent successfully');
      expect(mockNotificationService.sendTemplateNotification).toHaveBeenCalledWith(
        testUsers.client.id,
        'welcome',
        {},
        ['email', 'in_app']
      );
    });

    it('should return 400 when recipientId or templateName missing', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

      const res = await request(app)
        .post('/api/notifications/send-template')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: testUsers.client.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing required fields: recipientId, templateName');
    });
  });

  // ─── GET /api/notifications/stats (admin) ──────────────────────────

  describe('GET /api/notifications/stats', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return stats for admin', async () => {
      const token = generateTestToken(testUsers.admin.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
      mockNotificationService.getStats.mockResolvedValueOnce({ total: 50, unread: 10 });

      const res = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toEqual({ total: 50, unread: 10 });
    });

    it('should return 403 for non-admin', async () => {
      const token = generateTestToken(testUsers.client.id);
      mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

      const res = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
