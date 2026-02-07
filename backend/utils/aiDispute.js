/**
 * AI-Powered Dispute Letter Generator
 * Uses OpenAI to generate professional, legally-formatted dispute letters
 */

const { generateDisputeLetter: generateLetterWithAI } = require('./openaiService');
const { pool, query } = require('../config/database');

/**
 * Generate a dispute letter using AI
 * Validates client data and generates professional letter with full client information
 */
async function generateDispute(userId, creditItemId, disputeType, bureau, additionalDetails = '') {
  try {
    // Fetch complete client information including profile
    const clientResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              cp.date_of_birth, cp.ssn_last_4, 
              cp.address_line1, cp.address_line2, cp.city, cp.state, cp.zip_code
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (clientResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    const clientData = clientResult.rows[0];
    
    // Validate that we have minimum required client data
    if (!clientData.first_name || !clientData.last_name) {
      throw new Error('Client name is required to generate dispute letter');
    }

    // Fetch credit item information
    const itemResult = await pool.query(
      `SELECT id, creditor_name, account_number, balance, item_type, status, 
              date_opened, date_reported, description, bureau 
       FROM credit_items WHERE id = $1 AND client_id = $2`,
      [creditItemId, userId]
    );

    if (itemResult.rows.length === 0) {
      throw new Error('Credit item not found or does not belong to this client');
    }

    const creditItem = itemResult.rows[0];

    // Validate dispute type
    const validDisputeTypes = ['not_mine', 'paid', 'inaccurate_info', 'outdated', 'duplicate', 'other'];
    if (!validDisputeTypes.includes(disputeType)) {
      throw new Error(`Invalid dispute type: ${disputeType}. Valid types: ${validDisputeTypes.join(', ')}`);
    }

    // Validate bureau
    const validBureaus = ['equifax', 'experian', 'transunion'];
    if (!validBureaus.includes(bureau.toLowerCase())) {
      throw new Error(`Invalid bureau: ${bureau}. Valid bureaus: ${validBureaus.join(', ')}`);
    }

    // Log what data we have for debugging
    console.log(`📝 Generating personalized dispute letter for:
       Client: ${clientData.first_name} ${clientData.last_name}
       Address: ${clientData.address_line1 || 'Not provided'}, ${clientData.city || ''} ${clientData.state || ''}
       Phone: ${clientData.phone || 'Not provided'}
       DOB: ${clientData.date_of_birth || 'Not provided'}
       SSN Last 4: ${clientData.ssn_last_4 ? '****' : 'Not provided'}
       Creditor: ${creditItem.creditor_name}
       Bureau: ${bureau.toUpperCase()}`);

    // Generate letter using OpenAI with full client data
    const letter = await generateLetterWithAI(
      clientData,
      creditItem,
      bureau.toLowerCase(),
      disputeType,
      additionalDetails
    );

    console.log('✅ Personalized dispute letter generated successfully');

    return {
      creditItemId,
      creditItem: {
        id: creditItem.id,
        creditor_name: creditItem.creditor_name,
        account_number: creditItem.account_number,
        balance: creditItem.balance,
        status: creditItem.status,
        item_type: creditItem.item_type
      },
      client: {
        name: `${clientData.first_name} ${clientData.last_name}`,
        hasCompleteProfile: !!(clientData.address_line1 && clientData.city && clientData.state)
      },
      disputeType,
      bureau,
      letter,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating dispute:', error.message);
    throw error;
  }
}

/**
 * Save generated dispute to database
 */
async function saveDispute(userId, creditItemId, content, disputeType, bureau) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const disputeId = uuidv4();
    const now = new Date();

    const result = await pool.query(
      `INSERT INTO disputes (id, user_id, credit_item_id, dispute_type, bureau, content, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, status, created_at`,
      [disputeId, userId, creditItemId, disputeType, bureau, content, 'draft', now, now]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error saving dispute:', error.message);
    throw error;
  }
}

/**
 * Get all disputes for a user
 */
async function getUserDisputes(userId) {
  try {
    const result = await pool.query(
      `SELECT 
        d.id,
        d.user_id,
        d.credit_item_id,
        d.dispute_type,
        d.bureau,
        d.content,
        d.status,
        d.tracking_number,
        d.created_at,
        d.sent_at,
        d.updated_at,
        c.creditor_name,
        c.account_number,
        c.balance,
        c.account_type
       FROM disputes d
       LEFT JOIN credit_items c ON d.credit_item_id = c.id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching disputes:', error.message);
    throw error;
  }
}

/**
 * Get single dispute
 */
async function getDispute(disputeId, userId) {
  try {
    const result = await pool.query(
      `SELECT 
        d.id,
        d.user_id,
        d.credit_item_id,
        d.dispute_type,
        d.bureau,
        d.content,
        d.status,
        d.tracking_number,
        d.created_at,
        d.sent_at,
        d.updated_at,
        c.creditor_name,
        c.account_number,
        c.balance,
        c.account_type
       FROM disputes d
       LEFT JOIN credit_items c ON d.credit_item_id = c.id
       WHERE d.id = $1 AND d.user_id = $2`,
      [disputeId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Dispute not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching dispute:', error.message);
    throw error;
  }
}

/**
 * Mark dispute as sent and generate tracking number
 */
async function sendDispute(disputeId, userId) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const trackingNumber = 'TRK-' + uuidv4().substring(0, 8).toUpperCase();
    const now = new Date();

    const result = await pool.query(
      `UPDATE disputes 
       SET status = 'sent', tracking_number = $1, sent_at = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, status, tracking_number, sent_at`,
      [trackingNumber, now, now, disputeId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Dispute not found or cannot be sent');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error sending dispute:', error.message);
    throw error;
  }
}

/**
 * Delete dispute (only drafts)
 */
async function deleteDispute(disputeId, userId) {
  try {
    const result = await pool.query(
      `DELETE FROM disputes 
       WHERE id = $1 AND user_id = $2 AND status = 'draft'
       RETURNING id`,
      [disputeId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Dispute not found or cannot be deleted (only drafts can be deleted)');
    }

    return { success: true, id: disputeId };
  } catch (error) {
    console.error('Error deleting dispute:', error.message);
    throw error;
  }
}

// Legacy template system (fallback if OpenAI fails)
const generateDisputeLetterTemplate = (client, creditItem, bureau) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const letterTemplates = {
    not_mine: `${currentDate}

${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Dispute of Inaccurate Information - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to formally dispute the accuracy of an item on my credit report. This item has been reported by ${creditItem.creditor_name} and appears on my ${bureau} credit file.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Amount: $${creditItem.balance || 'Unknown'}
- Status: ${creditItem.status}

I am disputing this account because it does not belong to me and I have never had any business relationship with this creditor. This account must be removed from my credit report immediately as it is fraudulent and damaging to my credit score.

Please investigate this matter thoroughly and provide documentation proving that this account is legitimately mine. Without such proof, the account must be deleted from my credit file.

I expect this matter to be resolved within 30 days as required by the Fair Credit Reporting Act (FCRA). Please send me written confirmation once the investigation is complete.

Sincerely,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`,

    paid: `${currentDate}

${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Dispute of Paid Account Status - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to dispute the accuracy of information regarding an account on my ${bureau} credit report. The account is currently reporting as unpaid, when in fact I have paid it in full.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Original Amount: $${creditItem.balance || 'Unknown'}
- Current Status: Reported as ${creditItem.status}

I have paid this account in full and can provide documentation of payment. The continued reporting of this account as unpaid is inaccurate and is harming my credit score.

Please immediately update the status to "PAID IN FULL" and remove any negative notations from my credit report. I am prepared to submit proof of payment if needed.

I expect this matter to be resolved within 30 days. Please provide written confirmation upon completion of your investigation.

Respectfully,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`,

    inaccurate_info: `${currentDate}

${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Dispute of Inaccurate Information - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to formally dispute the inaccuracy of information on my credit report provided by ${creditItem.creditor_name}. The information currently reported is not accurate and requires immediate correction.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Reported Status: ${creditItem.status}
- Balance: $${creditItem.balance || 'Unknown'}

The following information is inaccurate:
[Specify what information is incorrect]

This inaccurate reporting is damaging my credit score and my ability to obtain credit. Under the Fair Credit Reporting Act, you are required to investigate my dispute and correct any inaccurate information within 30 days.

Please conduct a thorough investigation and correct this account immediately upon verification of the inaccuracy.

Thank you for your prompt attention to this matter.

Sincerely,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`,

    outdated: `${currentDate}

${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Dispute of Outdated Account Information - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to dispute information on my credit report that should no longer be reported due to age. This negative account from ${creditItem.creditor_name} is beyond the reporting period and must be removed.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Date Opened: ${creditItem.date_opened || 'Not Provided'}
- Current Status: ${creditItem.status}

Under the Fair Credit Reporting Act, negative information can only be reported for 7 years from the date of first delinquency (with some exceptions). This account exceeds that time period and should be automatically deleted from my credit report.

Please verify the date of first delinquency and remove this obsolete account immediately from my credit file.

I appreciate your prompt resolution of this matter.

Respectfully,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`,

    duplicate: `${currentDate}

${bureau.charAt(0).ToLowerCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Dispute of Duplicate Account Listing - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to formally dispute what appears to be a duplicate listing of an account on my credit report. The same account from ${creditItem.creditor_name} appears multiple times, which is inaccurate.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Balance: $${creditItem.balance || 'Unknown'}

This duplication is clearly erroneous and is significantly damaging my credit score. Please investigate and consolidate these accounts, removing the duplicate listings immediately.

Under the Fair Credit Reporting Act, I have the right to have this inaccuracy corrected. Please respond within 30 days with confirmation that the duplicate accounts have been merged and the extra listings removed.

Thank you for your attention to this matter.

Sincerely,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`,

    other: `${currentDate}

${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Credit Bureau
Dispute Department

RE: Formal Dispute of Credit Report Information - Account Number ${creditItem.account_number || 'XXXX'}

Dear Sir or Madam,

I am writing to formally dispute information on my credit report. This information is inaccurate and must be corrected or removed.

DISPUTED ACCOUNT INFORMATION:
- Account Number: ${creditItem.account_number || 'Not Provided'}
- Creditor: ${creditItem.creditor_name}
- Amount: $${creditItem.balance || 'Unknown'}
- Reported Status: ${creditItem.status}

This account information is inaccurate and does not reflect my actual account history with this creditor. I request that you investigate this matter immediately and either correct or delete this information from my credit report.

As required by the Fair Credit Reporting Act, I expect a response within 30 days of receipt of this dispute letter.

Sincerely,

${client.first_name} ${client.last_name}
Date of Birth: [Your DOB]
Current Address: [Your Address]
Phone Number: [Your Phone]`
  };

  return letterTemplates[creditItem.dispute_type] || letterTemplates.other;
};

module.exports = {
  generateDispute,
  saveDispute,
  getUserDisputes,
  getDispute,
  sendDispute,
  deleteDispute,
  generateDisputeLetterTemplate // Fallback template system
};
