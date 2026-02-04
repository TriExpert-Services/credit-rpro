/**
 * Credit Repair SaaS - Tracking Routes
 * Endpoints para rastreo del proceso de reparación de crédito
 *
 * @module routes/tracking
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, canAccessClient } = require('../middleware/auth');
const {
  getClientTimeline,
  getClientProcessStatus,
  getProcessSummary,
  checkAndAwardMilestones,
  PROCESS_STAGES,
  MILESTONES,
} = require('../services/trackingService');
const {
  sendSuccess,
  sendError,
  asyncHandler,
} = require('../utils/responseHelpers');

/**
 * @route   GET /api/tracking/stages
 * @desc    Obtener lista de etapas del proceso
 * @access  Private
 */
router.get(
  '/stages',
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { stages: Object.values(PROCESS_STAGES) });
  })
);

/**
 * @route   GET /api/tracking/milestones
 * @desc    Obtener lista de hitos disponibles
 * @access  Private
 */
router.get(
  '/milestones',
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { milestones: Object.values(MILESTONES) });
  })
);

/**
 * @route   GET /api/tracking/client/:clientId/status
 * @desc    Obtener estado del proceso de un cliente
 * @access  Private (client own or staff/admin)
 */
router.get(
  '/client/:clientId/status',
  authenticateToken,
  canAccessClient,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    const status = await getClientProcessStatus(clientId);

    sendSuccess(res, { status });
  })
);

/**
 * @route   GET /api/tracking/client/:clientId/summary
 * @desc    Obtener resumen del proceso para dashboard
 * @access  Private (client own or staff/admin)
 */
router.get(
  '/client/:clientId/summary',
  authenticateToken,
  canAccessClient,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    const summary = await getProcessSummary(clientId);

    sendSuccess(res, { summary });
  })
);

/**
 * @route   GET /api/tracking/client/:clientId/timeline
 * @desc    Obtener timeline de un cliente
 * @access  Private (client own or staff/admin)
 */
router.get(
  '/client/:clientId/timeline',
  authenticateToken,
  canAccessClient,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const {
      limit = 50,
      offset = 0,
      eventTypes,
      startDate,
      endDate,
    } = req.query;

    const timeline = await getClientTimeline(clientId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      eventTypes: eventTypes ? eventTypes.split(',') : null,
      startDate,
      endDate,
    });

    sendSuccess(res, timeline);
  })
);

/**
 * @route   POST /api/tracking/client/:clientId/check-milestones
 * @desc    Verificar y otorgar hitos pendientes
 * @access  Private (client own or staff/admin)
 */
router.post(
  '/client/:clientId/check-milestones',
  authenticateToken,
  canAccessClient,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    const newMilestones = await checkAndAwardMilestones(clientId);

    sendSuccess(res, {
      newMilestones,
      message: newMilestones.length > 0
        ? `${newMilestones.length} new milestone(s) achieved!`
        : 'No new milestones',
    });
  })
);

/**
 * @route   GET /api/tracking/my/status
 * @desc    Obtener mi estado del proceso (shortcut para clientes)
 * @access  Private
 */
router.get(
  '/my/status',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const status = await getClientProcessStatus(req.user.id);
    sendSuccess(res, { status });
  })
);

/**
 * @route   GET /api/tracking/my/summary
 * @desc    Obtener mi resumen del proceso (shortcut para clientes)
 * @access  Private
 */
router.get(
  '/my/summary',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const summary = await getProcessSummary(req.user.id);
    sendSuccess(res, { summary });
  })
);

/**
 * @route   GET /api/tracking/my/timeline
 * @desc    Obtener mi timeline (shortcut para clientes)
 * @access  Private
 */
router.get(
  '/my/timeline',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    const timeline = await getClientTimeline(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    sendSuccess(res, timeline);
  })
);

module.exports = router;
