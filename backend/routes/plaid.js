/**
 * Plaid Routes - Bank Account Verification API
 * Endpoints for connecting bank accounts via Plaid
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const plaidService = require('../utils/plaidService');
const { sendSuccess, sendError, sendInternalError } = require('../utils/responseHelpers');

// ============================================================================
// POST /api/plaid/create-link-token - Create a link token for Plaid Link
// ============================================================================
router.post('/create-link-token', auth, async (req, res) => {
  try {
    const { products } = req.body;
    
    const result = await plaidService.createLinkToken(
      req.user.id,
      'TriExpert Credit Repair',
      products || ['auth', 'identity']
    );

    return sendSuccess(res, result);
  } catch (error) {
    console.error('Error creating link token:', error);
    return sendInternalError(res, 'Error al crear token de conexión bancaria');
  }
});

// ============================================================================
// POST /api/plaid/exchange-token - Exchange public token for access token
// ============================================================================
router.post('/exchange-token', auth, async (req, res) => {
  try {
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
      console.log('Could not fetch identity/accounts immediately:', e.message);
    }

    return sendSuccess(res, {
      success: true,
      itemId: result.itemId,
      message: 'Cuenta bancaria conectada exitosamente',
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return sendInternalError(res, 'Error al conectar cuenta bancaria');
  }
});

// ============================================================================
// GET /api/plaid/accounts - Get user's linked bank accounts
// ============================================================================
router.get('/accounts', auth, async (req, res) => {
  try {
    const accounts = await plaidService.getUserAccounts(req.user.id);

    return sendSuccess(res, { accounts });
  } catch (error) {
    console.error('Error getting accounts:', error);
    return sendInternalError(res, 'Error al obtener cuentas bancarias');
  }
});

// ============================================================================
// GET /api/plaid/verification-status - Get identity verification status
// ============================================================================
router.get('/verification-status', auth, async (req, res) => {
  try {
    const status = await plaidService.getVerificationStatus(req.user.id);

    return sendSuccess(res, {
      isVerified: status?.verification_status === 'verified',
      verifiedName: status?.verified_name,
      verifiedAt: status?.verified_at,
      verifiedEmail: status?.verified_email,
      verifiedPhone: status?.verified_phone,
    });
  } catch (error) {
    console.error('Error getting verification status:', error);
    return sendInternalError(res, 'Error al verificar estado');
  }
});

// ============================================================================
// POST /api/plaid/refresh-identity - Refresh identity verification
// ============================================================================
router.post('/refresh-identity', auth, async (req, res) => {
  try {
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

    return sendSuccess(res, {
      success: true,
      identity,
      message: 'Identidad verificada exitosamente',
    });
  } catch (error) {
    console.error('Error refreshing identity:', error);
    return sendInternalError(res, 'Error al verificar identidad');
  }
});

// ============================================================================
// POST /api/plaid/get-transactions - Get recent transactions
// ============================================================================
router.post('/get-transactions', auth, async (req, res) => {
  try {
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
    console.error('Error getting transactions:', error);
    return sendInternalError(res, 'Error al obtener transacciones');
  }
});

// ============================================================================
// DELETE /api/plaid/accounts/:itemId - Remove a linked account
// ============================================================================
router.delete('/accounts/:itemId', auth, async (req, res) => {
  try {
    const { itemId } = req.params;

    await plaidService.removeItem(itemId, req.user.id);

    return sendSuccess(res, {
      success: true,
      message: 'Cuenta bancaria desconectada',
    });
  } catch (error) {
    console.error('Error removing account:', error);
    return sendInternalError(res, 'Error al desconectar cuenta');
  }
});

// ============================================================================
// POST /api/plaid/webhook - Handle Plaid webhooks
// ============================================================================
router.post('/webhook', async (req, res) => {
  try {
    await plaidService.handleWebhook(req.body);
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
