/**
 * Invoices Routes
 * Handle billing, invoices, and payment tracking
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const invoiceService = require('../utils/invoiceService');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * GET /api/invoices
 * Get invoices for current client
 */
router.get('/', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting client invoices');
  try {
    const clientId = req.user.role === 'admin' ? req.query.clientId : req.user.id;
    const status = req.query.status;
    
    if (!clientId) {
      return res.status(400).json({ message: 'Client ID required' });
    }
    
    const invoices = await invoiceService.getClientInvoices(clientId, status);
    
    res.json({
      success: true,
      invoices,
      totalCount: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error getting client invoices');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/invoices/:id
 * Get specific invoice
 */
router.get('/:id', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id, invoiceId: req.params.id }, 'Getting invoice details');
  try {
    const invoice = await invoiceService.getInvoice(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Verify ownership
    if (req.user.role !== 'admin' && invoice.client_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error getting invoice details');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/invoices
 * Generate invoice
 */
router.post('/', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Generating invoice');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { clientId, amount, description, billingPeriodStart, billingPeriodEnd } = req.body;
    
    if (!clientId || !amount || !description) {
      return res.status(400).json({
        message: 'Missing required fields: clientId, amount, description'
      });
    }
    
    const invoice = await invoiceService.generateInvoice(
      clientId,
      parseFloat(amount),
      description,
      billingPeriodStart ? new Date(billingPeriodStart) : null,
      billingPeriodEnd ? new Date(billingPeriodEnd) : null
    );
    
    auditFromRequest(req, 'invoice.created', 'invoice', invoice.id, 'Invoice generated').catch(() => {});
    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      invoice
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error generating invoice');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/invoices/:id/send
 * Send invoice to client
 */
router.post('/:id/send', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id, invoiceId: req.params.id }, 'Sending invoice');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { clientEmail } = req.body;
    
    const result = await invoiceService.sendInvoice(req.params.id, clientEmail);
    
    auditFromRequest(req, 'invoice.sent', 'invoice', req.params.id, 'Invoice sent to client').catch(() => {});
    res.json({
      success: true,
      message: 'Invoice sent successfully',
      result
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error sending invoice');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/invoices/:id/pay
 * Record payment for invoice (Stripe integration)
 */
router.post('/:id/pay', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id, invoiceId: req.params.id }, 'Processing invoice payment');
  try {
    const { paymentMethod, stripePaymentId } = req.body;
    
    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method required' });
    }
    
    const result = await invoiceService.processPayment(
      req.params.id,
      paymentMethod,
      stripePaymentId
    );
    
    auditFromRequest(req, 'invoice.paid', 'invoice', req.params.id, 'Invoice payment processed').catch(() => {});
    res.json({
      success: true,
      message: 'Payment processed successfully',
      result
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error processing invoice payment');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/unpaid
 * Get all unpaid invoices
 */
router.get('/unpaid', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting unpaid invoices');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const unpaid = await invoiceService.getUnpaidInvoices();
    
    res.json({
      success: true,
      unpaidInvoices: unpaid,
      totalCount: unpaid.length,
      totalAmount: unpaid.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error getting unpaid invoices');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/invoices/update-overdue
 * Update overdue invoice statuses and send reminders
 */
router.post('/update-overdue', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Updating overdue invoices');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const updated = await invoiceService.updateOverdueInvoices();
    
    auditFromRequest(req, 'invoice.updated', 'invoice', null, `Updated ${updated.length} overdue invoices`).catch(() => {});
    res.json({
      success: true,
      message: `Updated ${updated.length} overdue invoices`,
      updated
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error updating overdue invoices');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/stats
 * Get billing statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting billing stats');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const stats = await invoiceService.getBillingStats();
    
    res.json({
      success: true,
      stats,
      formattedStats: {
        totalInvoices: stats.total_invoices,
        totalPaid: `$${parseFloat(stats.total_paid || 0).toFixed(2)}`,
        totalPending: `$${parseFloat(stats.total_pending || 0).toFixed(2)}`,
        totalOverdue: `$${parseFloat(stats.total_overdue || 0).toFixed(2)}`,
        paidCount: stats.paid_count,
        pendingCount: stats.pending_count,
        overdueCount: stats.overdue_count
      }
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error getting billing stats');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/report/:year/:month
 * Get monthly billing report
 */
router.get('/report/:year/:month', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id, year: req.params.year, month: req.params.month }, 'Getting monthly billing report');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    const report = await invoiceService.generateMonthlyReport(year, month);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error getting monthly billing report');
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
