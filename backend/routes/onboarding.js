/**
 * Onboarding Routes
 * Handle client registration flows: self-service and admin-guided
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const onboardingService = require('../utils/onboardingService');
const contractService = require('../utils/contractService');

// admin role checks are performed inline in routes

/**
 * POST /api/onboarding/start
 * Start onboarding process
 */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { onboardingType } = req.body;
    
    if (!onboardingType) {
      return res.status(400).json({
        message: 'onboardingType required: "self_service" or "admin_guided"'
      });
    }
    
    const onboarding = await onboardingService.startOnboarding(req.user.id, onboardingType);
    
    res.status(201).json({
      success: true,
      message: 'Onboarding started',
      onboarding
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding/status
 * Get onboarding status for current user
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = await onboardingService.getOnboardingStatus(req.user.id);
    
    if (!status) {
      return res.status(404).json({ message: 'Onboarding not started' });
    }
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding/progress
 * Get onboarding progress
 */
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const progress = await onboardingService.getProgress(req.user.id);
    
    if (!progress) {
      return res.status(404).json({ message: 'Onboarding not started' });
    }
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/profile
 * Complete profile step
 */
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { dateOfBirth, ssnLast4, address1, address2, city, state, zipCode } = req.body;
    
    if (!dateOfBirth || !address1 || !city || !state || !zipCode) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }
    
    const result = await onboardingService.completeProfileStep(req.user.id, {
      dateOfBirth,
      ssnLast4,
      address1,
      address2,
      city,
      state,
      zipCode
    });
    
    res.json({
      success: true,
      message: 'Profile step completed',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/documents
 * Upload documents step
 */
router.post('/documents', authMiddleware, async (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        message: 'documents array required'
      });
    }
    
    const result = await onboardingService.uploadDocumentsStep(req.user.id, documents);
    
    res.json({
      success: true,
      message: 'Documents uploaded',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/sign-contracts
 * Sign required contracts
 */
router.post('/sign-contracts', authMiddleware, async (req, res) => {
  try {
    const contractTypes = [
      'service_agreement',
      'privacy_policy',
      'payment_terms',
      'dispute_authorization'
    ];
    
    const result = await onboardingService.signContractsStep(req.user.id, contractTypes);
    
    res.json({
      success: true,
      message: 'Contracts signed successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/verify-payment
 * Verify payment information
 */
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { paymentMethod, stripeTokenId } = req.body;
    
    if (!paymentMethod) {
      return res.status(400).json({
        message: 'paymentMethod required'
      });
    }
    
    const result = await onboardingService.verifyPaymentStep(
      req.user.id,
      paymentMethod,
      stripeTokenId
    );
    
    res.json({
      success: true,
      message: 'Payment verified',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/complete
 * Complete onboarding
 */
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const result = await onboardingService.completeOnboarding(req.user.id);
    
    res.json({
      success: true,
      message: 'Onboarding completed successfully!',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/abandon
 * Abandon onboarding
 */
router.post('/abandon', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const result = await onboardingService.abandonOnboarding(req.user.id, reason);
    
    res.json({
      success: true,
      message: 'Onboarding abandoned',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/onboarding/pending
 * Get all pending onboardings
 */
router.get('/pending', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    // TODO: Implement query to get pending onboardings
    res.json({
      success: true,
      message: 'Endpoint implementation pending'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
