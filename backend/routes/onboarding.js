/**
 * Enhanced Onboarding Routes - Legal Compliance Version
 * Handles all onboarding steps for credit repair services
 */

const express = require('express');
const router = express.Router();
const { pool, query, transaction } = require('../config/database');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { sendSuccess, sendError, sendInternalError } = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// Encryption configuration (use environment variables in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (like SSN)
 */
function encryptData(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decryptData(text) {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err);
    return null;
  }
}

/**
 * Hash SSN for verification
 */
function hashSSN(ssn) {
  return crypto.createHash('sha256').update(ssn.replace(/\D/g, '')).digest('hex');
}

/**
 * Generate signature hash
 */
function generateSignatureHash(signature, timestamp, ip) {
  return crypto.createHash('sha256').update(`${signature}|${timestamp}|${ip}`).digest('hex');
}

// Helper function to get step boolean column name
function getStepBoolColumn(step) {
  const columns = {
    1: 'step_1_personal_info',
    2: 'step_2_current_address',
    3: 'step_3_address_history',
    4: 'step_4_employment',
    5: 'step_5_documents',
    6: 'step_6_authorizations',
    7: 'step_7_signature',
  };
  return columns[step];
}

// ============================================================================
// GET /api/onboarding/data - Get existing onboarding data
// ============================================================================
router.get('/data', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching onboarding data');
    // Get user data as fallback
    const userResult = await pool.query(
      `SELECT 
        first_name, last_name, email, phone
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    const userData = userResult.rows[0] || {};

    // Get profile data
    const profileResult = await pool.query(
      `SELECT 
        cp.first_name as "firstName",
        cp.middle_name as "middleName",
        cp.last_name as "lastName",
        cp.suffix,
        cp.date_of_birth as "dateOfBirth",
        cp.phone_primary as phone,
        cp.phone_alternate as "alternatePhone",
        cp.email,
        cp.employment_status,
        cp.employer_name,
        cp.job_title,
        cp.employer_phone,
        cp.employer_address,
        cp.employment_start_date,
        cp.monthly_income,
        cp.onboarding_completed
       FROM client_profiles cp
       WHERE cp.user_id = $1`,
      [req.user.id]
    );

    // Get current address
    const currentAddressResult = await pool.query(
      `SELECT 
        street1, street2, city, state, zip_code as "zipCode",
        from_date as "moveInDate"
       FROM client_addresses
       WHERE client_id = $1 AND address_type = 'current'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    // Get previous addresses
    const previousAddressesResult = await pool.query(
      `SELECT 
        street1, street2, city, state, zip_code as "zipCode",
        from_date as "fromDate", to_date as "toDate"
       FROM client_addresses
       WHERE client_id = $1 AND address_type = 'previous'
       ORDER BY to_date DESC`,
      [req.user.id]
    );

    // Get onboarding progress
    const progressResult = await pool.query(
      `SELECT current_step, form_data, status
       FROM onboarding_progress
       WHERE client_id = $1`,
      [req.user.id]
    );

    // Get authorizations
    const authorizationsResult = await pool.query(
      `SELECT authorization_type, consent_given
       FROM client_authorizations
       WHERE client_id = $1`,
      [req.user.id]
    );

    // Get uploaded documents
    const documentsResult = await pool.query(
      `SELECT id, document_category, file_name, is_verified
       FROM documents
       WHERE client_id = $1 AND document_category IN ('drivers_license', 'passport', 'state_id', 'military_id', 'ssn_card', 'proof_of_address')`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};
    const progress = progressResult.rows[0] || {};
    const authorizations = {};
    
    authorizationsResult.rows.forEach(auth => {
      const key = auth.authorization_type.replace(/_([a-z])/g, (m, c) => c.toUpperCase());
      authorizations[key] = auth.consent_given;
    });

    const documents = {};
    documentsResult.rows.forEach(doc => {
      const category = doc.document_category;
      if (['drivers_license', 'passport', 'state_id', 'military_id'].includes(category)) {
        documents.governmentId = { id: doc.id, name: doc.file_name, verified: doc.is_verified };
        documents.governmentIdType = category;
      } else if (category === 'proof_of_address') {
        documents.proofOfAddress = { id: doc.id, name: doc.file_name, verified: doc.is_verified };
      } else if (category === 'ssn_card') {
        documents.proofOfSsn = { id: doc.id, name: doc.file_name, verified: doc.is_verified };
      }
    });

    // Build response merging user data and profile data (profile takes precedence)
    const data = {
      // Fallback to user data if profile is empty
      firstName: profile.firstName || userData.first_name || '',
      middleName: profile.middleName || '',
      lastName: profile.lastName || userData.last_name || '',
      email: profile.email || userData.email || '',
      phone: profile.phone || userData.phone || '',
      // Profile-only fields
      suffix: profile.suffix || '',
      dateOfBirth: profile.dateOfBirth || '',
      alternatePhone: profile.alternatePhone || '',
      onboarding_completed: profile.onboarding_completed || false,
      currentAddress: currentAddressResult.rows[0] || {},
      previousAddresses: previousAddressesResult.rows || [],
      employment: {
        status: profile.employment_status || 'employed',
        employerName: profile.employer_name || '',
        jobTitle: profile.job_title || '',
        employerPhone: profile.employer_phone || '',
        employerAddress: profile.employer_address || '',
        startDate: profile.employment_start_date || '',
        monthlyIncome: profile.monthly_income || '',
      },
      documents,
      authorizations,
      ...progress.form_data
    };

    return sendSuccess(res, data);

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting onboarding data');
    return sendInternalError(res, 'Error al obtener datos');
  }
});

