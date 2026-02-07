/**
 * Plaid Service - Bank Account Verification & Financial Data
 * Integrates with Plaid API for identity verification and bank connections
 */

const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');
const { pool, query } = require('../config/database');

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Create a Link token for frontend integration
 * @param {number} userId - User ID
 * @param {string} clientName - Name shown in Plaid Link
 * @param {Array} products - Plaid products to use
 */
async function createLinkToken(userId, clientName = 'TriExpert Credit Repair', products = ['auth', 'identity']) {
  try {
    const request = {
      user: {
        client_user_id: userId.toString(),
      },
      client_name: clientName,
      products: products,
      country_codes: [CountryCode.Us],
      language: 'es', // Spanish
      webhook: `${process.env.FRONTEND_URL}/api/plaid/webhook`,
    };

    const response = await plaidClient.linkTokenCreate(request);
    
    // Log the token creation
    await query(
      `INSERT INTO plaid_logs (user_id, action, request_id, status)
       VALUES ($1, 'link_token_create', $2, 'success')`,
      [userId, response.data.request_id]
    );

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    
    await query(
      `INSERT INTO plaid_logs (user_id, action, status, error_message)
       VALUES ($1, 'link_token_create', 'error', $2)`,
      [userId, error.message]
    );
    
    throw error;
  }
}

/**
 * Exchange public token for access token
 * @param {string} publicToken - Public token from Plaid Link
 * @param {number} userId - User ID
 */
async function exchangePublicToken(publicToken, userId) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store access token securely (encrypted in production)
    await query(
      `INSERT INTO plaid_items (user_id, item_id, access_token, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (item_id) DO UPDATE SET
         access_token = $3,
         status = 'active',
         updated_at = CURRENT_TIMESTAMP`,
      [userId, itemId, accessToken]
    );

    await query(
      `INSERT INTO plaid_logs (user_id, action, item_id, status)
       VALUES ($1, 'token_exchange', $2, 'success')`,
      [userId, itemId]
    );

    return { itemId, accessToken };
  } catch (error) {
    console.error('Error exchanging public token:', error);
    
    await query(
      `INSERT INTO plaid_logs (user_id, action, status, error_message)
       VALUES ($1, 'token_exchange', 'error', $2)`,
      [userId, error.message]
    );
    
    throw error;
  }
}

/**
 * Get identity information for verification
 * @param {string} accessToken - Plaid access token
 * @param {number} userId - User ID
 */
async function getIdentity(accessToken, userId) {
  try {
    const response = await plaidClient.identityGet({
      access_token: accessToken,
    });

    const accounts = response.data.accounts;
    const identity = accounts[0]?.owners?.[0] || null;

    if (identity) {
      // Store identity verification data
      await query(
        `INSERT INTO plaid_identity_verifications (
          user_id, 
          verified_name, 
          verified_email,
          verified_phone,
          verified_address,
          verification_status,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, 'verified', $6)
        ON CONFLICT (user_id) DO UPDATE SET
          verified_name = $2,
          verified_email = $3,
          verified_phone = $4,
          verified_address = $5,
          verification_status = 'verified',
          raw_data = $6,
          verified_at = CURRENT_TIMESTAMP`,
        [
          userId,
          identity.names?.[0] || null,
          identity.emails?.[0]?.data || null,
          identity.phone_numbers?.[0]?.data || null,
          JSON.stringify(identity.addresses?.[0] || {}),
          JSON.stringify(identity),
        ]
      );

      // Update client profile with verification
      await query(
        `UPDATE client_profiles SET
          identity_verified = true,
          identity_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );
    }

    await query(
      `INSERT INTO plaid_logs (user_id, action, status)
       VALUES ($1, 'identity_get', 'success')`,
      [userId]
    );

    return {
      identity,
      accounts: accounts.map(acc => ({
        id: acc.account_id,
        name: acc.name,
        officialName: acc.official_name,
        type: acc.type,
        subtype: acc.subtype,
        mask: acc.mask,
      })),
    };
  } catch (error) {
    console.error('Error getting identity:', error);
    
    await query(
      `INSERT INTO plaid_logs (user_id, action, status, error_message)
       VALUES ($1, 'identity_get', 'error', $2)`,
      [userId, error.message]
    );
    
    throw error;
  }
}

/**
 * Get bank accounts for ACH payments
 * @param {string} accessToken - Plaid access token
 * @param {number} userId - User ID
 */
async function getAccounts(accessToken, userId) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = response.data.accounts;

    // Store accounts
    for (const account of accounts) {
      await query(
        `INSERT INTO plaid_accounts (
          user_id, account_id, item_id, name, official_name,
          type, subtype, mask, current_balance, available_balance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (account_id) DO UPDATE SET
          name = $4,
          official_name = $5,
          current_balance = $9,
          available_balance = $10,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          account.account_id,
          response.data.item.item_id,
          account.name,
          account.official_name,
          account.type,
          account.subtype,
          account.mask,
          account.balances?.current,
          account.balances?.available,
        ]
      );
    }

    return accounts.map(acc => ({
      id: acc.account_id,
      name: acc.name,
      officialName: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask,
      balance: {
        current: acc.balances?.current,
        available: acc.balances?.available,
      },
    }));
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error;
  }
}

