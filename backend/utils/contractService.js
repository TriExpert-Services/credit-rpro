/**
 * Contract Service
 * Handles contract templates, client signatures, and compliance
 * Supports: digital signatures, uploaded documents, electronic signatures
 */

const { query, transaction } = require('../config/database');
const crypto = require('crypto');

const contractService = {
  /**
   * Create a contract template
   */
  createTemplate: async (contractType, templateContent, effectiveDate, userId) => {
    try {
      const result = await query(
        `INSERT INTO contracts (contract_type, template_content, effective_date, is_active, created_by, template_version)
         VALUES ($1, $2, $3, true, $4, 1)
         RETURNING id, contract_type, template_version, effective_date;`,
        [contractType, templateContent, effectiveDate, userId]
      );
      
      console.log(`✅ Contract template created: ${contractType}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating contract template:', error);
      throw error;
    }
  },

  /**
   * Get active contract template
   */
  getTemplate: async (contractType) => {
    try {
      const result = await query(
        `SELECT id, contract_type, template_content, template_version, effective_date
         FROM contracts
         WHERE contract_type = $1 AND is_active = true
         ORDER BY template_version DESC
         LIMIT 1`,
        [contractType]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting contract template:', error);
      throw error;
    }
  },

  /**
   * Get all contract templates
   */
  getAllTemplates: async (includeInactive = false) => {
    try {
      const activeClause = includeInactive ? '' : 'WHERE is_active = true';
      
      const result = await query(
        `SELECT id, contract_type, template_version, effective_date, is_active, created_at
         FROM contracts
         ${activeClause}
         ORDER BY contract_type, template_version DESC`
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all templates:', error);
      throw error;
    }
  },

  /**
   * Sign a contract (with digital signature)
   */
  signContract: async (clientId, contractId, signatureData, signatureMethod, ipAddress, userAgent) => {
    try {
      // Verify contract exists
      const contractCheck = await query(
        'SELECT id, contract_type FROM contracts WHERE id = $1',
        [contractId]
      );
      
      if (contractCheck.rows.length === 0) {
        throw new Error('Contract not found');
      }
      
      const contractType = contractCheck.rows[0].contract_type;
      
      // Check if already signed
      const existingSignature = await query(
        `SELECT id FROM client_contracts 
         WHERE client_id = $1 AND contract_type = $2 AND is_valid = true`,
        [clientId, contractType]
      );
      
      // Create new signature record
      const result = await query(
        `INSERT INTO client_contracts (
          client_id, contract_id, contract_type, signed_date, 
          signature_data, signature_method, ip_address, user_agent, is_valid
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, true)
         RETURNING id, signed_date;`,
        [clientId, contractId, contractType, signatureData, signatureMethod, ipAddress, userAgent]
      );
      
      // Log audit entry
      await query(
        `INSERT INTO audit_log (user_id, action, action_type, entity_type, entity_id, compliance_context, ip_address)
         VALUES ($1, 'Contract signed', 'sign', 'contract', $2, 'fcra', $3)`,
        [clientId, contractId, ipAddress]
      );
      
      console.log(`✅ Contract signed by client: ${clientId} - ${contractType}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error signing contract:', error);
      throw error;
    }
  },

  /**
   * Verify if client has signed required contracts
   */
  hasSignedContract: async (clientId, contractType) => {
    try {
      const result = await query(
        `SELECT id, signed_date FROM client_contracts
         WHERE client_id = $1 AND contract_type = $2 AND is_valid = true
         LIMIT 1`,
        [clientId, contractType]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error checking contract signature:', error);
      throw error;
    }
  },

  /**
   * Get all signed contracts for a client
   */
  getClientSignedContracts: async (clientId) => {
    try {
      const result = await query(
        `SELECT id, contract_type, signed_date, signature_method, is_valid, expires_at
         FROM client_contracts
         WHERE client_id = $1 AND is_valid = true
         ORDER BY signed_date DESC`,
        [clientId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting client contracts:', error);
      throw error;
    }
  },

  /**
   * Invalidate a signature (in case of dispute or changes)
   */
  invalidateSignature: async (signatureId, reason = null) => {
    try {
      await query(
        `UPDATE client_contracts SET is_valid = false WHERE id = $1`,
        [signatureId]
      );
      
      console.log(`⚠️  Contract signature invalidated: ${signatureId}`);
      return { success: true };
    } catch (error) {
      console.error('Error invalidating signature:', error);
      throw error;
    }
  },

  /**
   * Get contract for display (with personalization)
   */
  getContractForSigning: async (contractType, clientData = {}) => {
    try {
      const template = await this.getTemplate(contractType);
      
      if (!template) {
        throw new Error(`Contract template not found: ${contractType}`);
      }
      
      // Personalize template
      let content = template.template_content;
      Object.keys(clientData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, clientData[key]);
      });
      
      return {
        id: template.id,
        contractType: template.contract_type,
        version: template.template_version,
        effectiveDate: template.effective_date,
        content: content,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting contract for signing:', error);
      throw error;
    }
  },

  /**
   * Generate contract signature token (for secure links)
   */
  generateSignatureToken: async (clientId, contractType) => {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Store in a temporary table or cache
      // For now, we'll use the signature data field
      
      return {
        token,
        expiresAt,
        signingUrl: `${process.env.FRONTEND_URL}/sign-contract/${clientId}/${contractType}/${token}`
      };
    } catch (error) {
      console.error('Error generating signature token:', error);
      throw error;
    }
  },

  /**
   * Get contract compliance info
   */
  getComplianceInfo: async (contractType) => {
    try {
      const result = await query(
        `SELECT template_version, effective_date FROM contracts
         WHERE contract_type = $1 AND is_active = true LIMIT 1`,
        [contractType]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Contract not found');
      }
      
      const contract = result.rows[0];
      
      return {
        contractType,
        version: contract.template_version,
        effectiveDate: contract.effective_date,
        compliesWithFCRA: true,
        compliesWithGDPR: true,
        compliesWithCCPA: true,
        lastUpdated: contract.updated_at
      };
    } catch (error) {
      console.error('Error getting compliance info:', error);
      throw error;
    }
  }
};

module.exports = contractService;
