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
 * Ensures legally compliant, well-formatted output with advanced strategies
 */
const DISPUTE_SYSTEM_PROMPT = `You are an expert credit repair attorney and legal letter writer specializing in consumer credit law. You generate the most effective dispute letters in the industry, leveraging deep knowledge of the FCRA, FDCPA, CROA, and bureau-specific procedures.

LEGAL FRAMEWORK YOU MUST REFERENCE (use the most relevant sections for each dispute):

FAIR CREDIT REPORTING ACT (FCRA) - 15 U.S.C. §1681:
- §611(a): Consumer's right to dispute inaccurate information; CRA must investigate within 30 days
- §611(a)(5)(A): CRA must provide all relevant evidence to furnisher during investigation
- §611(a)(6)(B)(iii): If information cannot be verified, it must be DELETED
- §611(a)(7): 5-day reinsertion notice requirement with written notification to consumer
- §623(a)(1)(A): Furnisher duty to report ONLY accurate information
- §623(a)(2): Furnisher duty to correct/update information reported as incomplete or inaccurate
- §623(a)(8)(E): Furnisher must conduct reasonable investigation upon notice of dispute
- §623(b): Furnisher investigation duties upon notice from CRA
- §609(a)(1): Consumer's right to disclosure of all information in their file
- §605(a): 7-year reporting limitation for most negative items (10 years for Chapter 7 bankruptcy)
- §605(c): Running of reporting period from date of first delinquency
- §616: Civil liability for willful noncompliance ($100-$1,000 per violation + punitive damages)
- §617: Civil liability for negligent noncompliance (actual damages + attorney fees)

FAIR DEBT COLLECTION PRACTICES ACT (FDCPA) - 15 U.S.C. §1692:
- §1692g: Debt validation rights; collector must cease collection until debt is verified
- §1692e: Prohibition against false or misleading representations
- §1692f: Prohibition against unfair practices

CREDIT REPAIR ORGANIZATIONS ACT (CROA):
- Consumer's right to dispute inaccurate information at any time

BUREAU-SPECIFIC PROCEDURES (apply when relevant):
- Equifax: Uses Automated Consumer Dispute Verification (ACDV) e-OSCAR system; known for incomplete investigations. Challenge their reliance on automated processes.
- Experian: Uses e-OSCAR and Metro 2 format reporting. Frequently fails to forward all relevant documentation to furnishers. Demand they forward YOUR complete dispute with documentation.
- TransUnion: Uses e-OSCAR system. Often verifies without meaningful investigation. Request their specific Method of Verification (MOV).

METHOD OF VERIFICATION (MOV) - CRITICAL:
Always request the CRA disclose the METHOD used to verify the disputed information, including:
- The name, address, and phone number of the person contacted at the furnisher
- The specific documents or records reviewed
- The date the verification was performed

DISPUTE STRATEGY BY TYPE:
1. NOT MINE / IDENTITY THEFT: Demand proof of signed application/agreement. Reference FTC Identity Theft Report. Request immediate block under §605B.
2. ALREADY PAID: Demand updated reporting under §623(a)(2). Request proof of outstanding balance. If sold to collector, challenge chain of title.
3. INACCURATE INFO: Challenge EVERY inaccurate data point (balance, dates, payment history, account status). Each inaccuracy = separate violation.
4. OUTDATED: Calculate exact date of first delinquency. Reference §605(a) 7-year limit. Re-aged accounts are ILLEGAL under §623(a)(1)(A).
5. DUPLICATE: Demand consolidation. Multiple reporting of same debt inflates utilization artificially and violates accuracy requirements.
6. OTHER: Tailor to specific circumstances using the strongest applicable legal arguments.

MULTI-ROUND STRATEGY:
- Round 1 (Initial): Formal dispute requesting investigation and MOV
- Round 2 (Follow-up): If verified without adequate investigation, challenge the verification method. Cite procedural violations.
- Round 3 (Escalation): Intent to file complaint with CFPB and state AG. Reference §616/§617 civil liability.
- Round 4 (Regulatory): File with CFPB, state AG, and demand final response before litigation.

CRITICAL REQUIREMENTS:
1. Format: Professional business letter with proper spacing and sections
2. Legal Authority: Use the most relevant FCRA/FDCPA sections for this specific dispute type
3. Personalization: Use ALL client personal data provided - name, address, SSN last 4, DOB, phone
4. Specificity: Include exact account details - creditor name, account number, balance, dates
5. Assertive Tone: Professional but FIRM. The consumer KNOWS their rights.
6. MOV Request: ALWAYS request the method of verification
7. Deadline: Explicitly state the 30-day investigation deadline under FCRA §611(a)
8. Consequences: Mention potential CFPB complaint and civil liability for noncompliance

OUTPUT FORMAT:
The letter must include:
1. Client's complete name and address at the top left
2. Full date
3. Bureau name and full mailing address
4. RE: line with Creditor Name, Account # (last 4 digits), and dispute type
5. Opening paragraph asserting consumer's rights
6. Account details section with all disputed information
7. Specific dispute argument with legal citations
8. Request for investigation, deletion/correction, and MOV
9. Statement of consequences for noncompliance
10. Request for updated copy of credit report
11. Professional closing with signature line
12. Enclosures line if applicable (copy of ID, proof of address, etc.)

IMPORTANT: Generate ONLY the letter content, no explanations or commentary. Use ACTUAL data provided, never placeholders like [FILL IN]. The letter must be ready to print and mail immediately.`;

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

    // Map dispute types to comprehensive legal arguments
    const disputeDescriptions = {
      not_mine: `This account does not belong to me. I have never opened, authorized, or benefited from any account with this creditor. I have never entered into any agreement, contract, or business relationship with this entity. This account may be the result of identity theft, a mixed credit file, or data furnisher error.

Under FCRA §611(a)(6)(B)(iii), if you cannot verify this account with competent evidence — specifically a signed application or agreement bearing MY signature — this account MUST be immediately deleted from my credit file. I am also requesting that you provide evidence of any signed contract or application that bears my personal signature, per FCRA §609(a)(1).

Furthermore, if this is a collection account, the collector must provide debt validation under FDCPA §1692g, including the original creditor name, the amount of the alleged debt, and proof that they are authorized to collect.`,

      paid: `This account has been paid in full / settled as agreed, yet it continues to be reported inaccurately on my credit file. The current reporting does not reflect the account's true status, which constitutes a violation of FCRA §623(a)(1)(A) — the duty to report ONLY accurate information.

Under FCRA §623(a)(2), the furnisher has a duty to promptly update and correct information that is incomplete or inaccurate. I demand that the account status be updated to reflect "Paid in Full" or "Settled" with a $0 balance, and that any associated late payment notations be reviewed for accuracy.

If this account was sold to a collection agency, I challenge the chain of title and request documentation of each assignment of this debt from original creditor to current reporter.`,

      inaccurate_info: `The information currently being reported for this account contains material inaccuracies that are damaging my credit standing. The reported account details — including but not limited to the balance, payment history, account status, dates, and/or account type — do not match my records and are demonstrably incorrect.

Under FCRA §623(a)(1)(A), furnishers have a legal duty to report ONLY accurate information. Each individual data point that is inaccurate constitutes a separate violation. Under §623(a)(8)(E), the furnisher must conduct a reasonable investigation upon notice of dispute — not merely rubber-stamp the existing data.

I demand that every field of this account be individually verified against the furnisher's original records, not merely auto-verified through the e-OSCAR ACDV system.`,

      outdated: `This account contains negative information that has exceeded the maximum reporting period permitted under federal law. Under FCRA §605(a), most negative information must be removed after 7 years from the date of first delinquency as defined in §605(c). Chapter 7 bankruptcies may be reported for 10 years.

I have calculated that this account's date of first delinquency places it beyond the permissible reporting window. Continued reporting of this obsolete information violates the FCRA, and any attempt to re-age this account by altering the date of first delinquency constitutes a separate violation under §623(a)(1)(A).

I demand immediate deletion of this obsolete item from my credit file.`,

      duplicate: `This account is being reported as a duplicate entry on my credit file. The same underlying debt/account is appearing multiple times, which artificially inflates my outstanding obligations and severely damages my credit utilization ratio and overall credit score.

Duplicate reporting violates the accuracy requirements of FCRA §623(a)(1)(A). Each duplicate listing constitutes a separate inaccuracy that must be corrected. This is particularly common when an original creditor continues to report alongside a collection agency for the same debt, or when accounts are reported with slight variations in account numbers.

I demand that you investigate and consolidate these entries, removing all duplicate listings immediately.`,

      other: additionalDetails || `I am formally disputing the accuracy and completeness of this account as reported on my credit file. The information does not accurately reflect my financial history with this creditor and I believe it contains material errors that are damaging my credit standing.

Under FCRA §611(a), I have the right to dispute any information I believe to be inaccurate, and you are required to conduct a reasonable investigation within 30 days. If you cannot verify the complete accuracy of every data field in this tradeline, it must be deleted under §611(a)(6)(B)(iii).`
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

    // Create detailed prompt for GPT with strategy context
    const userPrompt = `Generate a professional, legally-powerful FCRA dispute letter with these EXACT details (use ALL information provided, no placeholders):

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

DISPUTE STRATEGY ROUND: ${additionalDetails?.round || 'Round 1 - Initial Dispute'}

REASON FOR DISPUTE:
${disputeReason}

${additionalDetails?.details || additionalDetails || ''}

BUREAU-SPECIFIC INSTRUCTIONS FOR ${bureauFormatted.toUpperCase()}:
${bureau.toLowerCase() === 'equifax' ? '- Challenge their reliance on automated ACDV verification. Demand human review of original documentation.' : ''}
${bureau.toLowerCase() === 'experian' ? '- Demand they forward your COMPLETE dispute documentation to the furnisher, not just a summary code.' : ''}
${bureau.toLowerCase() === 'transunion' ? '- Request specific Method of Verification including the name and contact of the person who verified the information.' : ''}

Generate the complete letter now. Include:
1. Client's full name and complete address at the top left
2. Date
3. Bureau's complete mailing address
4. RE: Formal Dispute - [Creditor Name] - Account ending in [last 4 digits]
5. Opening paragraph establishing the consumer's rights under FCRA
6. Detailed account information section
7. Specific dispute argument with at least 3 relevant legal citations (FCRA sections with subsections)
8. Request for investigation within 30 days under §611(a)
9. Request for Method of Verification (MOV)
10. Request for deletion/correction under §611(a)(6)(B)(iii)
11. Statement of consequences: CFPB complaint, state AG complaint, and civil liability under §616/§617
12. Request for updated copy of credit report after investigation
13. Professional closing with signature line
14. Enclosures line (Copy of government-issued ID, Proof of address)

The letter must be assertive, specific, and demonstrate thorough knowledge of consumer credit law. This is ${additionalDetails?.round || 'Round 1'} of the dispute process.`;

    // Call OpenAI API using chat completions
    const message = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      max_tokens: 3500,
      temperature: 0.3,
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
