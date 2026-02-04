/**
 * Invoices Routes
 * Handle billing, invoices, and payment tracking
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const invoiceService = require('../utils/invoiceService');

/**
 * GET /api/invoices
 * Get invoices for current client
 */
router.get('/', authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/invoices/:id
 * Get specific invoice
 */
router.get('/:id', authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/invoices
 * Generate invoice
 */
router.post('/', authMiddleware, async (req, res) => {
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
    
    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/invoices/:id/send
 * Send invoice to client
 */
router.post('/:id/send', authMiddleware, async (req, res) => {
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { clientEmail } = req.body;
    
    const result = await invoiceService.sendInvoice(req.params.id, clientEmail);
    
    res.json({
      success: true,
      message: 'Invoice sent successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/invoices/:id/pay
 * Record payment for invoice (Stripe integration)
 */
router.post('/:id/pay', authMiddleware, async (req, res) => {
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
    
    res.json({
      success: true,
      message: 'Payment processed successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/unpaid
 * Get all unpaid invoices
 */
router.get('/unpaid', authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: POST /api/invoices/update-overdue
 * Update overdue invoice statuses and send reminders
 */
router.post('/update-overdue', authMiddleware, async (req, res) => {
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const updated = await invoiceService.updateOverdueInvoices();
    
    res.json({
      success: true,
      message: `Updated ${updated.length} overdue invoices`,
      updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/stats
 * Get billing statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ADMIN: GET /api/invoices/report/:year/:month
 * Get monthly billing report
 */
router.get('/report/:year/:month', authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
