/**
 * Plaid Routes - Bank Account Verification API
 * Endpoints for connecting bank accounts via Plaid
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const plaidService = require('../utils/plaidService');
const { sendSuccess, sendError, sendInternalError } = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// ============================================================================
// POST /api/plaid/create-link-token - Create a link token for Plaid Link
// ============================================================================
router.post('/create-link-token', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Create Plaid link token');
    const { products } = req.body;
    
    const result = await plaidService.createLinkToken(
      req.user.id,
      'TriExpert Credit Repair',
      products || ['auth', 'identity']
    );

    auditFromRequest(req, 'plaid.linked', 'plaid', null, 'Plaid link token created').catch(() => {});
    return sendSuccess(res, result);
  } catch (error) {
    logger.error({ err: error.message }, 'Error creating Plaid link token');
    return sendInternalError(res, 'Error al crear token de conexión bancaria');
  }
});

// ============================================================================
// POST /api/plaid/exchange-token - Exchange public token for access token
// ============================================================================
router.post('/exchange-token', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Exchange Plaid public token');
    const { publicToken, metadata } = req.body;

    if (!publicToken) {
      return sendError(res, 'Public token is required');
    }

    const result = await plaidService.exchangePublicToken(publicToken, req.user.id);

    // Store institution info if provided
    if (metadata?.institution) {
      const { query } = require('../config/database');
      await query(
        `UPDATE plaid_items SET 
          institution_id = $1, 
          institution_name = $2,
          updated_at = CURRENT_TIMESTAMP
         WHERE item_id = $3`,
        [metadata.institution.institution_id, metadata.institution.name, result.itemId]
      );
    }

    // Get identity and accounts after linking
    try {
      await plaidService.getIdentity(result.accessToken, req.user.id);
      await plaidService.getAccounts(result.accessToken, req.user.id);
    } catch (e) {
      logger.error({ err: e.message }, 'Could not fetch identity/accounts immediately');
    }

    auditFromRequest(req, 'plaid.linked', 'plaid', result.itemId, 'Bank account linked via Plaid').catch(() => {});
    return sendSuccess(res, {
      success: true,
      itemId: result.itemId,
      message: 'Cuenta bancaria conectada exitosamente',
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Error exchanging Plaid token');
    return sendInternalError(res, 'Error al conectar cuenta bancaria');
  }
});

// ============================================================================
// GET /api/plaid/accounts - Get user's linked bank accounts
// ============================================================================
router.get('/accounts', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Get linked bank accounts');
    const accounts = await plaidService.getUserAccounts(req.user.id);

    return sendSuccess(res, { accounts });
  } catch (error) {
    logger.error({ err: error.message }, 'Error getting bank accounts');
    return sendInternalError(res, 'Error al obtener cuentas bancarias');
  }
});

// ============================================================================
// GET /api/plaid/verification-status - Get identity verification status
// ============================================================================
router.get('/verification-status', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Get identity verification status');
    const status = await plaidService.getVerificationStatus(req.user.id);

    return sendSuccess(res, {
      isVerified: status?.verification_status === 'verified',
      verifiedName: status?.verified_name,
      verifiedAt: status?.verified_at,
      verifiedEmail: status?.verified_email,
      verifiedPhone: status?.verified_phone,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Error getting verification status');
    return sendInternalError(res, 'Error al verificar estado');
  }
});

// ============================================================================
// POST /api/plaid/refresh-identity - Refresh identity verification
// ============================================================================
router.post('/refresh-identity', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Refresh identity verification');
    const { query } = require('../config/database');
    
    // Get user's active item
    const itemResult = await query(
      `SELECT access_token FROM plaid_items 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (itemResult.rows.length === 0) {
      return sendError(res, 'No hay cuenta bancaria conectada', 404);
    }

    const identity = await plaidService.getIdentity(
      itemResult.rows[0].access_token,
      req.user.id
    );

    auditFromRequest(req, 'plaid.refreshed', 'plaid', null, 'Identity refreshed via Plaid').catch(() => {});
    return sendSuccess(res, {
      success: true,
      identity,
      message: 'Identidad verificada exitosamente',
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Error refreshing identity');
    return sendInternalError(res, 'Error al verificar identidad');
  }
});

// ============================================================================
// POST /api/plaid/get-transactions - Get recent transactions
// ============================================================================
router.post('/get-transactions', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Get recent transactions');
    const { days = 30 } = req.body;
    const { query } = require('../config/database');
    
    // Get user's active item
    const itemResult = await query(
      `SELECT access_token FROM plaid_items 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (itemResult.rows.length === 0) {
      return sendError(res, 'No hay cuenta bancaria conectada', 404);
    }

    const transactions = await plaidService.getTransactions(
      itemResult.rows[0].access_token,
      req.user.id,
      days
    );

    return sendSuccess(res, transactions);
  } catch (error) {
    logger.error({ err: error.message }, 'Error getting transactions');
    return sendInternalError(res, 'Error al obtener transacciones');
  }
});

// ============================================================================
// DELETE /api/plaid/accounts/:itemId - Remove a linked account
// ============================================================================
router.delete('/accounts/:itemId', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Remove linked bank account');
    const { itemId } = req.params;

    await plaidService.removeItem(itemId, req.user.id);

    auditFromRequest(req, 'plaid.deleted', 'plaid', itemId, 'Bank account disconnected').catch(() => {});
    return sendSuccess(res, {
      success: true,
      message: 'Cuenta bancaria desconectada',
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Error removing bank account');
    return sendInternalError(res, 'Error al desconectar cuenta');
  }
});

// ============================================================================
// POST /api/plaid/webhook - Handle Plaid webhooks
// ============================================================================
router.post('/webhook', async (req, res) => {
  try {
    logger.info('Plaid webhook received');
    await plaidService.handleWebhook(req.body);
    res.json({ received: true });
  } catch (error) {
    logger.error({ err: error.message }, 'Error handling Plaid webhook');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
