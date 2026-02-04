/**
 * Admin Settings Routes
 * Developer settings for API keys, Stripe, SMTP, and other integrations
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const settingsService = require('../utils/settingsService');

/**
 * GET /api/admin/settings
 * Get all settings (with masked sensitive values)
 */
router.get('/settings', authMiddleware, async (req, res) => {
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

module.exports = router;
