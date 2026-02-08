/**
 * Disputes Routes - Secured with ownership checks and validation
 */
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const {
  createDisputeValidation,
  DISPUTE_STATUSES,
} = require('../utils/validators');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendForbidden,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// Real bureau addresses for dispute letters
const BUREAU_ADDRESSES = {
  experian: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
  equifax: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374',
  transunion: 'TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016',
};

// Dispute letter templates
const disputeTemplates = {
    not_mine: (client, item, bureau) => `
${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${BUREAU_ADDRESSES[bureau.toLowerCase()] || bureau.toUpperCase() + ' Credit Bureau'}

Re: Dispute of Inaccurate Information

Dear Sir/Madam,

I am writing to dispute the following information in my credit file. The items I dispute are circled on the attached copy of my credit report.

Account: ${item.creditor_name}
Account Number: ${item.account_number || 'N/A'}

This item is inaccurate because this account does not belong to me. I have never opened an account with ${item.creditor_name}, and I did not authorize anyone to open this account on my behalf.

I am requesting that you remove this item from my credit report as it is not mine and is damaging my credit score.

Please conduct a complete investigation of my dispute and remove the inaccurate information as soon as possible.

Sincerely,

${client.first_name} ${client.last_name}
${client.address_line1 || ''}
${client.city || ''}, ${client.state || ''} ${client.zip_code || ''}
SSN: XXX-XX-${client.ssn_last_4 || 'XXXX'}
`,
    inaccurate_info: (client, item, bureau) => `
${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${BUREAU_ADDRESSES[bureau.toLowerCase()] || bureau.toUpperCase() + ' Credit Bureau'}

Re: Request for Investigation - Inaccurate Information

Dear Credit Bureau,

I recently reviewed my credit report and found inaccurate information that needs to be corrected immediately.

The following account contains errors:
Creditor: ${item.creditor_name}
Account: ${item.account_number || 'N/A'}
Issue: ${item.description || 'Contains inaccurate information'}

Under the Fair Credit Reporting Act, I have the right to dispute inaccurate information. I request that you investigate this matter and remove or correct the inaccurate data within 30 days.

Please send me written confirmation of your investigation results and any corrections made to my credit file.

Respectfully,

${client.first_name} ${client.last_name}
${client.address_line1 || ''}
${client.city || ''}, ${client.state || ''} ${client.zip_code || ''}
`
};

/**
 * Verify ownership of a dispute
 */
const verifyDisputeOwnership = async (disputeId, userId, userRole) => {
  const result = await query('SELECT client_id FROM disputes WHERE id = $1', [disputeId]);
  if (result.rows.length === 0) return { found: false };
  if (userRole === 'admin' || userRole === 'staff') return { found: true, owned: true };
  return { found: true, owned: result.rows[0].client_id === userId };
};

