/**
 * Credit Bureau Integration Service
 * 
 * Abstraction layer for pulling credit reports from the three major bureaus:
 * - Experian (Connect API / Smart ID)
 * - Equifax (Workforce Solutions / Consumer Credit)
 * - TransUnion (TrueVision / CreditView Dashboard)
 * 
 * In production, each bureau requires:
 * 1. A signed agreement / partnership contract
 * 2. API credentials (client_id, client_secret, subscriber code)
 * 3. SSL client certificates (mutual TLS)
 * 4. Permissible purpose under FCRA §604
 * 
 * This service abstracts the bureau-specific APIs into a unified interface.
 * When API keys are not configured, it operates in "sandbox" mode with sample data.
 * 
 * @module utils/bureauService
 */

const { query, transaction } = require('../config/database');
const { logger } = require('./logger');
const crypto = require('crypto');

// ============================================================================
// Bureau API Configuration
// ============================================================================

const BUREAU_CONFIG = {
  experian: {
    name: 'Experian',
    baseUrl: process.env.EXPERIAN_API_URL || 'https://sandbox-us-api.experian.com',
    clientId: process.env.EXPERIAN_CLIENT_ID,
    clientSecret: process.env.EXPERIAN_CLIENT_SECRET,
    subscriberCode: process.env.EXPERIAN_SUBSCRIBER_CODE,
    productCode: process.env.EXPERIAN_PRODUCT_CODE || 'creditProfile',
    endpoints: {
      auth: '/consumerservices/v2/oauth2/token',
      creditReport: '/consumerservices/v2/credit-report',
      creditScore: '/consumerservices/v2/credit-score',
    },
  },
  equifax: {
    name: 'Equifax',
    baseUrl: process.env.EQUIFAX_API_URL || 'https://api.sandbox.equifax.com',
    clientId: process.env.EQUIFAX_CLIENT_ID,
    clientSecret: process.env.EQUIFAX_CLIENT_SECRET,
    memberNumber: process.env.EQUIFAX_MEMBER_NUMBER,
    endpoints: {
      auth: '/v2/oauth/token',
      creditReport: '/business/consumer-credit/v1/reports/credit-report',
      creditScore: '/business/consumer-credit/v1/reports/score',
    },
  },
  transunion: {
    name: 'TransUnion',
    baseUrl: process.env.TRANSUNION_API_URL || 'https://netaccess-test.transunion.com',
    clientId: process.env.TRANSUNION_CLIENT_ID,
    clientSecret: process.env.TRANSUNION_CLIENT_SECRET,
    subscriberCode: process.env.TRANSUNION_SUBSCRIBER_CODE,
    endpoints: {
      auth: '/api/v1/token',
      creditReport: '/api/v1/credit-report',
      creditScore: '/api/v1/credit-score',
    },
  },
};

// Permissible purpose codes (FCRA §604)
const PERMISSIBLE_PURPOSES = {
  CREDIT_TRANSACTION: '08', // Credit transaction initiated by consumer
  ACCOUNT_REVIEW: '12',     // Review of existing account
  WRITTEN_INSTRUCTION: '19', // Consumer written instruction
};

// ============================================================================
// Bureau Authentication
// ============================================================================

/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

/**
 * Obtain an OAuth2 access token from a bureau's API.
 * Tokens are cached until near-expiry.
 * @param {'experian'|'equifax'|'transunion'} bureau
 * @returns {Promise<string>}
 */
