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
  sendSuccess,
  sendCreated,
  sendError,
  asyncHandler,
} = require('../utils/responseHelpers');

/**
 * @route   POST /api/ai-disputes/generate
 * @desc    Generate a dispute letter using OpenAI
 * @access  Private
 */
router.post(
  '/generate',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { creditItemId, disputeType, bureau, additionalDetails } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!creditItemId || !disputeType || !bureau) {
      return sendError(res, 'Missing required fields: creditItemId, disputeType, bureau', 400);
    }

    try {
      // Generate the letter using OpenAI
      const result = await generateDispute(userId, creditItemId, disputeType, bureau, additionalDetails);

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
      console.error('Error generating dispute:', error);
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
    const { creditItemId, content, disputeType, bureau } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!creditItemId || !content || !disputeType || !bureau) {
      return sendError(res, 'Missing required fields: creditItemId, content, disputeType, bureau', 400);
    }

    try {
      // Save the dispute
      const result = await saveDispute(userId, creditItemId, content, disputeType, bureau);

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
      console.error('Error saving dispute:', error);
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
    const userId = req.user.id;

    try {
      const result = await getUserDisputes(userId);

      sendSuccess(res, result, 'User disputes retrieved successfully');
    } catch (error) {
      console.error('Error retrieving disputes:', error);
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
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await getDispute(id, userId);

      sendSuccess(res, result, 'Dispute retrieved successfully');
    } catch (error) {
      console.error('Error retrieving dispute:', error);
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
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await sendDispute(id, userId);

      sendSuccess(res, result, 'Dispute marked as sent with tracking number');
    } catch (error) {
      console.error('Error sending dispute:', error);
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
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await deleteDispute(id, userId);

      sendSuccess(res, result, 'Dispute deleted successfully');
    } catch (error) {
      console.error('Error deleting dispute:', error);
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