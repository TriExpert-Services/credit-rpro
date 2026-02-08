/**
 * Admin Settings Routes
 * Developer settings for API keys, Stripe, SMTP, and other integrations
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const settingsService = require('../utils/settingsService');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * GET /api/admin/settings
 * Get all settings (with masked sensitive values)
 */
router.get('/settings', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Get all admin settings');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const settings = await settingsService.getAllSettings(false);
    res.json({
      success: true,
      settings,
      message: 'Sensitive values are masked for security'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get specific setting
 */
router.get('/settings/:key', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Get admin setting by key');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const setting = await settingsService.getSetting(req.params.key, false);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }
    
    res.json({
      success: true,
      setting: {
        ...setting,
        setting_value: setting.is_encrypted ? '***ENCRYPTED***' : setting.setting_value
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/settings
 * Create or update a setting
 */
router.post('/settings', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Create or update admin setting');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { settingKey, settingValue, settingType, description } = req.body;
    
    if (!settingKey || !settingValue || !settingType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: settingKey, settingValue, settingType'
      });
    }
    
    const setting = await settingsService.saveSetting(
      settingKey,
      settingValue,
      settingType,
      description,
      req.user.id
    );
    
    // Audit log
    await settingsService.auditSetting(
      req.user.id,
      'API key/setting configured',
      settingKey,
      null,
      settingType === 'api_key' ? '***ENCRYPTED***' : settingValue
    );
    
    auditFromRequest(req, 'admin_setting.updated', 'admin_setting', settingKey, 'Admin setting created or updated').catch(() => {});
    res.status(201).json({
      success: true,
      message: `Setting ${settingKey} saved successfully`,
      setting
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/settings/test
 * Test an API key
 */
router.post('/settings/test', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Test API key');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { apiType, apiKey } = req.body;
    
    if (!apiType || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: apiType, apiKey'
      });
    }
    
    const result = await settingsService.testApiKey(apiType, apiKey);
    
    res.json({
      success: result.success,
      message: result.message,
      details: result.details || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/settings/:key
 * Delete a setting
 */
router.delete('/settings/:key', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Delete admin setting');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    await settingsService.deleteSetting(req.params.key, req.user.id);
    
    // Audit log
    await settingsService.auditSetting(
      req.user.id,
      'Setting deleted',
      req.params.key,
      'value_existed',
      null
    );
    
    auditFromRequest(req, 'admin_setting.deleted', 'admin_setting', req.params.key, 'Admin setting deleted').catch(() => {});
    res.json({
      success: true,
      message: `Setting ${req.params.key} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/integrations/status
 * Get status of all integrations
 */
router.get('/integrations/status', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Get integrations status');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const status = await settingsService.getIntegrationStatus();
    
    res.json({
      success: true,
      integrations: status,
      totalConfigured: status.filter(s => s.configured).length,
      totalAvailable: status.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/test-email
 * Send a test email to verify SMTP configuration
 */
router.post('/test-email', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Send test email');
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const { to } = req.body;
    const recipientEmail = to || req.user.email;
    
    // Get SMTP settings from database or environment
    const smtpHost = await settingsService.getSettingValue('SMTP_HOST') || process.env.SMTP_HOST;
    const smtpPort = await settingsService.getSettingValue('SMTP_PORT') || process.env.SMTP_PORT || '587';
    const smtpUser = await settingsService.getSettingValue('SMTP_USER') || process.env.SMTP_USER;
    const smtpPass = await settingsService.getSettingValue('SMTP_PASS') || process.env.SMTP_PASS;
    const fromEmail = await settingsService.getSettingValue('SMTP_FROM_EMAIL') || smtpUser || 'noreply@triexpertservice.com';
    const fromName = await settingsService.getSettingValue('SMTP_FROM_NAME') || 'TriExpert Credit Repair';
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({
        success: false,
        message: 'SMTP no está configurado. Por favor configura SMTP_HOST, SMTP_USER y SMTP_PASS.'
      });
    }
    
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === '465',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    
    // Verify connection
    await transporter.verify();
    
    // Send test email
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: '✅ Test de Email - TriExpert Credit Repair',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Email Configurado Correctamente</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="font-size: 16px; color: #334155;">
              ¡Hola! Este es un email de prueba para verificar que tu configuración SMTP está funcionando correctamente.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b;"><strong>Servidor SMTP:</strong> ${smtpHost}</p>
              <p style="margin: 8px 0 0; color: #64748b;"><strong>Puerto:</strong> ${smtpPort}</p>
              <p style="margin: 8px 0 0; color: #64748b;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>
            <p style="font-size: 14px; color: #64748b;">
              Si recibiste este email, tu configuración de SMTP está lista para enviar notificaciones a clientes.
            </p>
          </div>
        </div>
      `
    });
    
    auditFromRequest(req, 'admin_setting.tested', 'admin_setting', null, 'Test email sent').catch(() => {});
    res.json({
      success: true,
      message: `Email de prueba enviado a ${recipientEmail}`
    });
    
  } catch (error) {
    logger.error({ err: error.message }, 'Test email error');
    res.status(500).json({
      success: false,
      message: `Error enviando email: ${error.message}`
    });
  }
});

// =====================================================
// COMPLIANCE STATS
// Admin dashboard compliance statistics
// =====================================================
router.get('/compliance-stats', authMiddleware, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Get compliance stats');
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }

  const pool = require('../config/database');

  try {
    const [contractsRes, activeRes, cancellationsRes, pendingRes] = await Promise.all([
      // Total contracts
      pool.query('SELECT COUNT(*) as count FROM client_contracts'),
      // Active contracts
      pool.query("SELECT COUNT(*) as count FROM client_contracts WHERE status = 'active'"),
      // Cancellations
      pool.query('SELECT COUNT(*) as count FROM cancellation_requests'),
      // Users without a signed contract (pending compliance)
      pool.query(`
        SELECT COUNT(*) as count FROM users u
        WHERE u.role = 'client' AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM client_contracts cc
          WHERE cc.client_id = u.id AND cc.status = 'active'
        )
      `)
    ]);

    res.json({
      success: true,
      data: {
        totalContracts: parseInt(contractsRes.rows[0].count),
        activeContracts: parseInt(activeRes.rows[0].count),
        cancellations: parseInt(cancellationsRes.rows[0].count),
        pendingCompliance: parseInt(pendingRes.rows[0].count)
      }
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Compliance stats error');
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de compliance'
    });
  }
});

module.exports = router;
