/**
 * Notification Service
 * Handles multi-channel notifications: email, SMS, in-app
 * Includes queue management and delivery tracking
 */

const { query } = require('../config/database');
const nodemailer = require('nodemailer');

let emailTransporter = null;

const notificationService = {
  /**
   * Initialize email transporter
   */
  initEmailTransporter: async () => {
    try {
      const settingsService = require('./settingsService');
      const smtpConfig = await settingsService.getSetting('SMTP_CONFIG');
      
      if (!smtpConfig) {
        console.warn('⚠️  SMTP not configured. Email notifications disabled.');
        return false;
      }
      
      try {
        const config = JSON.parse(smtpConfig.setting_value);
        emailTransporter = nodemailer.createTransport(config);
        
        const verified = await emailTransporter.verify();
        if (verified) {
          console.log('✅ Email service initialized successfully');
          return true;
        }
      } catch (error) {
        console.error('Failed to initialize email transporter:', error.message);
        return false;
      }
    } catch (error) {
      console.error('Error initializing email transporter:', error);
      return false;
    }
  },

  /**
   * Send notification via all channels
   */
  send: async (recipientId, notificationType, subject, message, channels = ['email', 'in_app'], data = {}) => {
    try {
      // Get recipient details
      const userResult = await query(
        'SELECT email, first_name FROM users WHERE id = $1',
        [recipientId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      const notificationId = require('crypto').randomUUID();

      // Create notification record
      await query(
        `INSERT INTO notifications (
          id, recipient_id, notification_type, channel, subject, message, delivery_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [notificationId, recipientId, notificationType, channels.join(','), subject, message]
      );

      // Send via each channel
      const results = {};
      
      if (channels.includes('email') || channels.includes('all')) {
        results.email = await this.sendEmail(user.email, subject, message, data);
      }
      
      if (channels.includes('in_app') || channels.includes('all')) {
        results.inApp = await this.createInAppNotification(recipientId, subject, message);
      }
      
      if (channels.includes('sms') || channels.includes('all')) {
        results.sms = await this.sendSMS(user.phone, message, data);
      }

      // Update delivery status
      const emailSuccess = !results.email || results.email.success;
      const inAppSuccess = !results.inApp || results.inApp.success;
      
      await query(
        `UPDATE notifications 
         SET delivery_status = $1, sent_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [emailSuccess && inAppSuccess ? 'delivered' : 'partial', notificationId]
      );

      console.log(`✅ Notification sent to ${user.email} (${notificationType})`);
      return { success: true, notificationId, results };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  },

  /**
   * Send email notification
   */
  sendEmail: async (email, subject, message, data = {}) => {
    try {
      if (!emailTransporter) {
        const initialized = await this.initEmailTransporter();
        if (!initialized) {
          return { success: false, message: 'Email service not available' };
        }
      }

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || 'noreply@creditrepair.com',
        to: email,
        subject: subject,
        html: message,
        text: message.replace(/<[^>]*>/g, ''), // Strip HTML
        ...data
      };

      const info = await emailTransporter.sendMail(mailOptions);
      
      console.log(`📧 Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Create in-app notification
   */
  createInAppNotification: async (userId, subject, message) => {
    try {
      const result = await query(
        `INSERT INTO notifications (recipient_id, notification_type, channel, subject, message, is_read)
         VALUES ($1, 'in_app', 'in_app', $2, $3, false)
         RETURNING id`,
        [userId, subject, message]
      );
      
      return { success: true, notificationId: result.rows[0].id };
    } catch (error) {
      console.error('Error creating in-app notification:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Send SMS notification (stub for integration)
   */
  sendSMS: async (phone, message, data = {}) => {
    try {
      // TODO: Integrate with Twilio or similar SMS service
      console.log(`📱 SMS would be sent to ${phone}: ${message}`);
      return { success: false, message: 'SMS service not yet configured' };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Get user notifications
   */
  getNotifications: async (userId, unreadOnly = false) => {
    try {
      const whereClause = unreadOnly ? 'WHERE is_read = false' : '';
      
      const result = await query(
        `SELECT * FROM notifications
         WHERE recipient_id = $1 ${whereClause}
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId) => {
    try {
      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [notificationId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (userId) => {
    try {
      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE recipient_id = $1 AND is_read = false`,
        [userId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  },

  /**
   * Send template-based notification
   */
  sendTemplateNotification: async (recipientId, templateName, variables, channels = ['email', 'in_app']) => {
    try {
      // Get email template
      const templateResult = await query(
        'SELECT subject, body_html, body_text FROM email_templates WHERE template_name = $1',
        [templateName]
      );
      
      if (templateResult.rows.length === 0) {
        throw new Error(`Template not found: ${templateName}`);
      }
      
      const template = templateResult.rows[0];
      
      // Replace variables
      let subject = template.subject;
      let html = template.body_html;
      
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, variables[key]);
        html = html.replace(regex, variables[key]);
      });
      
      // Send notification
      return await this.send(recipientId, templateName, subject, html, channels);
    } catch (error) {
      console.error('Error sending template notification:', error);
      throw error;
    }
  },

  /**
   * Get notification stats
   */
  getStats: async (startDate = null, endDate = null) => {
    try {
      const dateFilter = startDate && endDate 
        ? `WHERE created_at BETWEEN $1 AND $2`
        : '';
      const params = startDate && endDate ? [startDate, endDate] : [];
      
      const result = await query(
        `SELECT 
          notification_type,
          delivery_status,
          COUNT(*) as count,
          SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered
         FROM notifications
         ${dateFilter}
         GROUP BY notification_type, delivery_status
         ORDER BY notification_type, delivery_status`,
        params
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }
};

// Initialize email on startup
notificationService.initEmailTransporter();

module.exports = notificationService;
