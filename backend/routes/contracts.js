/**
 * Contracts Routes
 * Handle contract templates, signing, and compliance
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const contractService = require('../utils/contractService');

/**
 * GET /api/contracts/:contractType
 * Get contract template for viewing/signing
 */
router.get('/:contractType', authMiddleware, async (req, res) => {
  try {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/contracts/:contractType/sign
 * Sign a contract
 */
router.post('/:contractType/sign', authMiddleware, async (req, res) => {
  try {
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
    
    res.status(201).json({
      success: true,
      message: `Contract ${req.params.contractType} signed successfully`,
      signature
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/contracts/signed
 * Get all signed contracts for current user
 */
router.get('/signed', authMiddleware, async (req, res) => {
  try {
    const contracts = await contractService.getClientSignedContracts(req.user.id);
    
    res.json({
      success: true,
      contracts,
      totalSigned: contracts.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/contracts/verify/:contractType
 * Check if user has signed a specific contract
 */
router.get('/verify/:contractType', authMiddleware, async (req, res) => {
  try {
    const signed = await contractService.hasSignedContract(req.user.id, req.params.contractType);
    
    res.json({
      success: true,
      contractType: req.params.contractType,
      signed: !!signed,
      signedAt: signed?.signed_date || null
    });
  } catch (error) {
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
    const templates = await contractService.getAllTemplates(req.query.includeInactive === 'true');
    
    res.json({
      success: true,
      templates,
      totalTemplates: templates.length
    });
  } catch (error) {
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
    
    res.status(201).json({
      success: true,
      message: 'Contract template created successfully',
      template
    });
  } catch (error) {
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
    const complianceInfo = await contractService.getComplianceInfo(req.params.contractType);
    
    res.json({
      success: true,
      compliance: complianceInfo
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
