/**
 * Onboarding Service
 * Handles client registration flows: self-service vs admin-guided
 * Manages onboarding steps and completion tracking
 */

const { query, transaction } = require('../config/database');
const contractService = require('./contractService');
const notificationService = require('./notificationService');

const onboardingService = {
  /**
   * Start onboarding process
   */
  startOnboarding: async (clientId, onboardingType) => {
    try {
      // Validate onboarding type
      if (!['self_service', 'admin_guided'].includes(onboardingType)) {
        throw new Error('Invalid onboarding type');
      }
      
      const result = await query(
        `INSERT INTO client_onboarding (
          client_id, onboarding_type, step_current, status
        ) VALUES ($1, $2, 1, 'in_progress')
         RETURNING id, onboarding_type, step_current;`,
        [clientId, onboardingType]
      );
      
      console.log(`✅ Onboarding started: ${clientId} (${onboardingType})`);
      
      // Send welcome notification
      if (onboardingType === 'self_service') {
        await notificationService.sendTemplateNotification(
          clientId,
          'welcome_email',
          {
            company_name: 'Credit Repair Pro',
            first_name: 'Cliente'
          }
        );
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error starting onboarding:', error);
      throw error;
    }
  },

  /**
   * Get onboarding status
   */
  getOnboardingStatus: async (clientId) => {
    try {
      const result = await query(
        'SELECT * FROM client_onboarding WHERE client_id = $1',
        [clientId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      throw error;
    }
  },

  /**
   * Complete profile step
   */
  completeProfileStep: async (clientId, profileData) => {
    try {
      return await transaction(async (client) => {
        // Update user profile
        await client.query(
          `UPDATE client_profiles SET 
            date_of_birth = $1,
            ssn_last_4 = $2,
            address_line1 = $3,
            address_line2 = $4,
            city = $5,
            state = $6,
            zip_code = $7,
            updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $8`,
          [
            profileData.dateOfBirth,
            profileData.ssnLast4,
            profileData.address1,
            profileData.address2 || null,
            profileData.city,
            profileData.state,
            profileData.zipCode,
            clientId
          ]
        );
        
        // Update onboarding step
        await client.query(
          `UPDATE client_onboarding 
           SET profile_completed = true, step_current = 2, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = $1`,
          [clientId]
        );
        
        return { success: true, nextStep: 2 };
      });
    } catch (error) {
      console.error('Error completing profile step:', error);
      throw error;
    }
  },

  /**
   * Upload documents step
   */
  uploadDocumentsStep: async (clientId, documents) => {
    try {
      // documents = [{ fileName, filePath, documentCategory }, ...]
      
      for (const doc of documents) {
        await query(
          `INSERT INTO documents (
            client_id, file_name, file_path, document_category
          ) VALUES ($1, $2, $3, $4)`,
          [clientId, doc.fileName, doc.filePath, doc.documentCategory]
        );
      }
      
      // Update onboarding
      await query(
        `UPDATE client_onboarding 
         SET documents_uploaded = true, step_current = 3, updated_at = CURRENT_TIMESTAMP
         WHERE client_id = $1`,
        [clientId]
      );
      
      console.log(`✅ Documents uploaded for client: ${clientId}`);
      return { success: true, nextStep: 3 };
    } catch (error) {
      console.error('Error uploading documents:', error);
      throw error;
    }
  },

  /**
   * Sign contracts step
   */
  signContractsStep: async (clientId, contractTypes) => {
    try {
      // contractTypes = ['service_agreement', 'privacy_policy', ...]
      
      return await transaction(async (client) => {
        const userData = await client.query(
          'SELECT first_name, last_name FROM users WHERE id = $1',
          [clientId]
        );
        
        const user = userData.rows[0];
        
        for (const contractType of contractTypes) {
          // Get contract template
          const templateData = await client.query(
            `SELECT id FROM contracts 
             WHERE contract_type = $1 AND is_active = true LIMIT 1`,
            [contractType]
          );
          
          if (templateData.rows.length === 0) {
            throw new Error(`Contract template not found: ${contractType}`);
          }
          
          const contractId = templateData.rows[0].id;
          
          // Create signature
          const signatureData = Buffer.from(
            JSON.stringify({
              clientId,
              contractType,
              signedAt: new Date().toISOString(),
              signatureMethod: 'electronic'
            })
          ).toString('base64');
          
          await client.query(
            `INSERT INTO client_contracts (
              client_id, contract_id, contract_type, signed_date,
              signature_data, signature_method, is_valid
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'electronic', true)`,
            [clientId, contractId, contractType, signatureData]
          );
        }
        
        // Update onboarding
        await client.query(
          `UPDATE client_onboarding 
           SET contracts_signed = true, step_current = 4, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = $1`,
          [clientId]
        );
        
        return { success: true, nextStep: 4, signedCount: contractTypes.length };
      });
    } catch (error) {
      console.error('Error signing contracts:', error);
      throw error;
    }
  },

  /**
   * Payment verification step
   */
  verifyPaymentStep: async (clientId, paymentMethod, stripeTokenId = null) => {
    try {
      return await transaction(async (client) => {
        // Update payment info (if using Stripe)
        if (stripeTokenId) {
          await client.query(
            `INSERT INTO payments (
              client_id, payment_method, stripe_payment_id, payment_status, description
            ) VALUES ($1, $2, $3, 'completed', 'Onboarding payment verification')`,
            [clientId, paymentMethod, stripeTokenId]
          );
        }
        
        // Update onboarding
        await client.query(
          `UPDATE client_onboarding 
           SET payment_verified = true, step_current = 5, updated_at = CURRENT_TIMESTAMP
           WHERE client_id = $1`,
          [clientId]
        );
        
        return { success: true, nextStep: 5 };
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  },

  /**
   * Complete onboarding
   */
  completeOnboarding: async (clientId) => {
    try {
      const result = await query(
        `UPDATE client_onboarding
         SET status = 'completed', onboarding_completed_at = CURRENT_TIMESTAMP
         WHERE client_id = $1
         RETURNING id, onboarding_type, onboarding_completed_at;`,
        [clientId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Onboarding record not found');
      }
      
      const onboarding = result.rows[0];
      
      // Send completion notification
      await notificationService.sendTemplateNotification(
        clientId,
        'welcome_email',
        {
          company_name: 'Credit Repair Pro',
          first_name: 'Cliente'
        }
      );
      
      console.log(`✅ Onboarding completed: ${clientId}`);
      return { success: true, onboarding };
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  },

  /**
   * Get onboarding progress
   */
  getProgress: async (clientId) => {
    try {
      const onboarding = await this.getOnboardingStatus(clientId);
      
      if (!onboarding) {
        return null;
      }
      
      const totalSteps = 5;
      const completedSteps = [
        onboarding.profile_completed ? 1 : 0,
        onboarding.documents_uploaded ? 1 : 0,
        onboarding.contracts_signed ? 1 : 0,
        onboarding.payment_verified ? 1 : 0
      ].reduce((a, b) => a + b, 0);
      
      return {
        type: onboarding.onboarding_type,
        status: onboarding.status,
        currentStep: onboarding.step_current,
        totalSteps,
        completedSteps,
        progressPercent: Math.round((completedSteps / totalSteps) * 100),
        steps: {
          profile: onboarding.profile_completed,
          documents: onboarding.documents_uploaded,
          contracts: onboarding.contracts_signed,
          payment: onboarding.payment_verified
        },
        startedAt: onboarding.onboarding_started_at,
        completedAt: onboarding.onboarding_completed_at
      };
    } catch (error) {
      console.error('Error getting progress:', error);
      throw error;
    }
  },

  /**
   * Abandon onboarding (for incomplete registrations)
   */
  abandonOnboarding: async (clientId, reason = null) => {
    try {
      await query(
        `UPDATE client_onboarding
         SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP
         WHERE client_id = $1`,
        [clientId]
      );
      
      // Log to audit
      await query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, reason)
         VALUES ($1, 'Onboarding abandoned', 'client_onboarding', $2, $3)`,
        [clientId, clientId, reason || 'No reason provided']
      );
      
      console.log(`⚠️  Onboarding abandoned: ${clientId}`);
      return { success: true };
    } catch (error) {
      console.error('Error abandoning onboarding:', error);
      throw error;
    }
  }
};

module.exports = onboardingService;
