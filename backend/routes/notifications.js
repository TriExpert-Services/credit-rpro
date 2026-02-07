/**
 * Notifications Routes
 * Handle multi-channel notifications
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin: adminOnly } = require('../middleware/auth');
const notificationService = require('../utils/notificationService');

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await notificationService.getNotifications(req.user.id, unreadOnly);
    
    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter(n => !n.is_read).length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read (alternative method)
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/notifications/send
 * Send notification to a user
 */
router.post('/send', authMiddleware, adminOnly, async (req, res) => {
  try {
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
    
    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/notifications/send-template
 * Send template-based notification
 */
router.post('/send-template', authMiddleware, adminOnly, async (req, res) => {
  try {
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
    
    res.status(201).json({
      success: true,
      message: 'Template notification sent successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