/**
 * Get Auth data for ACH transfers
 * @param {string} accessToken - Plaid access token
 * @param {number} userId - User ID
 */
async function getAuth(accessToken, userId) {
  try {
    const response = await plaidClient.authGet({
      access_token: accessToken,
    });

    const accounts = response.data.accounts;
    const numbers = response.data.numbers;

    // Store ACH numbers securely
    for (const ach of numbers.ach || []) {
      await query(
        `UPDATE plaid_accounts SET
          ach_account_number = $1,
          ach_routing_number = $2,
          ach_wire_routing = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $4`,
        [
          ach.account,
          ach.routing,
          ach.wire_routing,
          ach.account_id,
        ]
      );
    }

    await query(
      `INSERT INTO plaid_logs (user_id, action, status)
       VALUES ($1, 'auth_get', 'success')`,
      [userId]
    );

    return {
      accounts: accounts.map(acc => ({
        id: acc.account_id,
        name: acc.name,
        mask: acc.mask,
        type: acc.type,
      })),
      numbers: {
        ach: numbers.ach?.map(n => ({
          accountId: n.account_id,
          account: n.account ? `****${n.account.slice(-4)}` : null, // Masked
          routing: n.routing,
        })),
      },
    };
  } catch (error) {
    console.error('Error getting auth:', error);
    
    await query(
      `INSERT INTO plaid_logs (user_id, action, status, error_message)
       VALUES ($1, 'auth_get', 'error', $2)`,
      [userId, error.message]
    );
    
    throw error;
  }
}

/**
 * Get transactions for income verification
 * @param {string} accessToken - Plaid access token
 * @param {number} userId - User ID
 * @param {number} days - Number of days to fetch
 */
