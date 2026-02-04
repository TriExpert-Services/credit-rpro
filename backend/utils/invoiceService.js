/**
 * Invoice & Billing Service
 * Handles invoice generation, payment tracking, and billing cycles
 * Integrates with Stripe for payments
 */

const { query, transaction } = require('../config/database');

const invoiceService = {
  /**
   * Generate invoice for client
   */
  generateInvoice: async (clientId, amount, description, billingPeriodStart, billingPeriodEnd) => {
    try {
      // Generate unique invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms
      
      const tax = amount * 0.08; // 8% tax (adjust by jurisdiction)
      const totalAmount = amount + tax;
      
      const result = await query(
        `INSERT INTO invoices (
          invoice_number, client_id, amount, tax_amount, total_amount, description,
          billing_period_start, billing_period_end, due_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         RETURNING id, invoice_number, total_amount, due_date;`,
        [invoiceNumber, clientId, amount, tax, totalAmount, description, 
         billingPeriodStart, billingPeriodEnd, dueDate]
      );
      
      const invoice = result.rows[0];
      console.log(`✅ Invoice generated: ${invoice.invoice_number}`);
      
      // Send invoice notification
      const notificationService = require('./notificationService');
      await notificationService.sendTemplateNotification(
        clientId,
        'invoice_ready',
        {
          invoice_number: invoice.invoice_number,
          amount: totalAmount.toFixed(2),
          due_date: dueDate.toLocaleDateString()
        }
      );
      
      return invoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  },

  /**
   * Create monthly subscription invoice
   */
  createSubscriptionInvoice: async (clientId, monthlyFee) => {
    try {
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      return await this.generateInvoice(
        clientId,
        monthlyFee,
        `Monthly subscription fee - ${billingPeriodStart.toLocaleDateString()}`,
        billingPeriodStart,
        billingPeriodEnd
      );
    } catch (error) {
      console.error('Error creating subscription invoice:', error);
      throw error;
    }
  },

  /**
   * Send invoice to client
   */
  sendInvoice: async (invoiceId, clientEmail) => {
    try {
      const invoiceResult = await query(
        'SELECT invoice_number, total_amount, due_date FROM invoices WHERE id = $1',
        [invoiceId]
      );
      
      if (invoiceResult.rows.length === 0) {
        throw new Error('Invoice not found');
      }
      
      const invoice = invoiceResult.rows[0];
      
      // Send email with invoice
      const notificationService = require('./notificationService');
      await notificationService.sendEmail(
        clientEmail,
        `Invoice ${invoice.invoice_number} - Credit Repair Pro`,
        `
          <h2>Invoice ${invoice.invoice_number}</h2>
          <p><strong>Amount Due:</strong> $${invoice.total_amount.toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
          <p>Please pay through your account portal or call us.</p>
        `
      );
      
      // Update sent status
      await query(
        `UPDATE invoices SET status = 'sent', sent_date = CURRENT_TIMESTAMP WHERE id = $1`,
        [invoiceId]
      );
      
      console.log(`📧 Invoice sent: ${invoice.invoice_number}`);
      return { success: true, invoiceNumber: invoice.invoice_number };
    } catch (error) {
      console.error('Error sending invoice:', error);
      throw error;
    }
  },

  /**
   * Process payment and mark invoice as paid
   */
  processPayment: async (invoiceId, paymentMethod, stripePaymentId = null, amount = null) => {
    try {
      return await transaction(async (client) => {
        // Get invoice details
        const invoiceResult = await client.query(
          'SELECT id, client_id, total_amount, status FROM invoices WHERE id = $1',
          [invoiceId]
        );
        
        if (invoiceResult.rows.length === 0) {
          throw new Error('Invoice not found');
        }
        
        const invoice = invoiceResult.rows[0];
        
        // Create payment record
        const paymentResult = await client.query(
          `INSERT INTO payments (
            client_id, amount, payment_method, stripe_payment_id, payment_status, description
          ) VALUES ($1, $2, $3, $4, 'completed', $5)
           RETURNING id;`,
          [invoice.client_id, amount || invoice.total_amount, paymentMethod, stripePaymentId,
           `Payment for invoice ${invoiceId}`]
        );
        
        const paymentId = paymentResult.rows[0].id;
        
        // Update invoice
        await client.query(
          `UPDATE invoices 
           SET status = 'paid', payment_id = $1, paid_date = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [paymentId, invoiceId]
        );
        
        // Audit log
        await client.query(
          `INSERT INTO audit_log (action, entity_type, entity_id, action_type, compliance_context)
           VALUES ('Payment processed', 'invoice', $1, 'update', 'glba')`,
          [invoiceId]
        );
        
        console.log(`✅ Payment processed for invoice: ${invoiceId}`);
        
        return { success: true, paymentId, invoiceId };
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  /**
   * Get invoice
   */
  getInvoice: async (invoiceId) => {
    try {
      const result = await query(
        'SELECT * FROM invoices WHERE id = $1',
        [invoiceId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  },

  /**
   * Get all invoices for a client
   */
  getClientInvoices: async (clientId, status = null) => {
    try {
      let query_text = 'SELECT * FROM invoices WHERE client_id = $1';
      const params = [clientId];
      
      if (status) {
        query_text += ' AND status = $2';
        params.push(status);
      }
      
      query_text += ' ORDER BY invoice_date DESC';
      
      const result = await query(query_text, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting client invoices:', error);
      throw error;
    }
  },

  /**
   * Get unpaid invoices
   */
  getUnpaidInvoices: async (clientId = null) => {
    try {
      let query_text = `
        SELECT i.*, u.email, u.first_name, u.last_name
        FROM invoices i
        JOIN users u ON i.client_id = u.id
        WHERE (i.status = 'pending' OR i.status = 'sent' OR i.status = 'overdue')
      `;
      const params = [];
      
      if (clientId) {
        query_text += ' AND i.client_id = $1';
        params.push(clientId);
      }
      
      query_text += ' ORDER BY i.due_date ASC';
      
      const result = await query(query_text, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting unpaid invoices:', error);
      throw error;
    }
  },

  /**
   * Check for overdue invoices and update status
   */
  updateOverdueInvoices: async () => {
    try {
      const today = new Date();
      
      const result = await query(
        `UPDATE invoices 
         SET status = 'overdue'
         WHERE status IN ('pending', 'sent') 
         AND due_date < CURRENT_DATE
         RETURNING id, invoice_number, client_id;`
      );
      
      // Send overdue notifications
      const notificationService = require('./notificationService');
      for (const invoice of result.rows) {
        await notificationService.sendTemplateNotification(
          invoice.client_id,
          'payment_reminder',
          {
            invoice_number: invoice.invoice_number,
            status: 'overdue'
          }
        );
      }
      
      console.log(`⚠️  Updated ${result.rows.length} overdue invoices`);
      return result.rows;
    } catch (error) {
      console.error('Error updating overdue invoices:', error);
      throw error;
    }
  },

  /**
   * Get billing dashboard stats
   */
  getBillingStats: async () => {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_invoices,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status IN ('pending', 'sent') THEN total_amount ELSE 0 END) as total_pending,
          SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as total_overdue,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status IN ('pending', 'sent') THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
        FROM invoices
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting billing stats:', error);
      throw error;
    }
  },

  /**
   * Generate monthly billing report
   */
  generateMonthlyReport: async (year, month) => {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const result = await query(
        `SELECT
          COUNT(*) as invoices_created,
          SUM(total_amount) as total_revenue,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
          COUNT(CASE WHEN status IN ('pending', 'sent', 'overdue') THEN 1 END) as unpaid_invoices,
          SUM(CASE WHEN status IN ('pending', 'sent', 'overdue') THEN total_amount ELSE 0 END) as unpaid_amount
        FROM invoices
        WHERE invoice_date >= $1 AND invoice_date <= $2`,
        [startDate, endDate]
      );
      
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        stats: result.rows[0],
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating monthly report:', error);
      throw error;
    }
  }
};

module.exports = invoiceService;
