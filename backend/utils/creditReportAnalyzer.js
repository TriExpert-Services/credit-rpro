/**
 * Credit Report Analyzer Service
 * Uses OpenAI to extract disputable items and credit scores from uploaded credit reports
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

// Initialize OpenAI client
let client = null;

const initializeClient = () => {
  if (!client && process.env.OPENAI_API_KEY) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
};

/**
 * System prompt for analyzing credit reports
 */
const ANALYSIS_SYSTEM_PROMPT = `You are an expert credit report analyst specializing in identifying negative items that can be disputed under the Fair Credit Reporting Act (FCRA).

Your task is to analyze credit report text and extract:
1. Personal information of the consumer (name, address, SSN last 4, DOB, phone, employers)
2. Credit scores for each bureau
3. All negative/derogatory items that could be disputed
4. Account details including balances, dates, and status

OUTPUT FORMAT (JSON only, no additional text):
{
  "bureau": "experian|equifax|transunion",
  "reportDate": "2026-02-01",
  "personalInfo": {
    "fullName": "JOHN MICHAEL DOE",
    "currentAddress": {
      "street": "123 Main Street Apt 4B",
      "city": "Miami",
      "state": "FL",
      "zipCode": "33101"
    },
    "previousAddresses": [
      {
        "street": "456 Oak Avenue",
        "city": "Orlando",
        "state": "FL",
        "zipCode": "32801"
      }
    ],
    "phone": "305-555-1234",
    "dateOfBirth": "1985-03-15",
    "ssnLastFour": "1234",
    "employers": ["ABC Company", "XYZ Corp"]
  },
  "creditScore": 650,
  "negativeItems": [
    {
      "creditorName": "CAPITAL ONE",
      "accountNumber": "****1234",
      "accountType": "credit_card|auto_loan|mortgage|collection|student_loan|personal_loan|medical|other",
      "itemType": "late_payment|collection|charge_off|bankruptcy|foreclosure|repossession|inquiry|other",
      "balance": 1500.00,
      "originalBalance": 2000.00,
      "creditLimit": 5000.00,
      "dateOpened": "2022-01-15",
      "dateReported": "2025-12-01",
      "lastPaymentDate": "2025-06-15",
      "status": "collection|charge_off|late_30|late_60|late_90|late_120|closed|open",
      "paymentHistory": "30 days late x3, 60 days late x1",
      "remarks": "Account sold to collection agency",
      "disputeReason": "inaccurate_info|not_mine|paid|outdated|duplicate|other",
      "suggestedDispute": "Account shows incorrect balance. Original debt was paid in settlement.",
      "severity": "high|medium|low",
      "canDispute": true
    }
  ],
  "positiveAccounts": [
    {
      "creditorName": "CHASE BANK",
      "accountType": "credit_card",
      "status": "current",
      "creditLimit": 10000,
      "balance": 2500
    }
  ],
  "inquiries": [
    {
      "creditorName": "DISCOVER",
      "inquiryDate": "2025-11-01",
      "type": "hard"
    }
  ],
  "summary": {
    "totalAccounts": 15,
    "negativeAccounts": 3,
    "positiveAccounts": 12,
    "collectionsCount": 1,
    "latePaymentsCount": 2,
    "inquiriesCount": 5,
    "oldestAccount": "2015-03-01",
    "averageAccountAge": "5 years 3 months",
    "totalDebt": 25000,
    "availableCredit": 15000,
    "creditUtilization": "45%"
  }
}

IMPORTANT RULES:
1. Extract ALL personal information visible in the report (name variations, addresses, phone numbers)
2. Only include items that can realistically be disputed (negative marks, errors, outdated info)
3. Assign appropriate itemType based on the nature of the negative item
4. Suggest the best disputeReason for each item
5. Set severity: high = collections/charge-offs/bankruptcies, medium = late payments, low = inquiries
6. Account numbers should be masked (show last 4 digits only)
7. Extract exact dates when possible
8. Return ONLY valid JSON, no explanations`;

