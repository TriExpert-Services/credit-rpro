/**
 * OpenAI Integration Service
 * Generates professional, legally-formatted dispute letters using OpenAI GPT-4
 */

const { OpenAI } = require('openai');

// Initialize OpenAI client with API key from environment
let client = null;

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  WARNING: OPENAI_API_KEY not configured. AI dispute letters will not work. Please set OPENAI_API_KEY environment variable.');
} else {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI service initialized successfully');
}

/**
 * System prompt for generating professional dispute letters
 * Ensures legally compliant, well-formatted output
 */
const DISPUTE_SYSTEM_PROMPT = `You are a professional legal letter writer specializing in Fair Credit Reporting Act (FCRA) dispute letters. Your task is to generate professional, legally-sound dispute letters for credit reporting agencies.

CRITICAL REQUIREMENTS:
1. Format: Professional business letter format with proper spacing and sections
2. Legal Compliance: Reference FCRA (Fair Credit Reporting Act) Section 611, Section 623, and Section 609
3. Personalization: Use ALL client personal data provided - name, address, SSN last 4, DOB, phone
4. Specificity: Include exact account details - creditor name, account number, balance, dates
5. Clarity: Clear, professional tone without emotional language
6. Organization: Logical flow - header, account info, dispute reason, legal references, request, closing

BUREAU ADDRESSES:
Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256

Experian
P.O. Box 4500
Allen, TX 75013

TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016

OUTPUT FORMAT:
The letter must include:
1. Full date at top
2. Client's complete name and address
3. Client's SSN (last 4 digits) and DOB for identification
4. Bureau name and full mailing address
5. RE: line with account details (Creditor, Account #, Bureau)
6. Clear statement of dispute with specific account details
7. Reference to FCRA Sections 611, 623, 609
8. Request for investigation within 30 days
9. Request for deletion or correction
10. Professional closing with signature line

IMPORTANT: Generate ONLY the letter content, no explanations. Use ACTUAL data provided, never placeholders like [FILL IN]. The letter must be ready to print and mail immediately.`;

// Bureau mailing addresses
const BUREAU_ADDRESSES = {
  equifax: `Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256`,
  experian: `Experian
P.O. Box 4500
Allen, TX 75013`,
  transunion: `TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016`
};

/**
 * Generate dispute letter using OpenAI
 * @param {Object} clientData - Client information (name, DOB, address, phone, SSN last 4)
 * @param {Object} creditItem - Credit item details (creditor, account number, balance, status)
 * @param {string} bureau - Credit bureau name (equifax, experian, transunion)
 * @param {string} disputeType - Type of dispute (not_mine, paid, inaccurate_info, outdated, duplicate, other)
 * @param {string} additionalDetails - Optional additional details for dispute
 * @returns {Promise<string>} - Generated dispute letter
 */
