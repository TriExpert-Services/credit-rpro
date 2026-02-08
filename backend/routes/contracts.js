/**
 * Contracts Routes
 * Handle contract templates, signing, and compliance
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const contractService = require('../utils/contractService');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * GET /api/contracts/:contractType
 * Get contract template for viewing/signing
 */
router.get('/:contractType', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, contractType: req.params.contractType }, 'Fetching contract template');
    const clientData = {
      clientName: `${req.user.first_name} ${req.user.last_name}`,
      todayDate: new Date().toLocaleDateString()
    };
    
    const contract = await contractService.getContractForSigning(req.params.contractType, clientData);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    res.json({
      success: true,
      contract
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching contract template');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/contracts/:contractType/sign
 * Sign a contract
 */
router.post('/:contractType/sign', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, contractType: req.params.contractType }, 'Signing contract');
    const { signatureData, signatureMethod } = req.body;
    
    if (!signatureData) {
      return res.status(400).json({ message: 'Signature data required' });
    }
    
    // Get contract template
    const template = await contractService.getTemplate(req.params.contractType);
    if (!template) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    
    // Sign contract
    const signature = await contractService.signContract(
      req.user.id,
      template.id,
      signatureData,
      signatureMethod || 'digital',
      req.ip,
      req.headers['user-agent']
    );
    
    auditFromRequest(req, 'contract.signed', 'contract', signature?.id, `Contract ${req.params.contractType} signed`).catch(() => {});
    res.status(201).json({
      success: true,
      message: `Contract ${req.params.contractType} signed successfully`,
      signature
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error signing contract');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/contracts/signed
 * Get all signed contracts for current user
 */
router.get('/signed', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching signed contracts');
    const contracts = await contractService.getClientSignedContracts(req.user.id);
    
    res.json({
      success: true,
      contracts,
      totalSigned: contracts.length
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching signed contracts');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/contracts/verify/:contractType
 * Check if user has signed a specific contract
 */
router.get('/verify/:contractType', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, contractType: req.params.contractType }, 'Verifying contract signature');
    const signed = await contractService.hasSignedContract(req.user.id, req.params.contractType);
    
    res.json({
      success: true,
      contractType: req.params.contractType,
      signed: !!signed,
      signedAt: signed?.signed_date || null
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error verifying contract signature');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/contracts/templates
 * Get all contract templates
 */
router.get('/templates', authMiddleware, async (req, res) => {
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    logger.info({ userId: req.user?.id }, 'Fetching contract templates');
    const templates = await contractService.getAllTemplates(req.query.includeInactive === 'true');
    
    res.json({
      success: true,
      templates,
      totalTemplates: templates.length
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching contract templates');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/contracts/templates
 * Create a new contract template
 */
router.post('/templates', authMiddleware, async (req, res) => {
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    logger.info({ userId: req.user?.id }, 'Creating contract template');
    const { contractType, templateContent, effectiveDate } = req.body;
    
    if (!contractType || !templateContent || !effectiveDate) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }
    
    const template = await contractService.createTemplate(
      contractType,
      templateContent,
      effectiveDate,
      req.user.id
    );
    
    auditFromRequest(req, 'contract.created', 'contract', template?.id, 'Contract template created').catch(() => {});
    res.status(201).json({
      success: true,
      message: 'Contract template created successfully',
      template
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error creating contract template');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/contracts/compliance/:contractType
 * Get compliance info for a contract
 */
router.get('/compliance/:contractType', authMiddleware, async (req, res) => {
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    logger.info({ userId: req.user?.id, contractType: req.params.contractType }, 'Fetching contract compliance info');
    const complianceInfo = await contractService.getComplianceInfo(req.params.contractType);
    
    res.json({
      success: true,
      compliance: complianceInfo
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching contract compliance info');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/contracts/cancel
 * Submit cancellation request (CROA 3-day right to cancel)
 */
router.post('/cancel', authMiddleware, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    logger.info({ userId: req.user?.id }, 'Processing contract cancellation');
    const { reason, submittedAt } = req.body;
    const userId = req.user.id;
    
    // Check if user has an active subscription/contract
    const contractCheck = await query(
      `SELECT id, signed_date FROM client_contracts 
       WHERE client_id = $1 AND is_valid = true 
       ORDER BY signed_date DESC LIMIT 1`,
      [userId]
    );
    
    // Calculate if within 3 business days (CROA requirement)
    let withinCancellationPeriod = true;
    let cancellationDeadline = null;
    
    if (contractCheck.rows.length > 0) {
      const signedDate = new Date(contractCheck.rows[0].signed_date);
      // Add 3 business days
      let businessDays = 0;
      cancellationDeadline = new Date(signedDate);
      while (businessDays < 3) {
        cancellationDeadline.setDate(cancellationDeadline.getDate() + 1);
        const dayOfWeek = cancellationDeadline.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          businessDays++;
        }
      }
      withinCancellationPeriod = new Date() <= cancellationDeadline;
    }
    
    // Record cancellation request
    await query(
      `INSERT INTO cancellation_requests (
        user_id, reason, submitted_at, within_croa_period, 
        cancellation_deadline, status, ip_address
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [userId, reason || 'Not specified', submittedAt, withinCancellationPeriod, cancellationDeadline, req.ip]
    );
    
    // If within CROA period, automatically process cancellation
    if (withinCancellationPeriod) {
      // Invalidate contracts
      await query(
        `UPDATE client_contracts SET is_valid = false, 
         cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = $1
         WHERE client_id = $2 AND is_valid = true`,
        [reason || 'CROA 3-day cancellation', userId]
      );
      
      // Cancel any active subscription
      await query(
        `UPDATE subscriptions SET status = 'cancelled', 
         cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'CROA 3-day right to cancel'
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }
    
    // Log audit entry
    await query(
      `INSERT INTO audit_log (user_id, action, action_type, entity_type, compliance_context, ip_address, details)
       VALUES ($1, 'Cancellation request submitted', 'cancel', 'contract', 'croa', $2, $3)`,
      [userId, req.ip, JSON.stringify({ 
        withinCancellationPeriod, 
        reason,
        cancellationDeadline 
      })]
    );
    
    auditFromRequest(req, 'contract.cancelled', 'contract', contractCheck.rows[0]?.id, 'Contract cancellation requested').catch(() => {});
    res.json({
      success: true,
      message: withinCancellationPeriod 
        ? 'Cancellation processed successfully under CROA 3-day right to cancel'
        : 'Cancellation request received and will be reviewed',
      withinCroaPeriod: withinCancellationPeriod,
      cancellationDeadline
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error processing contract cancellation');
    res.status(500).json({ success: false, message: 'Error processing cancellation request' });
  }
});

module.exports = router;
