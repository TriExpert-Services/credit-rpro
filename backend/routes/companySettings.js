/**
 * Company Settings Routes
 * CRUD operations for company profile data
 * GET  /api/company          - Get company profile
 * PUT  /api/company          - Update company profile (admin only)
 * POST /api/company/logo     - Upload company logo (admin only)
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { auditFromRequest } = require('../utils/auditLogger');
const { sendSuccess, sendError, sendForbidden, asyncHandler } = require('../utils/responseHelpers');

// ─── GET /api/company ────────────────────────────────────────────────────────
// Anyone authenticated can view company info (used in contracts, emails, etc.)
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  logger.info({ userId: req.user.id }, 'Fetching company profile');

  const result = await query(
    `SELECT * FROM company_profile ORDER BY created_at ASC LIMIT 1`
  );

  if (result.rows.length === 0) {
    // Return default company profile
    return sendSuccess(res, {
      profile: {
        company_name: 'Credit Repair Pro',
        industry: 'Credit Repair Services',
        address_country: 'US',
        timezone: 'America/New_York',
        business_hours: 'Mon-Fri 9:00 AM - 5:00 PM',
      }
    });
  }

  return sendSuccess(res, { profile: result.rows[0] });
}));

// ─── PUT /api/company ────────────────────────────────────────────────────────
// Admin-only: Update company profile
router.put('/', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return sendForbidden(res, 'Solo administradores pueden editar datos de empresa');
  }

  logger.info({ userId: req.user.id }, 'Updating company profile');

  const {
    company_name, legal_name, tax_id,
    address_street, address_suite, address_city, address_state, address_zip, address_country,
    phone, fax, email, website, logo_url,
    business_license, founded_date, description, industry,
    social_facebook, social_twitter, social_linkedin, social_instagram, social_youtube,
    business_hours, timezone, support_email, support_phone, billing_email
  } = req.body;

  // Validate required
  if (!company_name || company_name.trim().length < 2) {
    return sendError(res, 'Nombre de empresa es requerido (mínimo 2 caracteres)', 400);
  }

  // Check if profile exists
  const existing = await query('SELECT id FROM company_profile ORDER BY created_at ASC LIMIT 1');

  let result;
  if (existing.rows.length === 0) {
    // Insert new profile
    result = await query(
      `INSERT INTO company_profile (
        company_name, legal_name, tax_id,
        address_street, address_suite, address_city, address_state, address_zip, address_country,
        phone, fax, email, website, logo_url,
        business_license, founded_date, description, industry,
        social_facebook, social_twitter, social_linkedin, social_instagram, social_youtube,
        business_hours, timezone, support_email, support_phone, billing_email,
        updated_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,NOW())
      RETURNING *`,
      [
        company_name.trim(), legal_name?.trim() || null, tax_id?.trim() || null,
        address_street?.trim() || null, address_suite?.trim() || null, address_city?.trim() || null,
        address_state?.trim() || null, address_zip?.trim() || null, address_country?.trim() || 'US',
        phone?.trim() || null, fax?.trim() || null, email?.trim() || null,
        website?.trim() || null, logo_url?.trim() || null,
        business_license?.trim() || null, founded_date || null,
        description?.trim() || null, industry?.trim() || 'Credit Repair Services',
        social_facebook?.trim() || null, social_twitter?.trim() || null,
        social_linkedin?.trim() || null, social_instagram?.trim() || null,
        social_youtube?.trim() || null,
        business_hours?.trim() || 'Mon-Fri 9:00 AM - 5:00 PM',
        timezone?.trim() || 'America/New_York',
        support_email?.trim() || null, support_phone?.trim() || null,
        billing_email?.trim() || null, req.user.id
      ]
    );
  } else {
    // Update existing profile
    result = await query(
      `UPDATE company_profile SET
        company_name = $1, legal_name = $2, tax_id = $3,
        address_street = $4, address_suite = $5, address_city = $6,
        address_state = $7, address_zip = $8, address_country = $9,
        phone = $10, fax = $11, email = $12, website = $13, logo_url = $14,
        business_license = $15, founded_date = $16, description = $17, industry = $18,
        social_facebook = $19, social_twitter = $20, social_linkedin = $21,
        social_instagram = $22, social_youtube = $23,
        business_hours = $24, timezone = $25,
        support_email = $26, support_phone = $27, billing_email = $28,
        updated_by = $29, updated_at = NOW()
      WHERE id = $30
      RETURNING *`,
      [
        company_name.trim(), legal_name?.trim() || null, tax_id?.trim() || null,
        address_street?.trim() || null, address_suite?.trim() || null, address_city?.trim() || null,
        address_state?.trim() || null, address_zip?.trim() || null, address_country?.trim() || 'US',
        phone?.trim() || null, fax?.trim() || null, email?.trim() || null,
        website?.trim() || null, logo_url?.trim() || null,
        business_license?.trim() || null, founded_date || null,
        description?.trim() || null, industry?.trim() || 'Credit Repair Services',
        social_facebook?.trim() || null, social_twitter?.trim() || null,
        social_linkedin?.trim() || null, social_instagram?.trim() || null,
        social_youtube?.trim() || null,
        business_hours?.trim() || 'Mon-Fri 9:00 AM - 5:00 PM',
        timezone?.trim() || 'America/New_York',
        support_email?.trim() || null, support_phone?.trim() || null,
        billing_email?.trim() || null, req.user.id,
        existing.rows[0].id
      ]
    );
  }

  await auditFromRequest(req, 'company_profile_updated', 'company', result.rows[0].id, {
    fields_updated: Object.keys(req.body).filter(k => req.body[k] !== undefined)
  });

  logger.info({ userId: req.user.id }, 'Company profile updated successfully');
  return sendSuccess(res, { profile: result.rows[0] }, 'Perfil de empresa actualizado correctamente');
}));

module.exports = router;