// Get all disputes for a client (ownership verified)
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    logger.info({ userId: req.user?.id, clientId }, 'Fetching disputes for client');

    // Clients can only view their own disputes
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const result = await query(
      `SELECT d.id, d.client_id, d.credit_item_id, d.dispute_type, d.bureau,
              d.status, d.letter_content, d.sent_date, d.response_date, d.response_text,
              d.tracking_number, d.created_at, d.updated_at,
              ci.creditor_name, ci.account_number
       FROM disputes d
       LEFT JOIN credit_items ci ON d.credit_item_id = ci.id
       WHERE d.client_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [clientId, Math.min(100, parseInt(limit)), offset]
    );

    sendSuccess(res, { disputes: result.rows });
  })
);

// Create new dispute with letter (with validation and ownership)
router.post(
  '/',
  authenticateToken,
  createDisputeValidation,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Creating new dispute');
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { clientId, creditItemId, disputeType, bureau } = req.body;

    // Clients can only create disputes for themselves
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    // Get client and credit item info (no password_hash returned)
    const clientResult = await query(
      `SELECT u.first_name, u.last_name, cp.address_line1, cp.city, cp.state, cp.zip_code, cp.ssn_last_4
       FROM users u
       JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [clientId]
    );

    const itemResult = await query(
      'SELECT id, creditor_name, account_number, description FROM credit_items WHERE id = $1',
      [creditItemId]
    );

    if (clientResult.rows.length === 0 || itemResult.rows.length === 0) {
      return sendNotFound(res, 'Client or credit item');
    }

    const client = clientResult.rows[0];
    const item = itemResult.rows[0];

    // Verify credit item belongs to client
    const itemOwnership = await query(
      'SELECT client_id FROM credit_items WHERE id = $1 AND client_id = $2',
      [creditItemId, clientId]
    );
    if (itemOwnership.rows.length === 0) {
      return sendForbidden(res, 'Credit item does not belong to this client');
    }

    // Generate letter content
    const letterTemplate = disputeTemplates[disputeType] || disputeTemplates.inaccurate_info;
    const letterContent = letterTemplate(client, item, bureau);

    // Create dispute record
    const result = await query(
      `INSERT INTO disputes (client_id, credit_item_id, dispute_type, bureau, letter_content, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING id, client_id, credit_item_id, dispute_type, bureau, letter_content, status, created_at`,
      [clientId, creditItemId, disputeType, bureau, letterContent]
    );

    // Update credit item status
    await query(
      `UPDATE credit_items SET status = 'disputing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [creditItemId]
    );

    auditFromRequest(req, 'dispute.created', 'dispute', result.rows[0]?.id, 'Dispute created').catch(() => {});

    sendCreated(res, { dispute: result.rows[0] }, 'Dispute created successfully');
  })
);

// Update dispute status (with ownership check and status validation)
router.put(
  '/:id/status',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, disputeId: req.params.id }, 'Updating dispute status');
    const { status, sentDate, responseDate, responseText, trackingNumber } = req.body;

    // Validate status if provided
    if (status && !DISPUTE_STATUSES.includes(status.toLowerCase())) {
      return sendError(res, `Status must be one of: ${DISPUTE_STATUSES.join(', ')}`);
    }

    // Verify ownership
    const ownership = await verifyDisputeOwnership(req.params.id, req.user.id, req.user.role);
    if (!ownership.found) return sendNotFound(res, 'Dispute');
    if (!ownership.owned) return sendForbidden(res, 'Access denied');

    await query(
      `UPDATE disputes 
       SET status = COALESCE($1, status),
           sent_date = COALESCE($2, sent_date),
           response_date = COALESCE($3, response_date),
           response_text = COALESCE($4, response_text),
           tracking_number = COALESCE($5, tracking_number),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [status?.toLowerCase(), sentDate, responseDate, responseText, trackingNumber, req.params.id]
    );

    auditFromRequest(req, 'dispute.updated', 'dispute', req.params.id, 'Dispute status updated').catch(() => {});

    sendSuccess(res, {}, 'Dispute updated successfully');
  })
);

// Get dispute by ID (with ownership check)
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, disputeId: req.params.id }, 'Fetching dispute by ID');
    // Verify ownership
    const ownership = await verifyDisputeOwnership(req.params.id, req.user.id, req.user.role);
    if (!ownership.found) return sendNotFound(res, 'Dispute');
    if (!ownership.owned) return sendForbidden(res, 'Access denied');

    const result = await query(
      `SELECT d.id, d.client_id, d.credit_item_id, d.dispute_type, d.bureau,
              d.status, d.letter_content, d.sent_date, d.response_date, d.response_text,
              d.tracking_number, d.created_at, d.updated_at,
              ci.creditor_name, ci.account_number,
              u.first_name, u.last_name
       FROM disputes d
       LEFT JOIN credit_items ci ON d.credit_item_id = ci.id
       LEFT JOIN users u ON d.client_id = u.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Dispute');
    }

    sendSuccess(res, { dispute: result.rows[0] });
  })
);

module.exports = router;