// ============================================================================
// POST /api/onboarding/save-progress - Save form progress
// ============================================================================
router.post('/save-progress', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    logger.info({ userId: req.user?.id }, 'Saving onboarding progress');
    const { step, data } = req.body;
    const userId = req.user.id;

    // Validate step is a safe integer 1-7 to prevent SQL injection
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 7) {
      return sendError(res, 'Step debe ser un número entre 1 y 7');
    }

    await client.query('BEGIN');

    // Update or create onboarding progress
    await client.query(
      `INSERT INTO onboarding_progress (client_id, current_step, form_data, last_activity_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (client_id) 
       DO UPDATE SET 
         current_step = GREATEST(onboarding_progress.current_step, $2),
         form_data = $3,
         last_activity_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, stepNum, JSON.stringify(data)]
    );

    // Update step completion — column names are safe (derived from validated integer)
    const stepColumn = `step_${stepNum}_completed_at`;
    const stepBoolColumn = getStepBoolColumn(stepNum);
    
    if (stepBoolColumn) {
      await client.query(
        `UPDATE onboarding_progress 
         SET ${stepBoolColumn} = true, 
             ${stepColumn} = COALESCE(${stepColumn}, CURRENT_TIMESTAMP)
         WHERE client_id = $1`,
        [userId]
      );
    }

    await client.query('COMMIT');
    auditFromRequest(req, 'onboarding.completed', 'onboarding', req.user.id, 'Onboarding progress saved').catch(() => {});
    return sendSuccess(res, { message: 'Progress saved' });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, userId: req.user?.id }, 'Error saving onboarding progress');
    return sendInternalError(res, 'Error al guardar progreso');
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /api/onboarding/status - Get onboarding status
// ============================================================================
router.get('/status', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching onboarding status');
    const result = await pool.query(
      `SELECT 
        op.current_step,
        op.status,
        op.step_1_personal_info,
        op.step_2_current_address,
        op.step_3_address_history,
        op.step_4_employment,
        op.step_5_documents,
        op.step_6_authorizations,
        op.step_7_signature,
        op.completed_at,
        cp.onboarding_completed
       FROM onboarding_progress op
       LEFT JOIN client_profiles cp ON cp.user_id = op.client_id
       WHERE op.client_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return sendSuccess(res, {
        status: 'not_started',
        currentStep: 1,
        completed: false
      });
    }

    const progress = result.rows[0];
    return sendSuccess(res, {
      status: progress.status,
      currentStep: progress.current_step,
      completed: progress.onboarding_completed || progress.status === 'completed',
      steps: {
        personalInfo: progress.step_1_personal_info,
        currentAddress: progress.step_2_current_address,
        addressHistory: progress.step_3_address_history,
        employment: progress.step_4_employment,
        documents: progress.step_5_documents,
        authorizations: progress.step_6_authorizations,
        signature: progress.step_7_signature,
      },
      completedAt: progress.completed_at
    });

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting onboarding status');
    return sendInternalError(res, 'Error al obtener estado');
  }
});