/**
 * Extract text content from uploaded file
 * For now, handles text-based files. PDF parsing would require additional library.
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  if (ext === '.pdf') {
    // For PDF files, we'll need to use a library like pdf-parse
    // For now, return a placeholder - in production, implement PDF parsing
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.warn('PDF parsing not available, returning file info');
      return `PDF file uploaded: ${path.basename(filePath)}`;
    }
  }
  
  // For other file types, return the filename
  return `File uploaded: ${path.basename(filePath)}. Manual review required.`;
}

/**
 * Analyze credit report using OpenAI
 * @param {string} reportText - The text content of the credit report
 * @param {string} bureau - Which bureau the report is from (optional, AI will detect)
 * @returns {Object} Analyzed report data
 */
async function analyzeReport(reportText, bureau = null) {
  const openai = initializeClient();
  
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const userPrompt = `Analyze this credit report and extract all negative/disputable items and credit scores.

${bureau ? `This report is from: ${bureau}` : 'Detect which bureau this report is from.'}

CREDIT REPORT CONTENT:
${reportText.substring(0, 15000)} // Limit to 15k chars for token management

Extract all negative items, credit scores, and provide analysis in JSON format.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices[0].message.content;
  
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse AI response:', responseText);
    throw new Error('AI returned invalid JSON response');
  }
}

/**
 * Process uploaded credit report - main entry point
 * @param {string} clientId - The client's UUID
 * @param {string} filePath - Path to the uploaded file
 * @param {string} bureau - Bureau name (experian, equifax, transunion)
 * @param {string} documentId - The document record ID
 */
async function processUploadedReport(clientId, filePath, bureau, documentId) {
  try {
    console.log(`📊 Processing credit report for client ${clientId}, bureau: ${bureau}`);
    
    // Extract text from file
    const reportText = await extractTextFromFile(filePath);
    
    if (!reportText || reportText.length < 100) {
      return {
        success: false,
        error: 'Could not extract sufficient text from report',
        manualReviewRequired: true
      };
    }

    // Get client's registered information for validation
    const clientResult = await query(
      `SELECT u.first_name, u.last_name, u.email, u.phone,
              cp.address_line1, cp.address_line2, cp.city, cp.state, cp.zip_code,
              cp.date_of_birth, cp.ssn_last_4
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [clientId]
    );
    
    const registeredClient = clientResult.rows[0] || {};

    // Analyze with AI
    const analysis = await analyzeReport(reportText, bureau);
    
    // Validate and compare names
    let nameValidation = null;
    if (analysis.personalInfo && analysis.personalInfo.fullName) {
      nameValidation = validateClientName(
        registeredClient.first_name,
        registeredClient.last_name,
        analysis.personalInfo.fullName
      );
    }
    
    // Save/update extracted personal info to client profile
    if (analysis.personalInfo) {
      await updateClientProfileFromReport(clientId, analysis.personalInfo, registeredClient);
    }
    
    // Save credit score if found
    if (analysis.creditScore) {
      await saveCreditScore(clientId, analysis.bureau || bureau, analysis.creditScore, analysis.reportDate);
    }

    // Save negative items to database
    const savedItems = [];
    if (analysis.negativeItems && analysis.negativeItems.length > 0) {
      for (const item of analysis.negativeItems) {
        const savedItem = await saveCreditItem(clientId, analysis.bureau || bureau, item);
        savedItems.push(savedItem);
      }
    }

    // Update document with analysis results
    await query(
      `UPDATE documents 
       SET file_type = $1, 
           document_category = 'credit_report'
       WHERE id = $2`,
      [`analyzed_${bureau}`, documentId]
    );

    // Log the analysis in activity log
    await query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, 'credit_report_analyzed', 'document', $2, $3)`,
      [clientId, documentId, `AI analyzed ${bureau} report: ${savedItems.length} disputable items found, score: ${analysis.creditScore || 'N/A'}`]
    );

    return {
      success: true,
      bureau: analysis.bureau || bureau,
      creditScore: analysis.creditScore,
      itemsFound: savedItems.length,
      items: savedItems,
      summary: analysis.summary,
      personalInfo: analysis.personalInfo,
      nameValidation,
      documentId
    };

  } catch (error) {
    console.error('Error processing credit report:', error);
    return {
      success: false,
      error: error.message,
      manualReviewRequired: true
    };
  }
}

/**
 * Validate that the name in the credit report matches the registered client
 * @param {string} registeredFirstName - Client's registered first name
 * @param {string} registeredLastName - Client's registered last name
 * @param {string} reportFullName - Full name extracted from credit report
 * @returns {Object} Validation result
 */
function validateClientName(registeredFirstName, registeredLastName, reportFullName) {
  if (!registeredFirstName || !registeredLastName || !reportFullName) {
    return {
      isValid: false,
      reason: 'Missing name information for comparison',
      registeredName: `${registeredFirstName || ''} ${registeredLastName || ''}`.trim(),
      reportName: reportFullName || ''
    };
  }

  const registeredFull = `${registeredFirstName} ${registeredLastName}`.toUpperCase().trim();
  const reportUpper = reportFullName.toUpperCase().trim();
  
  // Check for exact match
  if (reportUpper.includes(registeredFull) || registeredFull.includes(reportUpper)) {
    return {
      isValid: true,
      matchType: 'exact',
      registeredName: registeredFull,
      reportName: reportFullName
    };
  }
  
  // Check if first and last names appear anywhere in the report name
  const firstNameMatch = reportUpper.includes(registeredFirstName.toUpperCase());
  const lastNameMatch = reportUpper.includes(registeredLastName.toUpperCase());
  
  if (firstNameMatch && lastNameMatch) {
    return {
      isValid: true,
      matchType: 'partial',
      registeredName: registeredFull,
      reportName: reportFullName,
      note: 'Names match but may be in different order or include middle name'
    };
  }
  
  // Name mismatch - requires admin review
  return {
    isValid: false,
    matchType: 'mismatch',
    reason: 'Name in credit report does not match registered client name',
    registeredName: registeredFull,
    reportName: reportFullName,
    requiresAdminReview: true
  };
}

/**
 * Update client profile with extracted information from credit report
 * Only updates fields that are empty in the current profile
 */
async function updateClientProfileFromReport(clientId, personalInfo, existingProfile) {
  try {
    // Check if profile exists
    const profileCheck = await query(
      `SELECT id FROM client_profiles WHERE user_id = $1`,
      [clientId]
    );
    
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    // Only update empty fields
    if (!existingProfile.address_line1 && personalInfo.currentAddress?.street) {
      paramCount++;
      updates.push(`address_line1 = $${paramCount}`);
      values.push(personalInfo.currentAddress.street);
    }
    
    if (!existingProfile.city && personalInfo.currentAddress?.city) {
      paramCount++;
      updates.push(`city = $${paramCount}`);
      values.push(personalInfo.currentAddress.city);
    }
    
    if (!existingProfile.state && personalInfo.currentAddress?.state) {
      paramCount++;
      updates.push(`state = $${paramCount}`);
      values.push(personalInfo.currentAddress.state);
    }
    
    if (!existingProfile.zip_code && personalInfo.currentAddress?.zipCode) {
      paramCount++;
      updates.push(`zip_code = $${paramCount}`);
      values.push(personalInfo.currentAddress.zipCode);
    }
    
    if (!existingProfile.date_of_birth && personalInfo.dateOfBirth) {
      paramCount++;
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(personalInfo.dateOfBirth);
    }
    
    if (!existingProfile.ssn_last_4 && personalInfo.ssnLastFour) {
      paramCount++;
      updates.push(`ssn_last_4 = $${paramCount}`);
      values.push(personalInfo.ssnLastFour);
    }

    // Update phone in users table if not set
    if (!existingProfile.phone && personalInfo.phone) {
      await query(
        `UPDATE users SET phone = $1 WHERE id = $2`,
        [personalInfo.phone, clientId]
      );
    }
    
    if (updates.length > 0) {
      paramCount++;
      values.push(clientId);
      
      if (profileCheck.rows.length === 0) {
        // Create new profile
        await query(
          `INSERT INTO client_profiles (user_id, ${updates.map(u => u.split(' = ')[0]).join(', ')})
           VALUES ($${paramCount}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')})`,
          values
        );
      } else {
        // Update existing profile
        await query(
          `UPDATE client_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${paramCount}`,
          values
        );
      }
      
      console.log(`✅ Updated client profile with ${updates.length} fields from credit report`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating client profile:', error);
    return false;
  }
}