async function getAccessToken(bureau) {
  const config = BUREAU_CONFIG[bureau];
  if (!config.clientId || !config.clientSecret) {
    logger.warn({ bureau }, 'Bureau API credentials not configured — using sandbox mode');
    return 'sandbox_token';
  }

  const cached = tokenCache.get(bureau);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  try {
    // Dynamic import so we don't hard-fail if fetch isn't available
    const fetch = (await import('node-fetch')).default;

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(`${config.baseUrl}${config.endpoints.auth}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bureau auth failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    const token = data.access_token;
    const expiresIn = (data.expires_in || 3600) * 1000;

    tokenCache.set(bureau, {
      token,
      expiresAt: Date.now() + expiresIn,
    });

    logger.info({ bureau }, 'Bureau access token obtained');
    return token;
  } catch (error) {
    logger.error({ bureau, err: error.message }, 'Bureau authentication failed');
    throw error;
  }
}

// ============================================================================
// Bureau-Specific API Calls
// ============================================================================

/**
 * Build the consumer identity payload required by each bureau.
 * @param {Object} clientProfile - Client profile from DB
 * @param {string} bureau
 * @returns {Object}
 */
function buildConsumerPayload(clientProfile, bureau) {
  const base = {
    firstName: clientProfile.first_name,
    lastName: clientProfile.last_name,
    ssn: clientProfile.ssn_last_4 ? `***-**-${clientProfile.ssn_last_4}` : undefined,
    dateOfBirth: clientProfile.date_of_birth,
    address: {
      line1: clientProfile.address_line1,
      line2: clientProfile.address_line2,
      city: clientProfile.city,
      state: clientProfile.state,
      zipCode: clientProfile.zip_code,
    },
  };

  // Bureau-specific payload adjustments
  switch (bureau) {
    case 'experian':
      return {
        consumerPii: {
          primaryApplicant: {
            name: { firstName: base.firstName, lastName: base.lastName },
            ssn: { ssn: base.ssn },
            dob: { dob: base.dateOfBirth },
            currentAddress: {
              line1: base.address.line1,
              line2: base.address.line2 || '',
              city: base.address.city,
              state: base.address.state,
              zipCode: base.address.zipCode,
            },
          },
        },
        requestor: {
          subscriberCode: BUREAU_CONFIG.experian.subscriberCode,
        },
        permissiblePurpose: { type: PERMISSIBLE_PURPOSES.WRITTEN_INSTRUCTION },
        addOns: { directCheck: '', demographics: 'allReturnableDemo' },
      };

    case 'equifax':
      return {
        consumers: {
          name: [{ firstName: base.firstName, lastName: base.lastName, suffix: '' }],
          socialNum: [{ socialNum: base.ssn }],
          dateOfBirth: base.dateOfBirth,
          addresses: [{
            line1: base.address.line1,
            line2: base.address.line2 || '',
            city: base.address.city,
            state: base.address.state,
            zipCode: base.address.zipCode,
          }],
        },
        customerConfiguration: {
          equifaxUSConsumerCreditReport: {
            memberNumber: BUREAU_CONFIG.equifax.memberNumber,
            customerCode: '',
            outputFormat: 'json',
            models: [{ modelId: 'FICO9' }],
          },
        },
      };

    case 'transunion':
      return {
        subscriber: { subscriberCode: BUREAU_CONFIG.transunion.subscriberCode },
        subject: {
          name: { firstName: base.firstName, lastName: base.lastName },
          socialSecurity: base.ssn,
          dateOfBirth: base.dateOfBirth,
          addresses: [{
            street: base.address.line1,
            city: base.address.city,
            state: base.address.state,
            zip: base.address.zipCode,
          }],
        },
        product: { code: 'creditReport', options: { scoreModel: 'vantageScore3' } },
        permissiblePurpose: { code: PERMISSIBLE_PURPOSES.WRITTEN_INSTRUCTION },
      };

    default:
      throw new Error(`Unknown bureau: ${bureau}`);
  }
}

/**
 * Pull a credit report from a specific bureau's API.
 * Falls back to sandbox data when credentials are not configured.
 * @param {'experian'|'equifax'|'transunion'} bureau
 * @param {Object} clientProfile
 * @returns {Promise<Object>} Raw bureau response
 */
async function pullFromBureau(bureau, clientProfile) {
  const config = BUREAU_CONFIG[bureau];
  const token = await getAccessToken(bureau);

  if (token === 'sandbox_token') {
    logger.info({ bureau }, 'Using sandbox mode — returning simulated report');
    return generateSandboxReport(bureau, clientProfile);
  }

  const fetch = (await import('node-fetch')).default;
  const payload = buildConsumerPayload(clientProfile, bureau);

  const response = await fetch(`${config.baseUrl}${config.endpoints.creditReport}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bureau report pull failed (${response.status}): ${error}`);
  }

  return response.json();
}

// ============================================================================
// Sandbox / Simulation Mode
// ============================================================================

/**
 * Generate a realistic simulated credit report for development/testing.
 * @param {'experian'|'equifax'|'transunion'} bureau
 * @param {Object} clientProfile
 * @returns {Object}
 */
function generateSandboxReport(bureau, clientProfile) {
  const baseScore = 580 + Math.floor(Math.random() * 200);
  const scoreVariation = Math.floor(Math.random() * 30) - 15;
  const score = Math.max(300, Math.min(850, baseScore + scoreVariation));

  const creditors = [
    { name: 'Chase Bank', type: 'credit_card', balance: 2500 },
    { name: 'Bank of America', type: 'mortgage', balance: 185000 },
    { name: 'Capital One', type: 'credit_card', balance: 1200 },
    { name: 'Wells Fargo', type: 'auto_loan', balance: 15000 },
    { name: 'Discover', type: 'credit_card', balance: 800 },
    { name: 'American Express', type: 'credit_card', balance: 3200 },
    { name: 'SoFi', type: 'personal_loan', balance: 5000 },
    { name: 'Synchrony Financial', type: 'retail_card', balance: 450 },
  ];

  const negativeItems = [
    { creditor: 'ABC Collections', type: 'collection', balance: 850, dateReported: '2025-03-15', accountNumber: `COL${Math.random().toString(36).slice(2, 8).toUpperCase()}` },
    { creditor: 'XYZ Medical', type: 'collection', balance: 1200, dateReported: '2024-11-20', accountNumber: `MED${Math.random().toString(36).slice(2, 8).toUpperCase()}` },
  ];

  if (score < 650) {
    negativeItems.push(
      { creditor: 'Capital One', type: 'late_payment', balance: 0, dateReported: '2025-06-10', accountNumber: `LP${Math.random().toString(36).slice(2, 8).toUpperCase()}` },
      { creditor: 'Midland Credit', type: 'charge_off', balance: 2340, dateReported: '2024-08-05', accountNumber: `CO${Math.random().toString(36).slice(2, 8).toUpperCase()}` }
    );
  }

  const inquiries = [
    { creditor: 'Chase Bank', date: '2025-09-12', type: 'hard' },
    { creditor: 'Auto Dealer Finance', date: '2025-07-20', type: 'hard' },
    { creditor: 'Bank of America', date: '2025-05-03', type: 'soft' },
  ];

  const now = new Date().toISOString();

  return {
    bureau,
    reportId: `RPT-${bureau.toUpperCase()}-${crypto.randomUUID()}`,
    reportDate: now.split('T')[0],
    generatedAt: now,
    consumer: {
      firstName: clientProfile.first_name,
      lastName: clientProfile.last_name,
      dateOfBirth: clientProfile.date_of_birth,
      addresses: [{
        line1: clientProfile.address_line1 || '123 Main St',
        city: clientProfile.city || 'Dallas',
        state: clientProfile.state || 'TX',
        zipCode: clientProfile.zip_code || '75001',
        type: 'current',
      }],
    },
    score: {
      value: score,
      model: bureau === 'transunion' ? 'VantageScore 3.0' : 'FICO Score 8',
      range: { min: 300, max: 850 },
      factors: [
        { code: '14', description: 'Length of time accounts have been established' },
        { code: '01', description: 'Amount owed on accounts is too high' },
        { code: '09', description: 'Too many accounts with balances' },
        { code: '40', description: 'Derogatory public records or collections' },
      ],
    },
    accounts: creditors.map((c, i) => ({
      accountNumber: `****${(1000 + i * 111).toString().slice(-4)}`,
      creditorName: c.name,
      accountType: c.type,
      balance: c.balance,
      creditLimit: c.type.includes('card') || c.type.includes('retail') ? c.balance * 3 : undefined,
      paymentStatus: 'current',
      dateOpened: `20${18 + Math.floor(Math.random() * 6)}-0${1 + Math.floor(Math.random() * 9)}-01`,
      lastReported: now.split('T')[0],
      monthsReviewed: 12 + Math.floor(Math.random() * 48),
    })),
    negativeItems: negativeItems.map((item) => ({
      ...item,
      bureau,
      status: 'open',
      originalCreditor: item.type === 'collection' ? `Original: ${item.creditor}` : undefined,
    })),
    inquiries,
    publicRecords: [],
    summary: {
      totalAccounts: creditors.length,
      openAccounts: creditors.length - 1,
      closedAccounts: 1,
      totalBalance: creditors.reduce((sum, c) => sum + c.balance, 0),
      totalNegativeItems: negativeItems.length,
      totalInquiries: inquiries.filter((i) => i.type === 'hard').length,
      oldestAccount: '2018-03-01',
      averageAccountAge: '4 years 7 months',
      utilizationRate: 42,
    },
  };
}

// ============================================================================
// Report Normalization
// ============================================================================

/**
 * Normalize a raw bureau response into a standard format.
 * Each bureau returns data differently; this unifies them.
 * @param {'experian'|'equifax'|'transunion'} bureau
 * @param {Object} rawReport
 * @returns {Object} Normalized report
 */
function normalizeReport(bureau, rawReport) {
  // Sandbox reports are already normalized
  if (rawReport.reportId && rawReport.reportId.startsWith('RPT-')) {
    return rawReport;
  }

  // Production normalizers per bureau
  switch (bureau) {
    case 'experian':
      return normalizeExperianReport(rawReport);
    case 'equifax':
      return normalizeEquifaxReport(rawReport);
    case 'transunion':
      return normalizeTransUnionReport(rawReport);
    default:
      throw new Error(`Unknown bureau: ${bureau}`);
  }
}

function normalizeExperianReport(raw) {
  const profile = raw?.creditProfile?.[0] || {};
  const creditReport = profile?.tradeline || [];
  const scoreData = profile?.riskModel?.[0] || {};

  return {
    bureau: 'experian',
    reportId: profile.reportId || `RPT-EXPERIAN-${crypto.randomUUID()}`,
    reportDate: profile.reportDate || new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    consumer: {
      firstName: profile?.consumerIdentity?.name?.[0]?.firstName || '',
      lastName: profile?.consumerIdentity?.name?.[0]?.surname || '',
      dateOfBirth: profile?.consumerIdentity?.dob?.dob || '',
      addresses: (profile?.consumerIdentity?.address || []).map((a) => ({
        line1: a.streetName || '',
        city: a.cityName || '',
        state: a.stateCode || '',
        zipCode: a.zipCode || '',
        type: a.dwellingType || 'current',
      })),
    },
    score: {
      value: parseInt(scoreData.score, 10) || 0,
      model: scoreData.modelIndicator || 'FICO Score 8',
      range: { min: 300, max: 850 },
      factors: (scoreData.scoreFactors || []).map((f) => ({
        code: f.factorCode,
        description: f.factorText,
      })),
    },
    accounts: creditReport.map((t) => ({
      accountNumber: t.accountNumber || '',
      creditorName: t.creditorName || '',
      accountType: mapExperianAccountType(t.accountType),
      balance: parseFloat(t.balanceAmount) || 0,
      creditLimit: parseFloat(t.creditLimit) || undefined,
      paymentStatus: t.paymentStatus || 'unknown',
      dateOpened: t.dateOpened || '',
      lastReported: t.dateReported || '',
      monthsReviewed: parseInt(t.monthsReviewed, 10) || 0,
    })),
    negativeItems: (profile?.publicRecord || []).concat(profile?.collection || []).map((item) => ({
      creditor: item.creditorName || item.courtName || 'Unknown',
      type: mapExperianItemType(item),
      balance: parseFloat(item.amount) || 0,
      dateReported: item.dateReported || item.dateFiled || '',
      accountNumber: item.accountNumber || '',
      bureau: 'experian',
      status: item.status || 'open',
    })),
    inquiries: (profile?.inquiry || []).map((inq) => ({
      creditor: inq.subscriberName || '',
      date: inq.inquiryDate || '',
      type: inq.inquiryType === '01' ? 'hard' : 'soft',
    })),
    publicRecords: (profile?.publicRecord || []).map((pr) => ({
      type: pr.type || 'unknown',
      court: pr.courtName || '',
      dateFiled: pr.dateFiled || '',
      amount: parseFloat(pr.amount) || 0,
      status: pr.status || 'unknown',
    })),
    summary: {
      totalAccounts: creditReport.length,
      openAccounts: creditReport.filter((t) => t.openIndicator === 'open').length,
      closedAccounts: creditReport.filter((t) => t.openIndicator === 'closed').length,
      totalBalance: creditReport.reduce((sum, t) => sum + (parseFloat(t.balanceAmount) || 0), 0),
      totalNegativeItems: (profile?.publicRecord || []).length + (profile?.collection || []).length,
      totalInquiries: (profile?.inquiry || []).filter((i) => i.inquiryType === '01').length,
    },
  };
}

function normalizeEquifaxReport(raw) {
  const report = raw?.consumers?.equifaxUSConsumerCreditReport?.[0] || {};
  const trades = report?.trades || [];
  const scoreData = report?.models?.[0] || {};

  return {
    bureau: 'equifax',
    reportId: report.reportNumber || `RPT-EQUIFAX-${crypto.randomUUID()}`,
    reportDate: report.reportDate || new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    consumer: {
      firstName: report?.subjectName?.firstName || '',
      lastName: report?.subjectName?.lastName || '',
      dateOfBirth: report?.dateOfBirth || '',
      addresses: (report?.addresses || []).map((a) => ({
        line1: a.streetAddress || '',
        city: a.city || '',
        state: a.state || '',
        zipCode: a.zip || '',
        type: a.addressType || 'current',
      })),
    },
    score: {
      value: parseInt(scoreData.score, 10) || 0,
      model: scoreData.modelId || 'FICO9',
      range: { min: 300, max: 850 },
      factors: (scoreData.reasons || []).map((r) => ({
        code: r.reasonCode,
        description: r.reasonDescription,
      })),
    },
    accounts: trades.map((t) => ({
      accountNumber: t.accountNumber || '',
      creditorName: t.subscriberName || '',
      accountType: t.portfolioType || 'unknown',
      balance: parseFloat(t.balance) || 0,
      creditLimit: parseFloat(t.highCredit) || undefined,
      paymentStatus: t.paymentStatus || 'unknown',
      dateOpened: t.dateOpened || '',
      lastReported: t.dateReported || '',
      monthsReviewed: parseInt(t.months, 10) || 0,
    })),
    negativeItems: (report?.collections || []).map((c) => ({
      creditor: c.creditorName || 'Unknown',
      type: 'collection',
      balance: parseFloat(c.balance) || 0,
      dateReported: c.dateReported || '',
      accountNumber: c.accountNumber || '',
      bureau: 'equifax',
      status: c.status || 'open',
    })),
    inquiries: (report?.inquiries || []).map((inq) => ({
      creditor: inq.subscriberName || '',
      date: inq.inquiryDate || '',
      type: inq.inquiryType === 'individual' ? 'hard' : 'soft',
    })),
    publicRecords: (report?.publicRecords || []).map((pr) => ({
      type: pr.publicRecordType || 'unknown',
      court: pr.courtName || '',
      dateFiled: pr.dateFiled || '',
      amount: parseFloat(pr.amount) || 0,
      status: pr.status || 'unknown',
    })),
    summary: {
      totalAccounts: trades.length,
      openAccounts: trades.filter((t) => t.openClosed === 'O').length,
      closedAccounts: trades.filter((t) => t.openClosed === 'C').length,
      totalBalance: trades.reduce((sum, t) => sum + (parseFloat(t.balance) || 0), 0),
      totalNegativeItems: (report?.collections || []).length,
      totalInquiries: (report?.inquiries || []).filter((i) => i.inquiryType === 'individual').length,
    },
  };
}

function normalizeTransUnionReport(raw) {
  const report = raw?.creditReport || raw || {};
  const tradelines = report?.tradelines || [];
  const scoreData = report?.creditScore || {};

  return {
    bureau: 'transunion',
    reportId: report.reportId || `RPT-TRANSUNION-${crypto.randomUUID()}`,
    reportDate: report.reportDate || new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    consumer: {
      firstName: report?.consumer?.firstName || '',
      lastName: report?.consumer?.lastName || '',
      dateOfBirth: report?.consumer?.dateOfBirth || '',
      addresses: (report?.consumer?.addresses || []).map((a) => ({
        line1: a.street || '',
        city: a.city || '',
        state: a.state || '',
        zipCode: a.zip || '',
        type: a.type || 'current',
      })),
    },
    score: {
      value: parseInt(scoreData.score, 10) || 0,
      model: scoreData.model || 'VantageScore 3.0',
      range: { min: 300, max: 850 },
      factors: (scoreData.factors || []).map((f) => ({
        code: f.code,
        description: f.description,
      })),
    },
    accounts: tradelines.map((t) => ({
      accountNumber: t.accountNumber || '',
      creditorName: t.creditorName || '',
      accountType: t.accountType || 'unknown',
      balance: parseFloat(t.currentBalance) || 0,
      creditLimit: parseFloat(t.creditLimit) || undefined,
      paymentStatus: t.paymentStatus || 'unknown',
      dateOpened: t.dateOpened || '',
      lastReported: t.lastReported || '',
      monthsReviewed: parseInt(t.monthsReviewed, 10) || 0,
    })),
    negativeItems: (report?.collections || []).concat(report?.adverseItems || []).map((item) => ({
      creditor: item.creditorName || 'Unknown',
      type: item.type || 'collection',
      balance: parseFloat(item.balance) || 0,
      dateReported: item.dateReported || '',
      accountNumber: item.accountNumber || '',
      bureau: 'transunion',
      status: item.status || 'open',
    })),
    inquiries: (report?.inquiries || []).map((inq) => ({
      creditor: inq.subscriberName || '',
      date: inq.inquiryDate || '',
      type: inq.type || 'hard',
    })),
    publicRecords: (report?.publicRecords || []).map((pr) => ({
      type: pr.type || 'unknown',
      court: pr.court || '',
      dateFiled: pr.dateFiled || '',
      amount: parseFloat(pr.amount) || 0,
      status: pr.status || 'unknown',
    })),
    summary: {
      totalAccounts: tradelines.length,
      openAccounts: tradelines.filter((t) => t.status === 'open').length,
      closedAccounts: tradelines.filter((t) => t.status === 'closed').length,
      totalBalance: tradelines.reduce((sum, t) => sum + (parseFloat(t.currentBalance) || 0), 0),
      totalNegativeItems: (report?.collections || []).length + (report?.adverseItems || []).length,
      totalInquiries: (report?.inquiries || []).filter((i) => i.type === 'hard').length,
    },
  };
}

// Helper mappers for Experian-specific codes
function mapExperianAccountType(code) {
  const map = { '01': 'auto_loan', '02': 'credit_card', '03': 'mortgage', '04': 'student_loan', '05': 'personal_loan' };
  return map[code] || 'other';
}

function mapExperianItemType(item) {
  if (item.courtName) return 'bankruptcy';
  if (item.accountType === 'collection') return 'collection';
  return 'charge_off';
}

// ============================================================================
// Core Public API
// ============================================================================

const bureauService = {
  /**
   * Check which bureaus are configured and available.
   * @returns {Object} Status per bureau
   */
  getBureauStatus() {
    const statuses = {};
    for (const [key, config] of Object.entries(BUREAU_CONFIG)) {
      statuses[key] = {
        name: config.name,
        configured: !!(config.clientId && config.clientSecret),
        mode: config.clientId && config.clientSecret ? 'live' : 'sandbox',
        baseUrl: config.baseUrl,
      };
    }
    return statuses;
  },

  /**
   * Pull a credit report from one bureau and save it as a snapshot.
   * @param {string} clientId - UUID of the client
   * @param {'experian'|'equifax'|'transunion'} bureau
   * @param {string} requestedBy - UUID of the user requesting the pull
   * @param {string} [purpose='review'] - Permissible purpose
   * @returns {Promise<Object>} Normalized report + metadata
   */
  async pullReport(clientId, bureau, requestedBy, purpose = 'review') {
    logger.info({ clientId, bureau, requestedBy }, 'Initiating bureau report pull');

    // 1. Get client profile
    const profileResult = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              cp.date_of_birth, cp.ssn_last_4, cp.address_line1, cp.address_line2,
              cp.city, cp.state, cp.zip_code
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [clientId]
    );

    if (profileResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    const clientProfile = profileResult.rows[0];

    // 2. Log the pull request
    const pullRecord = await query(
      `INSERT INTO bureau_pull_history
       (client_id, bureau, pull_type, status, requested_by, permissible_purpose)
       VALUES ($1, $2, 'manual', 'in_progress', $3, $4)
       RETURNING id`,
      [clientId, bureau, requestedBy, purpose]
    );

    const pullId = pullRecord.rows[0].id;

    try {
      // 3. Pull from bureau API
      const rawReport = await pullFromBureau(bureau, clientProfile);

      // 4. Normalize
      const normalizedReport = normalizeReport(bureau, rawReport);

      // 5. Save snapshot
      const snapshot = await this.saveSnapshot(clientId, bureau, normalizedReport, pullId);

      // 6. Save score
      if (normalizedReport.score?.value) {
        await this.saveScoreFromReport(clientId, bureau, normalizedReport.score.value, normalizedReport.reportDate);
      }

      // 7. Save/update credit items
      await this.syncCreditItems(clientId, bureau, normalizedReport);

      // 8. Update pull record
      await query(
        `UPDATE bureau_pull_history
         SET status = 'completed', report_id = $2, completed_at = NOW()
         WHERE id = $1`,
        [pullId, normalizedReport.reportId]
      );

      // 9. Log activity
      await query(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
         VALUES ($1, 'bureau_report_pulled', 'credit_report', $2, $3)`,
        [requestedBy, snapshot.id, `${bureau} credit report pulled for client ${clientId}`]
      );

      logger.info({ clientId, bureau, pullId, snapshotId: snapshot.id }, 'Bureau report pull completed');

      return {
        pullId,
        snapshot,
        report: normalizedReport,
        changesDetected: snapshot.changesDetected || [],
      };
    } catch (error) {
      // Update pull record with error
      await query(
        `UPDATE bureau_pull_history
         SET status = 'failed', error_message = $2, completed_at = NOW()
         WHERE id = $1`,
        [pullId, error.message]
      );

      logger.error({ clientId, bureau, pullId, err: error.message }, 'Bureau report pull failed');
      throw error;
    }
  },

  /**
   * Pull reports from all three bureaus simultaneously.
   * @param {string} clientId
   * @param {string} requestedBy
   * @returns {Promise<Object>} Results per bureau
   */
  async pullAllBureaus(clientId, requestedBy) {
    logger.info({ clientId, requestedBy }, 'Pulling reports from all three bureaus');

    const bureaus = ['experian', 'equifax', 'transunion'];
    const results = {};

    const promises = bureaus.map(async (bureau) => {
      try {
        results[bureau] = await this.pullReport(clientId, bureau, requestedBy);
        results[bureau].success = true;
      } catch (error) {
        results[bureau] = { success: false, error: error.message };
      }
    });

    await Promise.allSettled(promises);

    // Detect cross-bureau changes
    const crossBureauAnalysis = await this.analyzeCrossBureau(clientId);

    return {
      results,
      crossBureauAnalysis,
      pulledAt: new Date().toISOString(),
    };
  },

  /**
   * Save a normalized report as a snapshot for change detection.
   * @param {string} clientId
   * @param {'experian'|'equifax'|'transunion'} bureau
   * @param {Object} normalizedReport
   * @param {string} pullId
   * @returns {Promise<Object>}
   */
  async saveSnapshot(clientId, bureau, normalizedReport, pullId) {
    // Get previous snapshot for comparison
    const prevResult = await query(
      `SELECT id, report_data FROM credit_report_snapshots
       WHERE client_id = $1 AND bureau = $2
       ORDER BY created_at DESC LIMIT 1`,
      [clientId, bureau]
    );

    const previousSnapshot = prevResult.rows[0] || null;

    // Detect changes if previous snapshot exists
    let changesDetected = [];
    if (previousSnapshot) {
      changesDetected = this.detectChanges(previousSnapshot.report_data, normalizedReport);
    }

    // Save new snapshot
    const result = await query(
      `INSERT INTO credit_report_snapshots
       (client_id, bureau, report_id, report_date, report_data, score, pull_id,
        previous_snapshot_id, changes_detected, changes_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        clientId, bureau,
        normalizedReport.reportId,
        normalizedReport.reportDate,
        JSON.stringify(normalizedReport),
        normalizedReport.score?.value || null,
        pullId,
        previousSnapshot?.id || null,
        JSON.stringify(changesDetected),
        changesDetected.length,
      ]
    );

    // If changes detected, save them individually
    if (changesDetected.length > 0) {
      await this.saveChanges(clientId, bureau, result.rows[0].id, previousSnapshot?.id, changesDetected);
    }

    return { ...result.rows[0], changesDetected };
  },

  /**
   * Compare two report snapshots and identify changes.
   * @param {Object} previousReport
   * @param {Object} currentReport
   * @returns {Array<Object>} List of changes
   */
  detectChanges(previousReport, currentReport) {
    const changes = [];
    const prev = typeof previousReport === 'string' ? JSON.parse(previousReport) : previousReport;
    const curr = currentReport;

    // 1. Score change
    if (prev.score?.value !== curr.score?.value) {
      changes.push({
        changeType: 'score_change',
        category: 'score',
        severity: Math.abs((curr.score?.value || 0) - (prev.score?.value || 0)) > 30 ? 'high' : 'medium',
        description: `Score changed from ${prev.score?.value} to ${curr.score?.value}`,
        previousValue: prev.score?.value,
        currentValue: curr.score?.value,
        delta: (curr.score?.value || 0) - (prev.score?.value || 0),
      });
    }

    // 2. New negative items
    const prevNegIds = new Set((prev.negativeItems || []).map((n) => `${n.creditor}-${n.type}-${n.accountNumber}`));
    for (const item of curr.negativeItems || []) {
      const key = `${item.creditor}-${item.type}-${item.accountNumber}`;
      if (!prevNegIds.has(key)) {
        changes.push({
          changeType: 'new_negative_item',
          category: 'negative_item',
          severity: 'high',
          description: `New negative item: ${item.type} from ${item.creditor} ($${item.balance})`,
          currentValue: item,
        });
      }
    }

    // 3. Removed negative items (resolved / deleted)
    const currNegIds = new Set((curr.negativeItems || []).map((n) => `${n.creditor}-${n.type}-${n.accountNumber}`));
    for (const item of prev.negativeItems || []) {
      const key = `${item.creditor}-${item.type}-${item.accountNumber}`;
      if (!currNegIds.has(key)) {
        changes.push({
          changeType: 'removed_negative_item',
          category: 'negative_item',
          severity: 'high',
          description: `Negative item removed: ${item.type} from ${item.creditor}`,
          previousValue: item,
          isPositive: true,
        });
      }
    }

    // 4. New accounts
    const prevAccIds = new Set((prev.accounts || []).map((a) => `${a.creditorName}-${a.accountNumber}`));
    for (const acct of curr.accounts || []) {
      const key = `${acct.creditorName}-${acct.accountNumber}`;
      if (!prevAccIds.has(key)) {
        changes.push({
          changeType: 'new_account',
          category: 'account',
          severity: 'low',
          description: `New account: ${acct.creditorName} (${acct.accountType})`,
          currentValue: acct,
        });
      }
    }

    // 5. Balance changes (significant — >10% or >$500)
    const prevAccMap = new Map((prev.accounts || []).map((a) => [`${a.creditorName}-${a.accountNumber}`, a]));
    for (const acct of curr.accounts || []) {
      const key = `${acct.creditorName}-${acct.accountNumber}`;
      const prevAcct = prevAccMap.get(key);
      if (prevAcct) {
        const diff = Math.abs(acct.balance - prevAcct.balance);
        const pctChange = prevAcct.balance > 0 ? (diff / prevAcct.balance) * 100 : 0;
        if (diff > 500 || pctChange > 10) {
          changes.push({
            changeType: 'balance_change',
            category: 'account',
            severity: pctChange > 25 ? 'high' : 'medium',
            description: `Balance change on ${acct.creditorName}: $${prevAcct.balance} → $${acct.balance}`,
            previousValue: prevAcct.balance,
            currentValue: acct.balance,
            delta: acct.balance - prevAcct.balance,
          });
        }
      }
    }

    // 6. New inquiries
    const prevInqIds = new Set((prev.inquiries || []).map((i) => `${i.creditor}-${i.date}`));
    for (const inq of curr.inquiries || []) {
      const key = `${inq.creditor}-${inq.date}`;
      if (!prevInqIds.has(key) && inq.type === 'hard') {
        changes.push({
          changeType: 'new_inquiry',
          category: 'inquiry',
          severity: 'medium',
          description: `New hard inquiry from ${inq.creditor} on ${inq.date}`,
          currentValue: inq,
        });
      }
    }

    // 7. Utilization change
    if (prev.summary?.utilizationRate !== undefined && curr.summary?.utilizationRate !== undefined) {
      const utilDiff = Math.abs(curr.summary.utilizationRate - prev.summary.utilizationRate);
      if (utilDiff >= 5) {
        changes.push({
          changeType: 'utilization_change',
          category: 'summary',
          severity: utilDiff > 15 ? 'high' : 'medium',
          description: `Utilization changed from ${prev.summary.utilizationRate}% to ${curr.summary.utilizationRate}%`,
          previousValue: prev.summary.utilizationRate,
          currentValue: curr.summary.utilizationRate,
          delta: curr.summary.utilizationRate - prev.summary.utilizationRate,
        });
      }
    }

    return changes;
  },

  /**
   * Save detected changes to the database.
   */
  async saveChanges(clientId, bureau, snapshotId, previousSnapshotId, changes) {
    for (const change of changes) {
      await query(
        `INSERT INTO credit_report_changes
         (client_id, bureau, snapshot_id, previous_snapshot_id,
          change_type, category, severity, description,
          previous_value, current_value, delta, is_positive)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          clientId, bureau, snapshotId, previousSnapshotId,
          change.changeType, change.category, change.severity, change.description,
          JSON.stringify(change.previousValue || null),
          JSON.stringify(change.currentValue || null),
          change.delta || null,
          change.isPositive || false,
        ]
      );
    }

    // Create notification for high-severity changes
    const highSeverity = changes.filter((c) => c.severity === 'high');
    if (highSeverity.length > 0) {
      await query(
        `INSERT INTO notifications
         (recipient_id, notification_type, channel, subject, message)
         VALUES ($1, 'score_update', 'in_app', $2, $3)`,
        [
          clientId,
          `${highSeverity.length} important change(s) detected on your ${bureau} report`,
          highSeverity.map((c) => c.description).join('\n'),
        ]
      );
    }
  },

  /**
   * Save a credit score from a bureau report.
   */
  async saveScoreFromReport(clientId, bureau, score, reportDate) {
    // Check for duplicate
    const existing = await query(
      `SELECT id FROM credit_scores
       WHERE client_id = $1 AND bureau = $2 AND score_date = $3`,
      [clientId, bureau, reportDate]
    );

    if (existing.rows.length > 0) {
      // Update if score changed
      await query(
        `UPDATE credit_scores SET score = $3, updated_at = NOW()
         WHERE client_id = $1 AND bureau = $2 AND score_date = $4 AND score != $3`,
        [clientId, bureau, score, reportDate]
      );
      return;
    }

    // Get previous score for audit
    const prevScore = await query(
      `SELECT score FROM credit_scores
       WHERE client_id = $1 AND bureau = $2
       ORDER BY score_date DESC LIMIT 1`,
      [clientId, bureau]
    );

    await query(
      `INSERT INTO credit_scores (client_id, bureau, score, score_date, notes)
       VALUES ($1, $2, $3, $4, 'Auto-imported from bureau report')`,
      [clientId, bureau, score, reportDate]
    );

    // Audit trail
    await query(
      `INSERT INTO credit_score_audit (client_id, bureau, previous_score, new_score, score_change, data_source)
       VALUES ($1, $2, $3, $4, $5, 'bureau_import')`,
      [
        clientId, bureau,
        prevScore.rows[0]?.score || null,
        score,
        prevScore.rows[0] ? score - prevScore.rows[0].score : null,
      ]
    );
  },

  /**
   * Sync credit items from bureau report to the credit_items table.
   * Matches existing items by creditor + account number to avoid duplicates.
   */
  async syncCreditItems(clientId, bureau, normalizedReport) {
    const negativeItems = normalizedReport.negativeItems || [];

    for (const item of negativeItems) {
      // Map bureau item type to our types
      const itemType = mapToInternalItemType(item.type);

      // Try to find existing item
      const existing = await query(
        `SELECT id, status FROM credit_items
         WHERE client_id = $1 AND bureau = $2
           AND creditor_name = $3 AND account_number = $4
           AND deleted_at IS NULL`,
        [clientId, bureau, item.creditor, item.accountNumber || '']
      );

      if (existing.rows.length > 0) {
        // Update balance/date if changed
        await query(
          `UPDATE credit_items
           SET balance = $3, date_reported = $4, updated_at = NOW()
           WHERE id = $1 AND (balance != $3 OR date_reported != $4)`,
          [existing.rows[0].id, bureau, item.balance, item.dateReported || null]
        );
      } else {
        // Insert new item
        await query(
          `INSERT INTO credit_items
           (client_id, item_type, creditor_name, account_number, bureau, balance, status, date_reported, description)
           VALUES ($1, $2, $3, $4, $5, $6, 'identified', $7, $8)`,
          [
            clientId, itemType, item.creditor, item.accountNumber || '',
            bureau, item.balance,
            item.dateReported || null,
            item.originalCreditor ? `Original creditor: ${item.originalCreditor}` : null,
          ]
        );
      }
    }
  },

  /**
   * Analyze cross-bureau data for discrepancies.
   */
  async analyzeCrossBureau(clientId) {
    // Get latest snapshot from each bureau
    const snapshots = await query(
      `SELECT DISTINCT ON (bureau) bureau, score, report_data, created_at
       FROM credit_report_snapshots
       WHERE client_id = $1
       ORDER BY bureau, created_at DESC`,
      [clientId]
    );

    if (snapshots.rows.length < 2) {
      return { message: 'Need at least 2 bureau reports for cross-bureau analysis' };
    }

    const scores = {};
    const negItemCounts = {};

    for (const row of snapshots.rows) {
      const data = typeof row.report_data === 'string' ? JSON.parse(row.report_data) : row.report_data;
      scores[row.bureau] = row.score;
      negItemCounts[row.bureau] = (data.negativeItems || []).length;
    }

    const scoreValues = Object.values(scores).filter(Boolean);
    const maxSpread = Math.max(...scoreValues) - Math.min(...scoreValues);

    const discrepancies = [];

    if (maxSpread > 40) {
      discrepancies.push({
        type: 'score_spread',
        severity: maxSpread > 80 ? 'high' : 'medium',
        description: `Score spread of ${maxSpread} points across bureaus`,
        scores,
      });
    }

    // Compare negative item counts
    const negValues = Object.values(negItemCounts);
    const negSpread = Math.max(...negValues) - Math.min(...negValues);
    if (negSpread > 2) {
      discrepancies.push({
        type: 'negative_item_discrepancy',
        severity: 'medium',
        description: `Different number of negative items across bureaus`,
        negItemCounts,
      });
    }

    return {
      bureausCompared: Object.keys(scores),
      scores,
      negItemCounts,
      maxScoreSpread: maxSpread,
      discrepancies,
      analyzedAt: new Date().toISOString(),
    };
  },

  /**
   * Get pull history for a client.
   */
  async getPullHistory(clientId, limit = 20) {
    const result = await query(
      `SELECT bph.*,
              u.first_name || ' ' || u.last_name as requested_by_name
       FROM bureau_pull_history bph
       LEFT JOIN users u ON u.id = bph.requested_by
       WHERE bph.client_id = $1
       ORDER BY bph.created_at DESC
       LIMIT $2`,
      [clientId, limit]
    );
    return result.rows;
  },

  /**
   * Get the latest snapshot for a client from each bureau.
   */
  async getLatestSnapshots(clientId) {
    const result = await query(
      `SELECT DISTINCT ON (bureau) *
       FROM credit_report_snapshots
       WHERE client_id = $1
       ORDER BY bureau, created_at DESC`,
      [clientId]
    );
    return result.rows;
  },

  /**
   * Get change history for a client.
   */
  async getChangeHistory(clientId, options = {}) {
    const { bureau, severity, category, limit = 50, offset = 0 } = options;
    
    let whereClause = 'WHERE client_id = $1';
    const params = [clientId];
    let paramIdx = 2;

    if (bureau) {
      whereClause += ` AND bureau = $${paramIdx++}`;
      params.push(bureau);
    }
    if (severity) {
      whereClause += ` AND severity = $${paramIdx++}`;
      params.push(severity);
    }
    if (category) {
      whereClause += ` AND category = $${paramIdx++}`;
      params.push(category);
    }

    const result = await query(
      `SELECT * FROM credit_report_changes
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM credit_report_changes ${whereClause}`,
      params
    );

    return {
      changes: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset,
    };
  },

  /**
   * Get a bureau connection's config status (for admin panel).
   */
  async getConnectionStatus(bureau) {
    const result = await query(
      `SELECT * FROM bureau_connections WHERE bureau = $1`,
      [bureau]
    );

    const config = BUREAU_CONFIG[bureau];
    const isConfigured = !!(config?.clientId && config?.clientSecret);

    return {
      bureau,
      name: config?.name || bureau,
      isConfigured,
      mode: isConfigured ? 'live' : 'sandbox',
      connection: result.rows[0] || null,
    };
  },

  /**
   * Save or update bureau connection credentials (admin only, stored encrypted).
   */
  async saveConnection(bureau, connectionData, updatedBy) {
    const result = await query(
      `INSERT INTO bureau_connections (bureau, api_url, credentials, is_active, updated_by)
       VALUES ($1, $2, $3, true, $4)
       ON CONFLICT (bureau)
       DO UPDATE SET api_url = $2, credentials = $3, is_active = true, updated_by = $4, updated_at = NOW()
       RETURNING *`,
      [
        bureau,
        connectionData.apiUrl || BUREAU_CONFIG[bureau]?.baseUrl,
        JSON.stringify({
          clientId: connectionData.clientId,
          // Don't store full secret — use encrypted admin_settings
          clientSecretRef: `bureau_${bureau}_secret`,
          subscriberCode: connectionData.subscriberCode,
          memberNumber: connectionData.memberNumber,
        }),
        updatedBy,
      ]
    );
    return result.rows[0];
  },

  /**
   * Get a change timeline visualization for a client.
   */
  async getChangeTimeline(clientId, months = 12) {
    const result = await query(
      `SELECT 
         DATE_TRUNC('week', created_at) as week,
         bureau,
         COUNT(*) as change_count,
         COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
         COUNT(*) FILTER (WHERE is_positive = true) as positive_changes,
         ARRAY_AGG(DISTINCT change_type) as change_types
       FROM credit_report_changes
       WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${parseInt(months, 10)} months'
       GROUP BY week, bureau
       ORDER BY week DESC`,
      [clientId]
    );
    return result.rows;
  },
};

// Internal helper
function mapToInternalItemType(bureauType) {
  const map = {
    collection: 'collection',
    charge_off: 'charge_off',
    late_payment: 'late_payment',
    bankruptcy: 'bankruptcy',
    foreclosure: 'foreclosure',
    repossession: 'repossession',
    inquiry: 'inquiry',
    public_record: 'other',
    adverse: 'other',
  };
  return map[bureauType] || 'other';
}

module.exports = bureauService;
