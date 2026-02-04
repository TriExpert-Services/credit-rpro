/**
 * Settings Service
 * Manages admin settings and API key configuration securely
 * Includes: OpenAI, Stripe, SMTP, and custom integrations
 */

const { query, transaction } = require('../config/database');
const crypto = require('crypto');

// Encryption for sensitive data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);

const encryptValue = (value) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decryptValue = (encrypted) => {
  try {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

const settingsService = {
  /**
   * Save or update a setting
   */
  saveSetting: async (settingKey, settingValue, settingType, description = null, userId = null) => {
    try {
      const encryptedValue = settingType === 'api_key' ? encryptValue(settingValue) : settingValue;
      
      const result = await query(
        `INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, last_updated_by, is_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (setting_key) DO UPDATE SET
           setting_value = $2,
           last_updated_at = CURRENT_TIMESTAMP,
           last_updated_by = $5
         RETURNING id, setting_key;`,
        [settingKey, encryptedValue, settingType, description, userId, settingType === 'api_key']
      );
      
      console.log(`✅ Setting saved: ${settingKey}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving setting:', error);
      throw error;
    }
  },

  /**
   * Get a setting by key
   */
  getSetting: async (settingKey, decrypt = true) => {
    try {
      const result = await query(
        'SELECT * FROM admin_settings WHERE setting_key = $1',
        [settingKey]
      );
      
      if (result.rows.length === 0) {
        return null;
      }

      const setting = result.rows[0];
      
      if (decrypt && setting.is_encrypted) {
        setting.setting_value = decryptValue(setting.setting_value);
      }
      
      return setting;
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  },

  /**
   * Get all settings (without decryption by default for safety)
   */
  getAllSettings: async (decryptSensitive = false) => {
    try {
      const result = await query('SELECT * FROM admin_settings ORDER BY setting_key');
      
      if (decryptSensitive) {
        return result.rows.map(setting => ({
          ...setting,
          setting_value: setting.is_encrypted ? decryptValue(setting.setting_value) : setting.setting_value
        }));
      }
      
      // Mask sensitive values
      return result.rows.map(setting => ({
        ...setting,
        setting_value: setting.is_encrypted ? '***ENCRYPTED***' : setting.setting_value
      }));
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw error;
    }
  },

  /**
   * Test an API key connection
   */
  testApiKey: async (apiType, apiKey) => {
    try {
      switch (apiType.toLowerCase()) {
        case 'openai':
          return await testOpenAI(apiKey);
        case 'stripe':
          return await testStripe(apiKey);
        case 'smtp':
          return await testSMTP(apiKey);
        default:
          return { success: false, message: 'API type not supported' };
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Delete a setting
   */
  deleteSetting: async (settingKey, userId = null) => {
    try {
      await query(
        'DELETE FROM admin_settings WHERE setting_key = $1',
        [settingKey]
      );
      
      console.log(`✅ Setting deleted: ${settingKey}`);
      return { success: true, message: 'Setting deleted successfully' };
    } catch (error) {
      console.error('Error deleting setting:', error);
      throw error;
    }
  },

  /**
   * Audit setting changes
   */
  auditSetting: async (userId, action, settingKey, oldValue, newValue) => {
    try {
      await query(
        `INSERT INTO audit_log (user_id, action, action_type, entity_type, entity_id, old_values, new_values, compliance_context)
         VALUES ($1, $2, 'update', 'admin_settings', $3, $4, $5, 'glba')`,
        [userId, action, settingKey, oldValue || null, newValue || null]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error auditing setting:', error);
      throw error;
    }
  },

  /**
   * Get integration status for dashboard
   */
  getIntegrationStatus: async () => {
    try {
      const result = await query(
        `SELECT setting_key, setting_type, is_encrypted, last_updated_at
         FROM admin_settings
         WHERE setting_type = 'api_key'
         ORDER BY last_updated_at DESC`
      );

      return result.rows.map(row => ({
        name: row.setting_key,
        type: row.setting_type,
        configured: !!row.setting_value,
        lastUpdated: row.last_updated_at,
        encrypted: row.is_encrypted
      }));
    } catch (error) {
      console.error('Error getting integration status:', error);
      throw error;
    }
  }
};

/**
 * Test OpenAI API key
 */
const testOpenAI = async (apiKey) => {
  try {
    const OpenAI = require('openai').default;
    const client = new OpenAI({ apiKey });
    
    const response = await client.models.list();
    return {
      success: !!response,
      message: 'OpenAI API key is valid',
      details: `Found ${response.data?.length || 0} available models`
    };
  } catch (error) {
    return {
      success: false,
      message: 'OpenAI API key is invalid: ' + error.message
    };
  }
};

/**
 * Test Stripe API key
 */
const testStripe = async (apiKey) => {
  try {
    const stripe = require('stripe')(apiKey);
    
    const balance = await stripe.balance.retrieve();
    return {
      success: !!balance,
      message: 'Stripe API key is valid',
      details: `Current balance: ${balance.available?.length || 0} currencies available`
    };
  } catch (error) {
    return {
      success: false,
      message: 'Stripe API key is invalid: ' + error.message
    };
  }
};

/**
 * Test SMTP configuration
 */
const testSMTP = async (smtpConfig) => {
  try {
    const nodemailer = require('nodemailer');
    const config = JSON.parse(smtpConfig);
    
    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    
    return {
      success: true,
      message: 'SMTP configuration is valid',
      details: `Connected to ${config.host}:${config.port}`
    };
  } catch (error) {
    return {
      success: false,
      message: 'SMTP configuration is invalid: ' + error.message
    };
  }
};

module.exports = settingsService;
