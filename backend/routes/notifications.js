/**
 * Notifications Routes
 * Handle multi-channel notifications
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin: adminOnly } = require('../middleware/auth');
const notificationService = require('../utils/notificationService');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching notifications');
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await notificationService.getNotifications(req.user.id, unreadOnly);
    
    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter(n => !n.is_read).length
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching notifications');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, notificationId: req.params.id }, 'Marking notification as read (PATCH)');
    await notificationService.markAsRead(req.params.id);
    
    auditFromRequest(req, 'notification.read', 'notification', req.params.id, 'Notification marked as read').catch(() => {});
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error marking notification as read');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read (alternative method)
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, notificationId: req.params.id }, 'Marking notification as read (PUT)');
    await notificationService.markAsRead(req.params.id);
    
    auditFromRequest(req, 'notification.read', 'notification', req.params.id, 'Notification marked as read').catch(() => {});
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error marking notification as read (PUT)');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, notificationId: req.params.id }, 'Deleting notification');
    await notificationService.deleteNotification(req.params.id, req.user.id);
    
    auditFromRequest(req, 'notification.deleted', 'notification', req.params.id, 'Notification deleted').catch(() => {});
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error deleting notification');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Marking all notifications as read');
    await notificationService.markAllAsRead(req.user.id);
    
    auditFromRequest(req, 'notification.read', 'notification', null, 'All notifications marked as read').catch(() => {});
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error marking all notifications as read');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/notifications/send
 * Send notification to a user
 */
router.post('/send', authMiddleware, adminOnly, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Sending notification');
    const { recipientId, notificationType, subject, message, channels } = req.body;
    
    if (!recipientId || !subject || !message) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }
    
    const result = await notificationService.send(
      recipientId,
      notificationType || 'admin_alert',
      subject,
      message,
      channels || ['email', 'in_app']
    );
    
    auditFromRequest(req, 'notification.sent', 'notification', result?.id, 'Notification sent').catch(() => {});
    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      result
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error sending notification');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/notifications/send-template
 * Send template-based notification
 */
router.post('/send-template', authMiddleware, adminOnly, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Sending template notification');
    const { recipientId, templateName, variables, channels } = req.body;
    
    if (!recipientId || !templateName) {
      return res.status(400).json({
        message: 'Missing required fields: recipientId, templateName'
      });
    }
    
    const result = await notificationService.sendTemplateNotification(
      recipientId,
      templateName,
      variables || {},
      channels || ['email', 'in_app']
    );
    
    auditFromRequest(req, 'notification.sent', 'notification', result?.id, 'Template notification sent').catch(() => {});
    res.status(201).json({
      success: true,
      message: 'Template notification sent successfully',
      result
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error sending template notification');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching notification stats');
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    
    const stats = await notificationService.getStats(startDate, endDate);
    
    res.json({
      success: true,
      stats,
      period: {
        start: startDate?.toISOString() || 'all_time',
        end: endDate?.toISOString() || 'all_time'
      }
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching notification stats');
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