async function generateDisputeLetter(clientData, creditItem, bureau, disputeType, additionalDetails = '') {
  try {
    // Validate inputs
    if (!clientData || !creditItem || !bureau) {
      throw new Error('Missing required client, creditItem, or bureau information');
    }

    if (!client || !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Map dispute types to clear descriptions
    const disputeDescriptions = {
      not_mine: 'This account does not belong to me. I have never opened an account with this creditor, never authorized anyone to open an account in my name with this creditor, and have never had any business relationship with this creditor. I believe this may be a result of identity theft or a mixed credit file.',
      paid: 'This account has been paid in full. I have documentation showing this account was satisfied, yet it continues to be reported as delinquent/unpaid. This is inaccurate reporting that is damaging my credit.',
      inaccurate_info: 'The information reported for this account is inaccurate. The account details, balance, payment history, or status do not match my records. Under FCRA Section 623, furnishers are required to report accurate information.',
      outdated: 'This account contains outdated information that should no longer be reported. Under FCRA Section 605, negative information generally must be removed after 7 years (10 years for bankruptcies). This item has exceeded the reporting period.',
      duplicate: 'This is a duplicate entry. The same account is already being reported on my credit report, causing double negative impact on my credit score.',
      other: additionalDetails || 'I am disputing the accuracy of this account for the reasons detailed below.'
    };

    const disputeReason = disputeDescriptions[disputeType] || disputeDescriptions.other;

    // Format bureau name properly
    const bureauFormatted = bureau.charAt(0).toUpperCase() + bureau.slice(1);
    const bureauAddress = BUREAU_ADDRESSES[bureau.toLowerCase()] || BUREAU_ADDRESSES.equifax;

    // Format client address
    const clientAddress = formatClientAddress(clientData);
    
    // Format date
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create detailed prompt for GPT
    const userPrompt = `Generate a professional FCRA dispute letter with these EXACT details (use ALL information provided, no placeholders):

TODAY'S DATE: ${dateStr}

CLIENT INFORMATION (use exactly as shown):
- Full Name: ${clientData.first_name} ${clientData.last_name}
- Address: ${clientAddress}
- Phone: ${clientData.phone || 'Not provided'}
- Email: ${clientData.email || 'Not provided'}
- Date of Birth: ${formatDate(clientData.date_of_birth || clientData.dob)}
- SSN Last 4: ${clientData.ssn_last_4 || clientData.ssn_last_four || 'XXXX'}

CREDIT BUREAU TO ADDRESS:
${bureauFormatted}
${bureauAddress}

ACCOUNT TO DISPUTE:
- Creditor/Furnisher Name: ${creditItem.creditor_name || creditItem.creditorName}
- Account Number: ${creditItem.account_number || creditItem.accountNumber || 'Unknown'}
- Type of Account: ${creditItem.item_type || creditItem.accountType || 'Unknown'}
- Balance Reported: $${creditItem.balance || '0'}
- Account Status: ${creditItem.status || 'Unknown'}
- Date Opened: ${formatDate(creditItem.date_opened || creditItem.dateOpened)}
- Date Reported: ${formatDate(creditItem.date_reported || creditItem.dateReported)}

DISPUTE TYPE: ${disputeType.replace('_', ' ').toUpperCase()}

REASON FOR DISPUTE:
${disputeReason}

${additionalDetails ? `ADDITIONAL DETAILS: ${additionalDetails}` : ''}

Generate the complete letter now. Include:
1. Client's full name and complete address at the top left
2. Date
3. Bureau's complete mailing address
4. RE: line with Creditor Name, Account Number ending in last 4 digits
5. Body with specific dispute reason referencing the exact account
6. FCRA legal citations (Sections 609, 611, 623)
7. Request for investigation within 30 days and removal/correction
8. Request for updated copy of credit report after investigation
9. Professional closing with signature line

The letter should be personalized and specific to THIS client and THIS account.`;

    // Call OpenAI API using chat completions
    const message = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      max_tokens: 2500,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: DISPUTE_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    // Extract the letter from response
    let letter = message.choices[0].message.content;

    // Ensure proper formatting
    letter = formatLetter(letter);

    return letter;
  } catch (error) {
    console.error('Error generating dispute letter with OpenAI:', error);
    throw new Error(`Failed to generate dispute letter: ${error.message}`);
  }
}

/**
 * Format client address for letter
 */
function formatClientAddress(clientData) {
  const parts = [];
  
  if (clientData.address_line1 || clientData.address) {
    parts.push(clientData.address_line1 || clientData.address);
  }
  if (clientData.address_line2) {
    parts.push(clientData.address_line2);
  }
  
  const cityStateZip = [];
  if (clientData.city) cityStateZip.push(clientData.city);
  if (clientData.state) cityStateZip.push(clientData.state);
  if (clientData.zip_code || clientData.zipCode) {
    cityStateZip.push(clientData.zip_code || clientData.zipCode);
  }
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', ').replace(/, ([A-Z]{2})/, ' $1'));
  }
  
  return parts.join('\n') || 'Address not provided';
}

/**
 * Format date for display
 */
function formatDate(date) {
  if (!date) return 'Unknown';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return date;
  }
}

/**
 * Format and clean the generated letter
 * @param {string} letter - Raw letter from OpenAI
 * @returns {string} - Formatted letter
 */
function formatLetter(letter) {
  // Remove extra markdown formatting if present
  letter = letter.replace(/```/g, '');
  letter = letter.replace(/\*\*/g, '');
  
  // Ensure proper spacing
  letter = letter.trim();
  
  // Ensure date format is consistent
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // If letter doesn't start with a date, ensure it does
  if (!letter.match(/^\d{1,2}.*\d{4}/)) {
    letter = `${dateStr}\n\n${letter}`;
  }
  
  return letter;
}

/**
 * Generate multiple dispute letters for different bureaus
 * @param {Object} client - Client information
 * @param {Object} creditItem - Credit item details
 * @param {string[]} bureaus - Array of bureaus (equifax, experian, transunion)
 * @param {string} disputeType - Type of dispute
 * @returns {Promise<Object>} - Object with bureau names as keys and letters as values
 */
async function generateDisputeLettersForBureaus(client, creditItem, bureaus, disputeType) {
  try {
    const letters = {};

    for (const bureau of bureaus) {
      letters[bureau] = await generateDisputeLetter(client, creditItem, bureau, disputeType);
    }

    return letters;
  } catch (error) {
    console.error('Error generating multiple dispute letters:', error);
    throw error;
  }
}

module.exports = {
  generateDisputeLetter,
  generateDisputeLettersForBureaus,
  formatLetter
};