async function getTransactions(accessToken, userId, days = 30) {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let transactions = [];
    
    try {
      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: 500,
          offset: 0,
        },
      });
      transactions = response.data.transactions || [];
    } catch (plaidError) {
      // Handle specific Plaid errors
      const errorCode = plaidError.response?.data?.error_code;
      
      if (errorCode === 'PRODUCT_NOT_READY') {
        // Transactions not yet available (common in sandbox)
        console.log('Transactions not ready yet, returning empty analysis');
        return {
          totalTransactions: 0,
          incomeTransactions: 0,
          totalIncome: 0,
          estimatedMonthlyIncome: 0,
          recentTransactions: [],
          message: 'Las transacciones aún no están disponibles. Por favor, intenta de nuevo en unos minutos.',
        };
      }
      
      if (errorCode === 'NO_PRODUCT_DATA' || errorCode === 'ITEM_NOT_SUPPORTED') {
        // Product not enabled for this item
        return {
          totalTransactions: 0,
          incomeTransactions: 0,
          totalIncome: 0,
          estimatedMonthlyIncome: 0,
          recentTransactions: [],
          message: 'El análisis de transacciones no está disponible para esta cuenta.',
        };
      }
      
      throw plaidError;
    }

    // Analyze for income patterns
    const incomeTransactions = transactions.filter(
      t => t.amount < 0 && (
        t.category?.includes('Payroll') ||
        t.category?.includes('Transfer') ||
        t.name?.toLowerCase().includes('payroll') ||
        t.name?.toLowerCase().includes('direct dep')
      )
    );

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const monthlyIncome = (totalIncome / days) * 30;

    // Store income analysis
    try {
      await query(
        `INSERT INTO plaid_income_analysis (
          user_id, analysis_date, period_days, 
          total_deposits, estimated_monthly_income,
          transaction_count
        ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
        [userId, days, totalIncome, monthlyIncome, incomeTransactions.length]
      );
    } catch (dbError) {
      console.log('Could not store income analysis:', dbError.message);
    }

    return {
      totalTransactions: transactions.length,
      incomeTransactions: incomeTransactions.length,
      totalIncome,
      estimatedMonthlyIncome: monthlyIncome,
      recentTransactions: transactions.slice(0, 20).map(t => ({
        date: t.date,
        name: t.name,
        amount: t.amount,
        category: t.category,
      })),
    };
  } catch (error) {
    console.error('Error getting transactions:', error.response?.data || error);
    throw error;
  }
}

/**
 * Get user's linked bank accounts
 * @param {number} userId - User ID
 */
async function getUserAccounts(userId) {
  const result = await query(
    `SELECT 
      pa.account_id, pa.name, pa.official_name, pa.type, pa.subtype,
      pa.mask, pa.current_balance, pa.available_balance,
      pi.status as item_status, pi.institution_name
     FROM plaid_accounts pa
     JOIN plaid_items pi ON pa.item_id = pi.item_id
     WHERE pa.user_id = $1 AND pi.status = 'active'
     ORDER BY pa.created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get user's identity verification status
 * @param {number} userId - User ID
 */
async function getVerificationStatus(userId) {
  const result = await query(
    `SELECT 
      verification_status, verified_name, verified_at,
      verified_email, verified_phone
     FROM plaid_identity_verifications
     WHERE user_id = $1
     ORDER BY verified_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Remove a linked item
 * @param {string} itemId - Plaid item ID
 * @param {number} userId - User ID
 */
async function removeItem(itemId, userId) {
  try {
    // Get access token
    const result = await query(
      'SELECT access_token FROM plaid_items WHERE item_id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Item not found');
    }

    // Remove from Plaid
    await plaidClient.itemRemove({
      access_token: result.rows[0].access_token,
    });

    // Update status in database
    await query(
      `UPDATE plaid_items SET status = 'removed', updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $1`,
      [itemId]
    );

    await query(
      `INSERT INTO plaid_logs (user_id, action, item_id, status)
       VALUES ($1, 'item_remove', $2, 'success')`,
      [userId, itemId]
    );

    return true;
  } catch (error) {
    console.error('Error removing item:', error);
    throw error;
  }
}

/**
 * Handle Plaid webhooks
 * @param {Object} webhookBody - Webhook payload
 */
async function handleWebhook(webhookBody) {
  const { webhook_type, webhook_code, item_id } = webhookBody;

  console.log('Plaid webhook received:', webhook_type, webhook_code);

  // Get user from item
  const itemResult = await query(
    'SELECT user_id FROM plaid_items WHERE item_id = $1',
    [item_id]
  );

  const userId = itemResult.rows[0]?.user_id;

  // Log webhook
  await query(
    `INSERT INTO plaid_logs (user_id, action, item_id, status, raw_data)
     VALUES ($1, $2, $3, 'received', $4)`,
    [userId, `webhook_${webhook_type}_${webhook_code}`, item_id, JSON.stringify(webhookBody)]
  );

  switch (webhook_type) {
    case 'ITEM':
      if (webhook_code === 'ERROR') {
        await query(
          `UPDATE plaid_items SET status = 'error', updated_at = CURRENT_TIMESTAMP
           WHERE item_id = $1`,
          [item_id]
        );
      }
      break;

    case 'TRANSACTIONS':
      // Could trigger transaction sync
      break;

    case 'AUTH':
      // Auth data updated
      break;

    default:
      console.log('Unhandled webhook type:', webhook_type);
  }

  return true;
}

module.exports = {
  plaidClient,
  createLinkToken,
  exchangePublicToken,
  getIdentity,
  getAccounts,
  getAuth,
  getTransactions,
  getUserAccounts,
  getVerificationStatus,
  removeItem,
  handleWebhook,
};