// ============================================================================
// POST /api/onboarding/complete - Complete onboarding process
// ============================================================================
router.post('/complete', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    logger.info({ userId: req.user?.id }, 'Completing onboarding');
    const userId = req.user.id;
    const {
      firstName, middleName, lastName, suffix,
      dateOfBirth, ssn, phone, alternatePhone, email,
      currentAddress, previousAddresses,
      employment, authorizations,
      signature, signatureDate, ipAddress
    } = req.body;

    await client.query('BEGIN');

    // ========================================================================
    // CRITICAL: Verify active subscription before completing onboarding
    // ========================================================================
    const subscriptionResult = await client.query(
      `SELECT cs.id, cs.status, sp.name as plan_name
       FROM client_subscriptions cs
       JOIN subscription_plans sp ON cs.plan_id = sp.id
       WHERE cs.client_id = $1 AND cs.status IN ('active', 'trialing')
       ORDER BY cs.created_at DESC LIMIT 1`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      throw new Error('Debe seleccionar y pagar un plan antes de completar el registro. Por favor, regrese al paso de selección de plan.');
    }

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !ssn || !phone) {
      throw new Error('Missing required personal information');
    }

    if (!currentAddress?.street1 || !currentAddress?.city || !currentAddress?.state || !currentAddress?.zipCode) {
      throw new Error('Missing required address information');
    }

    if (!authorizations?.fcraConsent || !authorizations?.creditPullConsent || 
        !authorizations?.termsOfService || !authorizations?.privacyPolicy) {
      throw new Error('Required authorizations not provided');
    }

    if (!signature) {
      throw new Error('Signature is required');
    }

    // Clean SSN (remove formatting)
    const cleanSSN = ssn.replace(/\D/g, '');
    if (cleanSSN.length !== 9) {
      throw new Error('Invalid SSN format');
    }

    // Encrypt SSN
    const encryptedSSN = encryptData(cleanSSN);
    const hashedSSN = hashSSN(cleanSSN);

    // Update or create client profile
    await client.query(
      `INSERT INTO client_profiles (
        user_id, first_name, middle_name, last_name, suffix,
        date_of_birth, ssn_encrypted, ssn_hash, ssn_last_4,
        phone_primary, phone_alternate, email,
        employment_status, employer_name, job_title, employer_phone,
        employer_address, employment_start_date, monthly_income,
        onboarding_completed, onboarding_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, true, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = $2, middle_name = $3, last_name = $4, suffix = $5,
        date_of_birth = $6, ssn_encrypted = $7, ssn_hash = $8, ssn_last_4 = $9,
        phone_primary = $10, phone_alternate = $11, email = $12,
        employment_status = $13, employer_name = $14, job_title = $15,
        employer_phone = $16, employer_address = $17, employment_start_date = $18,
        monthly_income = $19, onboarding_completed = true, onboarding_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId, firstName, middleName, lastName, suffix,
        dateOfBirth, encryptedSSN, hashedSSN, cleanSSN.slice(-4),
        phone, alternatePhone, email,
        employment?.status, employment?.employerName, employment?.jobTitle,
        employment?.employerPhone, employment?.employerAddress, employment?.startDate || null,
        employment?.monthlyIncome || null
      ]
    );

    // Save current address
    await client.query(
      `DELETE FROM client_addresses WHERE client_id = $1 AND address_type = 'current'`,
      [userId]
    );
    
    await client.query(
      `INSERT INTO client_addresses (
        client_id, address_type, street1, street2, city, state, zip_code, from_date
      ) VALUES ($1, 'current', $2, $3, $4, $5, $6, $7)`,
      [
        userId, currentAddress.street1, currentAddress.street2 || null,
        currentAddress.city, currentAddress.state, currentAddress.zipCode,
        currentAddress.moveInDate || null
      ]
    );

    // Save previous addresses
    if (previousAddresses && previousAddresses.length > 0) {
      await client.query(
        `DELETE FROM client_addresses WHERE client_id = $1 AND address_type = 'previous'`,
        [userId]
      );

      for (const addr of previousAddresses) {
        if (addr.street1 && addr.city && addr.state) {
          await client.query(
            `INSERT INTO client_addresses (
              client_id, address_type, street1, street2, city, state, zip_code, from_date, to_date
            ) VALUES ($1, 'previous', $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId, addr.street1, addr.street2 || null, addr.city, addr.state,
              addr.zipCode, addr.fromDate || null, addr.toDate || null
            ]
          );
        }
      }
    }

    // Save authorizations
    const authTypes = [
      ['fcra_consent', authorizations.fcraConsent],
      ['credit_pull_consent', authorizations.creditPullConsent],
      ['communication_consent', authorizations.communicationConsent],
      ['electronic_signature', authorizations.electronicSignatureConsent],
      ['terms_of_service', authorizations.termsOfService],
      ['privacy_policy', authorizations.privacyPolicy],
      ['limited_poa', authorizations.limitedPoa],
    ];

    for (const [authType, consent] of authTypes) {
      await client.query(
        `INSERT INTO client_authorizations (
          client_id, authorization_type, consent_given, consent_date, consent_ip_address
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
        ON CONFLICT (client_id, authorization_type) DO UPDATE SET
          consent_given = $3,
          consent_date = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE client_authorizations.consent_date END,
          consent_ip_address = $4,
          updated_at = CURRENT_TIMESTAMP`,
        [userId, authType, consent || false, ipAddress]
      );
    }

    // Save signature
    const signatureHash = generateSignatureHash(signature, signatureDate, ipAddress);
    
    await client.query(
      `INSERT INTO client_signatures (
        client_id, signature_type, signature_text, signature_hash, ip_address, signed_at
      ) VALUES ($1, 'onboarding', $2, $3, $4, $5)`,
      [userId, signature, signatureHash, ipAddress, signatureDate]
    );

    // Update onboarding progress
    await client.query(
      `INSERT INTO onboarding_progress (
        client_id, current_step, status, completed_at,
        step_1_personal_info, step_1_completed_at,
        step_2_current_address, step_2_completed_at,
        step_3_address_history, step_3_completed_at,
        step_4_employment, step_4_completed_at,
        step_5_documents, step_5_completed_at,
        step_6_authorizations, step_6_completed_at,
        step_7_signature, step_7_completed_at
      ) VALUES ($1, 7, 'completed', CURRENT_TIMESTAMP, 
        true, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP,
        true, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP,
        true, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP,
        true, CURRENT_TIMESTAMP)
      ON CONFLICT (client_id) DO UPDATE SET
        current_step = 7, status = 'completed', completed_at = CURRENT_TIMESTAMP,
        step_7_signature = true, step_7_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [userId]
    );

    // Update user name in users table
    await client.query(
      `UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
      [firstName, lastName, phone, userId]
    );

    // Create welcome notification
    await client.query(
      `INSERT INTO notifications (
        recipient_id, notification_type, channel, subject, message, delivery_status
      ) VALUES ($1, 'welcome', 'in_app', 'Bienvenido a TriExpert Credit Repair', 
        '¡Su registro ha sido completado exitosamente! Nuestro equipo revisará su información y comenzará a trabajar en su caso.', 
        'delivered')`,
      [userId]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description, ip_address)
       VALUES ($1, 'onboarding_completed', 'client_profiles', $1, 'Client completed onboarding process', $2)`,
      [userId, ipAddress]
    );

    // Audit log for compliance
    await client.query(
      `INSERT INTO audit_log (
        user_id, action, action_type, entity_type, entity_id, compliance_context, ip_address
      ) VALUES ($1, 'onboarding_completed', 'create', 'client_profiles', $1, 'fcra', $2)`,
      [userId, ipAddress]
    );

    await client.query('COMMIT');

    auditFromRequest(req, 'onboarding.completed', 'onboarding', userId, 'Onboarding completed').catch(() => {});
    return sendSuccess(res, { 
      message: 'Onboarding completed successfully',
      completed: true
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, userId: req.user?.id }, 'Error completing onboarding');
    return sendError(res, err.message || 'Error completing onboarding', 400);
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /api/onboarding/legal-documents - Get legal documents for display
// ============================================================================
router.get('/legal-documents', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Fetching legal documents');
    const result = await pool.query(
      `SELECT document_type, title, content, version, effective_date
       FROM legal_documents
       WHERE is_active = true AND language = $1
       ORDER BY document_type`,
      [req.query.language || 'es']
    );

    return sendSuccess(res, result.rows);

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting legal documents');
    return sendInternalError(res, 'Error al obtener documentos legales');
  }
});

// ============================================================================
// GET /api/onboarding/legal-documents/:type - Get specific legal document
// ============================================================================
router.get('/legal-documents/:type', auth, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, documentType: req.params.type }, 'Fetching legal document by type');
    const result = await pool.query(
      `SELECT document_type, title, content, version, effective_date
       FROM legal_documents
       WHERE document_type = $1 AND is_active = true AND language = $2`,
      [req.params.type, req.query.language || 'es']
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Document not found', 404);
    }

    return sendSuccess(res, result.rows[0]);

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting legal document');
    return sendInternalError(res, 'Error al obtener documento legal');
  }
});

// ============================================================================
// ADMIN: GET /api/onboarding/pending - Get all pending onboardings
// ============================================================================
router.get('/pending', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return sendError(res, 'Admin access required', 403);
  }
  
  try {
    logger.info({ userId: req.user?.id }, 'Fetching pending onboardings');
    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.created_at,
        op.current_step, op.status, op.started_at, op.last_activity_at
       FROM users u
       LEFT JOIN onboarding_progress op ON op.client_id = u.id
       WHERE u.role = 'client' 
         AND (op.status = 'in_progress' OR op.status IS NULL)
       ORDER BY op.last_activity_at DESC NULLS LAST`
    );

    return sendSuccess(res, result.rows);

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting pending onboardings');
    return sendInternalError(res, 'Error al obtener onboardings pendientes');
  }
});

