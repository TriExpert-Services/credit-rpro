/**
 * Credit Repair SaaS - Notification Routes
 * Endpoints para gestión de notificaciones
 *
 * @module routes/notifications
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getUserNotifications,
  markAsRead,
} = require('../services/notificationService');
const {
  sendSuccess,
  sendError,
  asyncHandler,
} = require('../utils/responseHelpers');

/**
 * @route   GET /api/notifications
 * @desc    Obtener notificaciones del usuario autenticado
 * @access  Private
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    const result = await getUserNotifications(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true',
    });

    sendSuccess(res, {
      notifications: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
    });
  })
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Obtener cantidad de notificaciones no leídas
 * @access  Private
 */
router.get(
  '/unread-count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await getUserNotifications(req.user.id, {
      limit: 0,
      unreadOnly: true,
    });

    sendSuccess(res, { unreadCount: result.unreadCount });
  })
);

/**
 * @route   PUT /api/notifications/read
 * @desc    Marcar notificaciones como leídas
 * @access  Private
 */
router.put(
  '/read',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;

    const updated = await markAsRead(req.user.id, notificationIds);

    sendSuccess(res, { updated }, 'Notifications marked as read');
  })
);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Marcar todas las notificaciones como leídas
 * @access  Private
 */
router.put(
  '/read-all',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const updated = await markAsRead(req.user.id);

    sendSuccess(res, { updated }, 'All notifications marked as read');
  })
);

module.exports = router;
