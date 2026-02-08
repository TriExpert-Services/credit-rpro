/**
 * AI Dispute Letter Routes
 * Endpoints for generating and managing AI-powered dispute letters using OpenAI
 */

const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
  generateDispute,
  saveDispute,
  getUserDisputes,
  getDispute,
  sendDispute,
  deleteDispute
} = require('../utils/aiDispute');
const {
  getCompleteStrategy,
  determineCurrentRound,
  estimateScoreImprovement,
  STRATEGY_ROUNDS,
  BUREAU_STRATEGIES,
  ITEM_TYPE_STRATEGIES
} = require('../utils/disputeStrategy');
const {
  sendSuccess,
  sendCreated,
  sendError,
  asyncHandler,
} = require('../utils/responseHelpers');
const { validate, generateAIDisputeSchema, saveAIDisputeSchema, idParam } = require('../middleware/zodValidation');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * @route   GET /api/ai-disputes/strategy/:creditItemId
 * @desc    Get recommended dispute strategy for a credit item
 * @access  Private
 */
router.get(
  '/strategy/:creditItemId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, creditItemId: req.params.creditItemId }, 'Getting dispute strategy for credit item');
    const { creditItemId } = req.params;
    const { bureau } = req.query;
    const userId = req.user.id;

    try {
      // Fetch credit item
      const itemResult = await pool.query(
        `SELECT ci.id, ci.item_type, ci.creditor_name, ci.account_number, ci.balance, 
                ci.status, ci.bureau, ci.date_opened, ci.date_reported
         FROM credit_items ci
         WHERE ci.id = $1 AND ci.client_id = $2`,
        [creditItemId, userId]
      );

      if (itemResult.rows.length === 0) {
        return sendError(res, 'Credit item not found', 404);
      }

      const item = itemResult.rows[0];
      const targetBureau = bureau || item.bureau || 'equifax';

      // Determine which round we're on
      const { round, previousResult } = await determineCurrentRound(pool, creditItemId, targetBureau);

      // Get strategy
      const strategy = getCompleteStrategy(item.item_type, targetBureau, round, previousResult);

      // Get latest score for impact estimation
      const scoreResult = await pool.query(
        `SELECT score FROM credit_scores WHERE client_id = $1 ORDER BY score_date DESC LIMIT 1`,
        [userId]
      );
      const currentScore = scoreResult.rows[0]?.score || 600;

      // Count total negative items
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM credit_items WHERE client_id = $1 AND status != 'resolved' AND status != 'deleted'`,
        [userId]
      );
      const totalNegativeItems = parseInt(countResult.rows[0]?.total || 1);

      // Estimate score improvement
      const scoreImpact = estimateScoreImprovement(item.item_type, currentScore, totalNegativeItems);

      sendSuccess(res, {
        creditItem: {
          id: item.id,
          itemType: item.item_type,
          creditorName: item.creditor_name,
          balance: item.balance,
          bureau: targetBureau
        },
        strategy,
        currentRound: round,
        previousResult,
        scoreImpact,
        allRounds: STRATEGY_ROUNDS
      }, 'Strategy recommendation retrieved');
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error getting dispute strategy');
      sendError(res, error.message || 'Failed to get strategy', 500);
    }
  })
);

/**
 * @route   GET /api/ai-disputes/strategies/overview
 * @desc    Get all available strategies, bureau info, and item type strategies
 * @access  Private
 */
router.get(
  '/strategies/overview',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Getting strategies overview');
    sendSuccess(res, {
      rounds: STRATEGY_ROUNDS,
      bureaus: BUREAU_STRATEGIES,
      itemTypes: Object.entries(ITEM_TYPE_STRATEGIES).map(([key, val]) => ({
        value: key,
        name: val.name,
        primaryStrategy: val.primaryStrategy,
        estimatedScoreImpact: val.estimatedScoreImpact,
        tips: val.tips.slice(0, 3),
        legalArguments: val.legalArguments
      }))
    }, 'Strategy overview retrieved');
  })
);

/**
 * @route   POST /api/ai-disputes/generate
 * @desc    Generate a dispute letter using OpenAI
 * @access  Private
 */
router.post(
  '/generate',
  authenticateToken,
  validate({ body: generateAIDisputeSchema }),
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, creditItemId: req.body.creditItemId }, 'Generating AI dispute letter');
    const { creditItemId, disputeType, bureau, additionalDetails } = req.body;
    const userId = req.user.id;

    try {
      // Generate the letter using OpenAI
      const result = await generateDispute(userId, creditItemId, disputeType, bureau, additionalDetails);

      auditFromRequest(req, 'ai_dispute.generated', 'ai_dispute', creditItemId, 'AI dispute letter generated').catch(() => {});
      sendSuccess(
        res,
        {
          letter: result.letter,
          creditItem: {
            id: result.creditItem.id,
            creditorName: result.creditItem.creditor_name,
            accountNumber: result.creditItem.account_number,
            balance: result.creditItem.balance,
            status: result.creditItem.status
          },
          bureau: result.bureau,
          disputeType: result.disputeType
        },
        'Dispute letter generated successfully with OpenAI'
      );
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error generating AI dispute letter');
      sendError(res, error.message || 'Failed to generate dispute letter', 500);
    }
  })
);

/**
 * @route   POST /api/ai-disputes/save
 * @desc    Save generated dispute letter to database
 * @access  Private
 */
router.post(
  '/save',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Saving AI dispute letter');
    const { creditItemId, content, disputeType, bureau } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!creditItemId || !content || !disputeType || !bureau) {
      return sendError(res, 'Missing required fields: creditItemId, content, disputeType, bureau', 400);
    }

    try {
      // Save the dispute
      const result = await saveDispute(userId, creditItemId, content, disputeType, bureau);

      auditFromRequest(req, 'ai_dispute.saved', 'ai_dispute', result.id, 'AI dispute letter saved as draft').catch(() => {});
      sendCreated(
        res,
        {
          id: result.id,
          status: result.status,
          createdAt: result.created_at
        },
        'Dispute letter saved successfully as draft'
      );
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error saving AI dispute letter');
      sendError(res, error.message || 'Failed to save dispute', 500);
    }
  })
);

/**
 * @route   GET /api/ai-disputes/drafts
 * @desc    Get all disputes (drafts and sent) for the user
 * @access  Private
 */
router.get(
  '/drafts',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Retrieving user dispute drafts');
    const userId = req.user.id;

    try {
      const result = await getUserDisputes(userId);

      sendSuccess(res, result, 'User disputes retrieved successfully');
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error retrieving dispute drafts');
      sendError(res, error.message || 'Failed to retrieve disputes', 500);
    }
  })
);

/**
 * @route   GET /api/ai-disputes/:id
 * @desc    Get dispute letter content
 * @access  Private
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, disputeId: req.params.id }, 'Retrieving dispute letter');
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await getDispute(id, userId);

      sendSuccess(res, result, 'Dispute retrieved successfully');
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error retrieving dispute letter');
      if (error.message === 'Dispute not found') {
        return sendError(res, 'Dispute not found', 404);
      }
      sendError(res, error.message || 'Failed to retrieve dispute', 500);
    }
  })
);

/**
 * @route   PATCH /api/ai-disputes/:id/send
 * @desc    Mark dispute as sent
 * @access  Private
 */
router.patch(
  '/:id/send',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, disputeId: req.params.id }, 'Marking dispute as sent');
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await sendDispute(id, userId);

      auditFromRequest(req, 'ai_dispute.sent', 'ai_dispute', id, 'AI dispute letter marked as sent').catch(() => {});
      sendSuccess(res, result, 'Dispute marked as sent with tracking number');
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error sending dispute');
      if (error.message.includes('not found')) {
        return sendError(res, error.message, 404);
      }
      sendError(res, error.message || 'Failed to send dispute', 500);
    }
  })
);

/**
 * @route   DELETE /api/ai-disputes/:id
 * @desc    Delete a dispute draft
 * @access  Private
 */
router.delete(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, disputeId: req.params.id }, 'Deleting dispute');
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await deleteDispute(id, userId);

      auditFromRequest(req, 'ai_dispute.deleted', 'ai_dispute', id, 'AI dispute letter deleted').catch(() => {});
      sendSuccess(res, result, 'Dispute deleted successfully');
    } catch (error) {
      logger.error({ err: error.message, userId: req.user?.id }, 'Error deleting dispute');
      if (error.message.includes('cannot be deleted')) {
        return sendError(res, error.message, 400);
      }
      if (error.message.includes('not found')) {
        return sendError(res, error.message, 404);
      }
      sendError(res, error.message || 'Failed to delete dispute', 500);
    }  })
);

module.exports = router;