/**
 * Credit Repair SaaS - AI Routes
 * Endpoints para funcionalidades de inteligencia artificial
 *
 * @module routes/ai
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, canAccessClient, requireStaff } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const {
  generateDisputeLetter,
  analyzeCreditReport,
  generateCreditRecommendations,
  BUREAU_ADDRESSES,
} = require('../services/aiService');
const {
  sendNotification,
  NOTIFICATION_TYPES,
} = require('../services/notificationService');
const {
  recordTimelineEvent,
  TIMELINE_EVENT_TYPES,
  checkAndAwardMilestones,
} = require('../services/trackingService');
const {
  sendSuccess,
  sendCreated,
  sendError,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');
const { validateUUID, validateBureau, validateDisputeType } = require('../utils/validators');

/**
 * @route   POST /api/ai/generate-dispute-letter
 * @desc    Generar carta de disputa con AI
 * @access  Private
 */
router.post(
  '/generate-dispute-letter',
  authenticateToken,
  [
    validateUUID('clientId', 'body'),
    body('creditItemId').optional().isUUID(),
    validateDisputeType(),
    validateBureau(false),
    body('additionalContext').optional().isString().isLength({ max: 2000 }),
    body('language').optional().isIn(['en', 'es']),
    body('tone').optional().isIn(['professional', 'assertive', 'formal']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const {
      clientId,
      creditItemId,
      disputeType,
      bureau,
      additionalContext,
      language = 'en',
      tone = 'professional',
    } = req.body;

    // Verificar acceso al cliente
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendError(res, 'Access denied', 403);
    }

    // Obtener información del cliente
    const clientResult = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              cp.date_of_birth, cp.ssn_last_4, cp.address_line1,
              cp.city, cp.state, cp.zip_code
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return sendError(res, 'Client not found', 404);
    }

    const client = clientResult.rows[0];

    // Obtener información del item de crédito si se especificó
    let creditItem = {
      creditorName: 'Unknown Creditor',
      accountNumber: '',
      itemType: 'other',
      balance: null,
      dateReported: null,
    };

    if (creditItemId) {
      const itemResult = await query(
        'SELECT * FROM credit_items WHERE id = $1 AND client_id = $2',
        [creditItemId, clientId]
      );

      if (itemResult.rows.length > 0) {
        const item = itemResult.rows[0];
        creditItem = {
          id: item.id,
          creditorName: item.creditor_name,
          accountNumber: item.account_number || '',
          itemType: item.item_type,
          balance: item.balance,
          dateReported: item.date_reported,
        };
      }
    }

    // Generar carta con AI
    const result = await generateDisputeLetter({
      clientInfo: {
        firstName: client.first_name,
        lastName: client.last_name,
        address: client.address_line1,
        city: client.city,
        state: client.state,
        zipCode: client.zip_code,
        ssnLast4: client.ssn_last_4,
        dateOfBirth: client.date_of_birth,
      },
      creditItem,
      disputeType,
      bureau,
      additionalContext,
      tone,
      language,
    });

    // Registrar en log de AI
    await query(
      `INSERT INTO ai_generation_logs
       (client_id, generation_type, provider, success, created_at)
       VALUES ($1, 'dispute_letter', $2, true, CURRENT_TIMESTAMP)`,
      [clientId, result.metadata.provider]
    );

    sendSuccess(res, {
      letter: result.content,
      metadata: result.metadata,
      bureauAddress: BUREAU_ADDRESSES[bureau],
    });
  })
);

/**
 * @route   POST /api/ai/create-dispute-with-letter
 * @desc    Crear disputa y generar carta con AI en un solo paso
 * @access  Private
 */