/**
 * Save credit score to database
 */
async function saveCreditScore(clientId, bureau, score, reportDate) {
  try {
    // Insert into credit_scores table
    const result = await query(
      `INSERT INTO credit_scores (client_id, bureau, score, score_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, bureau.toLowerCase(), score, reportDate || new Date(), 'Extracted from uploaded credit report by AI']
    );

    // Also log to credit_score_audit for tracking
    await query(
      `INSERT INTO credit_score_audit (client_id, bureau, new_score, data_source)
       VALUES ($1, $2, $3, 'ai_extraction')`,
      [clientId, bureau.toLowerCase(), score]
    );

    console.log(`✅ Saved credit score: ${bureau} = ${score}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving credit score:', error);
    throw error;
  }
}

/**
 * Save credit item to database
 */
async function saveCreditItem(clientId, bureau, item) {
  try {
    // Map item type
    const validItemTypes = ['late_payment', 'collection', 'charge_off', 'bankruptcy', 'foreclosure', 'repossession', 'inquiry', 'other'];
    const itemType = validItemTypes.includes(item.itemType) ? item.itemType : 'other';

    const result = await query(
      `INSERT INTO credit_items 
       (client_id, item_type, creditor_name, account_number, bureau, balance, status, date_opened, date_reported, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        clientId,
        itemType,
        item.creditorName,
        item.accountNumber,
        bureau.toLowerCase(),
        item.balance || 0,
        'identified', // Initial status
        item.dateOpened || null,
        item.dateReported || null,
        `${item.suggestedDispute || ''}\nSeverity: ${item.severity || 'medium'}\nPayment History: ${item.paymentHistory || 'N/A'}`
      ]
    );

    console.log(`✅ Saved credit item: ${item.creditorName} (${itemType})`);
    return {
      ...result.rows[0],
      suggestedDisputeReason: item.disputeReason,
      suggestedDisputeText: item.suggestedDispute,
      severity: item.severity
    };
  } catch (error) {
    console.error('Error saving credit item:', error);
    throw error;
  }
}

/**
 * Analyze multiple reports at once (for 2 or 3 bureau reports)
 */
async function analyzeMultipleReports(clientId, reports) {
  const results = {
    success: true,
    bureausAnalyzed: [],
    totalItemsFound: 0,
    scores: {},
    allItems: [],
    errors: []
  };

  for (const report of reports) {
    try {
      const result = await processUploadedReport(
        clientId,
        report.filePath,
        report.bureau,
        report.documentId
      );

      if (result.success) {
        results.bureausAnalyzed.push(result.bureau);
        results.totalItemsFound += result.itemsFound;
        results.scores[result.bureau] = result.creditScore;
        results.allItems.push(...(result.items || []));
      } else {
        results.errors.push({ bureau: report.bureau, error: result.error });
      }
    } catch (error) {
      results.errors.push({ bureau: report.bureau, error: error.message });
    }
  }

  if (results.errors.length > 0 && results.bureausAnalyzed.length === 0) {
    results.success = false;
  }

  return results;
}

/**
 * Get analysis summary for a client
 */
async function getClientAnalysisSummary(clientId) {
  // Get latest scores
  const scoresResult = await query(
    `SELECT bureau, score, score_date 
     FROM credit_scores 
     WHERE client_id = $1 
     ORDER BY score_date DESC`,
    [clientId]
  );

  // Get credit items by status
  const itemsResult = await query(
    `SELECT 
       status,
       COUNT(*) as count,
       item_type
     FROM credit_items 
     WHERE client_id = $1 
     GROUP BY status, item_type`,
    [clientId]
  );

  // Get score history for chart
  const historyResult = await query(
    `SELECT bureau, score, score_date 
     FROM credit_scores 
     WHERE client_id = $1 
     AND score_date >= NOW() - INTERVAL '12 months'
     ORDER BY score_date ASC`,
    [clientId]
  );

  return {
    latestScores: scoresResult.rows,
    itemsByStatus: itemsResult.rows,
    scoreHistory: historyResult.rows,
    averageScore: scoresResult.rows.length > 0 
      ? Math.round(scoresResult.rows.reduce((sum, s) => sum + s.score, 0) / scoresResult.rows.length)
      : null
  };
}

module.exports = {
  analyzeReport,
  processUploadedReport,
  analyzeMultipleReports,
  saveCreditScore,
  saveCreditItem,
  getClientAnalysisSummary,
  extractTextFromFile
};