// ============================================================================
// ADMIN: GET /api/onboarding/client/:id - Get client onboarding details
// ============================================================================
router.get('/client/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return sendError(res, 'Admin access required', 403);
  }
  
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.id }, 'Fetching client onboarding details');
    const clientId = req.params.id;
    
    // Get profile
    const profileResult = await pool.query(
      `SELECT * FROM client_profiles WHERE user_id = $1`,
      [clientId]
    );

    // Get addresses
    const addressesResult = await pool.query(
      `SELECT * FROM client_addresses WHERE client_id = $1 ORDER BY address_type, created_at DESC`,
      [clientId]
    );

    // Get authorizations
    const authorizationsResult = await pool.query(
      `SELECT * FROM client_authorizations WHERE client_id = $1`,
      [clientId]
    );

    // Get signatures
    const signaturesResult = await pool.query(
      `SELECT * FROM client_signatures WHERE client_id = $1 ORDER BY signed_at DESC`,
      [clientId]
    );

    // Get documents
    const documentsResult = await pool.query(
      `SELECT * FROM documents WHERE client_id = $1 ORDER BY uploaded_at DESC`,
      [clientId]
    );

    // Get onboarding progress
    const progressResult = await pool.query(
      `SELECT * FROM onboarding_progress WHERE client_id = $1`,
      [clientId]
    );

    return sendSuccess(res, {
      profile: profileResult.rows[0] || null,
      addresses: addressesResult.rows,
      authorizations: authorizationsResult.rows,
      signatures: signaturesResult.rows,
      documents: documentsResult.rows,
      progress: progressResult.rows[0] || null
    });

  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting client onboarding details');
    return sendInternalError(res, 'Error al obtener detalles del cliente');
  }
});

// ============================================================================
// ADMIN: POST /api/onboarding/verify/:id - Verify client profile
// ============================================================================
router.post('/verify/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return sendError(res, 'Admin access required', 403);
  }
  
  const client = await pool.connect();
  
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.id }, 'Verifying client profile');
    const clientId = req.params.id;
    const { verified, notes } = req.body;

    await client.query('BEGIN');

    await client.query(
      `UPDATE client_profiles 
       SET profile_verified = $1, 
           profile_verified_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           profile_verified_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [verified, req.user.id, clientId]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, 'profile_verification', 'client_profiles', $2, $3)`,
      [req.user.id, clientId, notes || (verified ? 'Profile verified' : 'Profile verification removed')]
    );

    await client.query('COMMIT');

    auditFromRequest(req, 'onboarding.verified', 'onboarding', clientId, verified ? 'Client profile verified' : 'Client profile verification removed').catch(() => {});
    return sendSuccess(res, { 
      message: verified ? 'Profile verified successfully' : 'Verification removed'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, userId: req.user?.id }, 'Error verifying client profile');
    return sendInternalError(res, 'Error al verificar perfil');
  } finally {
    client.release();
  }
});

module.exports = router;