router.post(
  '/create-dispute-with-letter',
  authenticateToken,
  [
    validateUUID('clientId', 'body'),
    body('creditItemId').optional().isUUID(),
    validateDisputeType(),
    validateBureau(false),
    body('additionalContext').optional().isString().isLength({ max: 2000 }),
    body('language').optional().isIn(['en', 'es']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const {
      clientId,
      creditItemId,
      disputeType,
      bureau,
      additionalContext,
      language = 'en',
    } = req.body;

    // Verificar acceso
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendError(res, 'Access denied', 403);
    }

    // Obtener información del cliente
    const clientResult = await query(
      `SELECT u.*, cp.*
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return sendError(res, 'Client not found', 404);
    }

    const client = clientResult.rows[0];

    // Obtener item de crédito
    let creditItem = null;
    if (creditItemId) {
      const itemResult = await query(
        'SELECT * FROM credit_items WHERE id = $1 AND client_id = $2',
        [creditItemId, clientId]
      );
      if (itemResult.rows.length > 0) {
        creditItem = itemResult.rows[0];
      }
    }

    // Generar carta
    const letterResult = await generateDisputeLetter({
      clientInfo: {
        firstName: client.first_name,
        lastName: client.last_name,
        address: client.address_line1,
        city: client.city,
        state: client.state,
        zipCode: client.zip_code,
        ssnLast4: client.ssn_last_4,
        dateOfBirth: client.date_of_birth,
      },
      creditItem: creditItem ? {
        creditorName: creditItem.creditor_name,
        accountNumber: creditItem.account_number || '',
        itemType: creditItem.item_type,
        balance: creditItem.balance,
        dateReported: creditItem.date_reported,
      } : {
        creditorName: 'Unknown',
        accountNumber: '',
        itemType: 'other',
        balance: null,
        dateReported: null,
      },
      disputeType,
      bureau,
      additionalContext,
      language,
    });

    // Crear disputa en transacción
    const dispute = await transaction(async (dbClient) => {
      // Insertar disputa
      const disputeResult = await dbClient.query(
        `INSERT INTO disputes
         (client_id, credit_item_id, dispute_type, bureau, letter_content, status, ai_generated, generation_provider, language)
         VALUES ($1, $2, $3, $4, $5, 'draft', true, $6, $7)
         RETURNING *`,
        [clientId, creditItemId, disputeType, bureau, letterResult.content, letterResult.metadata.provider, language]
      );

      const dispute = disputeResult.rows[0];

      // Actualizar estado del item si existe
      if (creditItemId) {
        await dbClient.query(
          "UPDATE credit_items SET status = 'disputing', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [creditItemId]
        );
      }

      // Registrar log de AI
      await dbClient.query(
        `INSERT INTO ai_generation_logs
         (client_id, dispute_id, generation_type, provider, success)
         VALUES ($1, $2, 'dispute_letter', $3, true)`,
        [clientId, dispute.id, letterResult.metadata.provider]
      );

      return dispute;
    });

    // Registrar en timeline
    await recordTimelineEvent({
      clientId,
      eventType: TIMELINE_EVENT_TYPES.DISPUTE_CREATED,
      title: 'Disputa creada con AI',
      description: `Carta de disputa generada para ${creditItem?.creditor_name || 'item'} (${bureau})`,
      metadata: { disputeId: dispute.id, aiGenerated: true },
      relatedEntityType: 'dispute',
      relatedEntityId: dispute.id,
    });

    // Notificar
    await sendNotification({
      userId: clientId,
      type: NOTIFICATION_TYPES.DISPUTE_CREATED,
      data: {
        creditorName: creditItem?.creditor_name || 'Unknown',
        bureau,
        disputeId: dispute.id,
      },
      language,
    });

    // Verificar hitos
    await checkAndAwardMilestones(clientId);

    sendCreated(res, {
      dispute: {
        id: dispute.id,
        disputeType: dispute.dispute_type,
        bureau: dispute.bureau,
        status: dispute.status,
        letterContent: dispute.letter_content,
        aiGenerated: true,
        createdAt: dispute.created_at,
      },
      bureauAddress: BUREAU_ADDRESSES[bureau],
    }, 'Dispute created with AI-generated letter');
  })
);

/**
 * @route   POST /api/ai/analyze-credit-report
 * @desc    Analizar reporte de crédito con AI
 * @access  Private (staff/admin only)
 */
router.post(
  '/analyze-credit-report',
  authenticateToken,
  requireStaff,
  [
    validateUUID('clientId', 'body'),
    body('reportText').notEmpty().isString().isLength({ min: 100, max: 50000 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { clientId, reportText } = req.body;

    try {
      const analysis = await analyzeCreditReport(reportText);

      // Registrar en log
      await query(
        `INSERT INTO ai_generation_logs
         (client_id, generation_type, provider, success)
         VALUES ($1, 'credit_analysis', 'ai', true)`,
        [clientId]
      );

      // Registrar en timeline
      await recordTimelineEvent({
        clientId,
        eventType: TIMELINE_EVENT_TYPES.STAGE_CHANGED,
        title: 'Reporte de crédito analizado',
        description: `Se identificaron ${analysis.items?.length || 0} items potencialmente disputables`,
        metadata: { itemsFound: analysis.items?.length || 0 },
        performedBy: req.user.id,
      });

      sendSuccess(res, { analysis });
    } catch (error) {
      await query(
        `INSERT INTO ai_generation_logs
         (client_id, generation_type, provider, success, error_message)
         VALUES ($1, 'credit_analysis', 'ai', false, $2)`,
        [clientId, error.message]
      );
      throw error;
    }
  })
);

/**
 * @route   GET /api/ai/recommendations/:clientId
 * @desc    Obtener recomendaciones personalizadas con AI
 * @access  Private
 */
router.get(
  '/recommendations/:clientId',
  authenticateToken,
  canAccessClient,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    // Obtener datos del cliente
    const [scoresResult, itemsResult, disputesResult] = await Promise.all([
      query(
        `SELECT bureau, score, score_date FROM credit_scores
         WHERE client_id = $1 ORDER BY score_date DESC LIMIT 9`,
        [clientId]
      ),
      query(
        'SELECT * FROM credit_items WHERE client_id = $1',
        [clientId]
      ),
      query(
        'SELECT * FROM disputes WHERE client_id = $1',
        [clientId]
      ),
    ]);

    const recommendations = await generateCreditRecommendations({
      creditScores: scoresResult.rows,
      creditItems: itemsResult.rows,
      disputes: disputesResult.rows,
    });

    sendSuccess(res, { recommendations });
  })
);

/**
 * @route   GET /api/ai/bureau-addresses
 * @desc    Obtener direcciones de los bureaus de crédito
 * @access  Public
 */
router.get('/bureau-addresses', (req, res) => {
  sendSuccess(res, { bureaus: BUREAU_ADDRESSES });
});

module.exports = router;
