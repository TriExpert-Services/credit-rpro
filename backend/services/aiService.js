/**
 * Credit Repair SaaS - AI Service
 * Servicio de inteligencia artificial para generación de cartas de disputa
 * Soporta OpenAI GPT y Anthropic Claude
 *
 * @module services/aiService
 */

const {
  CREDIT_BUREAUS,
  DISPUTE_TYPES,
  CREDIT_ITEM_TYPES,
} = require('../utils/validators');

/**
 * Configuración del proveedor de AI
 * @type {Object}
 */
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'openai', // 'openai' | 'anthropic'
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: 2000,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    maxTokens: 2000,
  },
};

/**
 * Direcciones de los bureaus de crédito
 * @type {Object}
 */
const BUREAU_ADDRESSES = {
  experian: {
    name: 'Experian',
    address: 'P.O. Box 4500',
    city: 'Allen',
    state: 'TX',
    zip: '75013',
    disputeUrl: 'https://www.experian.com/disputes',
  },
  equifax: {
    name: 'Equifax Information Services LLC',
    address: 'P.O. Box 740256',
    city: 'Atlanta',
    state: 'GA',
    zip: '30374',
    disputeUrl: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/',
  },
  transunion: {
    name: 'TransUnion LLC Consumer Dispute Center',
    address: 'P.O. Box 2000',
    city: 'Chester',
    state: 'PA',
    zip: '19016',
    disputeUrl: 'https://www.transunion.com/credit-disputes',
  },
};

/**
 * Plantillas de disputa por tipo
 * @type {Object}
 */
const DISPUTE_TEMPLATES = {
  not_mine: {
    reason: 'This account does not belong to me',
    legalBasis: 'Under the Fair Credit Reporting Act (FCRA), Section 611, I have the right to dispute inaccurate information.',
    requestedAction: 'Please investigate this matter and remove this account from my credit report as it does not belong to me.',
  },
  paid: {
    reason: 'This account has been paid in full',
    legalBasis: 'Under the FCRA, credit bureaus must report accurate information. This account should reflect a zero balance or be marked as "Paid in Full."',
    requestedAction: 'Please update this account to reflect its paid status or remove it from my credit report.',
  },
  inaccurate_info: {
    reason: 'The information reported is inaccurate',
    legalBasis: 'Under the FCRA, Section 623, furnishers of information must report accurate data. The information currently reported contains errors.',
    requestedAction: 'Please investigate and correct the inaccurate information on this account.',
  },
  outdated: {
    reason: 'This information is outdated and should no longer appear',
    legalBasis: 'Under the FCRA, Section 605, most negative information must be removed after 7 years (10 years for bankruptcies).',
    requestedAction: 'Please remove this outdated information from my credit report.',
  },
  duplicate: {
    reason: 'This account appears to be a duplicate entry',
    legalBasis: 'Under the FCRA, duplicate reporting of the same debt is prohibited as it unfairly damages credit scores.',
    requestedAction: 'Please investigate and remove the duplicate entry from my credit report.',
  },
  other: {
    reason: 'I am disputing this item for the reasons stated below',
    legalBasis: 'Under the Fair Credit Reporting Act, I have the right to dispute any information I believe to be inaccurate.',
    requestedAction: 'Please investigate this matter thoroughly and take appropriate action.',
  },
};

/**
 * Genera el prompt para la AI
 * @param {Object} params - Parámetros para la generación
 * @returns {string} Prompt formateado
 */
const generateDisputePrompt = (params) => {
  const {
    clientInfo,
    creditItem,
    disputeType,
    bureau,
    additionalContext,
    tone = 'professional',
    language = 'en',
  } = params;

  const template = DISPUTE_TEMPLATES[disputeType] || DISPUTE_TEMPLATES.other;
  const bureauInfo = BUREAU_ADDRESSES[bureau];

  const languageInstructions = language === 'es'
    ? 'Write the letter in Spanish (formal Spanish used in legal/business correspondence).'
    : 'Write the letter in English.';

  return `You are an expert credit repair specialist and legal writer. Generate a professional dispute letter for a credit bureau.

${languageInstructions}

CLIENT INFORMATION:
- Full Name: ${clientInfo.firstName} ${clientInfo.lastName}
- Address: ${clientInfo.address || 'Address on file'}
- City, State, ZIP: ${clientInfo.city || ''}, ${clientInfo.state || ''} ${clientInfo.zipCode || ''}
- SSN Last 4: XXX-XX-${clientInfo.ssnLast4 || 'XXXX'}
- Date of Birth: ${clientInfo.dateOfBirth || 'On file'}

BUREAU INFORMATION:
- Bureau: ${bureauInfo.name}
- Address: ${bureauInfo.address}, ${bureauInfo.city}, ${bureauInfo.state} ${bureauInfo.zip}

DISPUTED ITEM:
- Creditor/Company: ${creditItem.creditorName}
- Account Number: ${creditItem.accountNumber ? `****${creditItem.accountNumber.slice(-4)}` : 'Unknown'}
- Type of Item: ${creditItem.itemType}
- Reported Balance: ${creditItem.balance ? `$${creditItem.balance.toFixed(2)}` : 'Unknown'}
- Date Reported: ${creditItem.dateReported || 'Unknown'}

DISPUTE DETAILS:
- Dispute Reason: ${template.reason}
- Legal Basis: ${template.legalBasis}
- Requested Action: ${template.requestedAction}

${additionalContext ? `ADDITIONAL CONTEXT FROM CLIENT:\n${additionalContext}` : ''}

REQUIREMENTS:
1. Use a ${tone} tone throughout the letter
2. Include today's date
3. Reference specific laws (FCRA, FDCPA if applicable)
4. Be firm but respectful
5. Include a clear request for investigation
6. Mention the 30-day response requirement
7. Request deletion or correction of the item
8. Include a signature line for the client

Generate a complete, ready-to-send dispute letter. Format it properly with addresses, date, salutation, body paragraphs, and closing.`;
};

/**
 * Llama a la API de OpenAI
 * @param {string} prompt - Prompt para la AI
 * @returns {Promise<string>} Respuesta de la AI
 */
const callOpenAI = async (prompt) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert credit repair specialist who writes professional, legally-sound dispute letters.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: AI_CONFIG.openai.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

/**
 * Llama a la API de Anthropic Claude
 * @param {string} prompt - Prompt para la AI
 * @returns {Promise<string>} Respuesta de la AI
 */
const callAnthropic = async (prompt) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_CONFIG.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_CONFIG.anthropic.model,
      max_tokens: AI_CONFIG.anthropic.maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: 'You are an expert credit repair specialist who writes professional, legally-sound dispute letters.',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.content[0].text;
};

/**
 * Genera una carta de disputa usando AI
 * @param {Object} params - Parámetros de la disputa
 * @param {Object} params.clientInfo - Información del cliente
 * @param {Object} params.creditItem - Item de crédito a disputar
 * @param {string} params.disputeType - Tipo de disputa
 * @param {string} params.bureau - Bureau de crédito
 * @param {string} [params.additionalContext] - Contexto adicional
 * @param {string} [params.tone='professional'] - Tono de la carta
 * @param {string} [params.language='en'] - Idioma (en/es)
 * @returns {Promise<Object>} Carta generada y metadatos
 */
const generateDisputeLetter = async (params) => {
  const {
    clientInfo,
    creditItem,
    disputeType,
    bureau,
    additionalContext,
    tone = 'professional',
    language = 'en',
  } = params;

  // Validar parámetros requeridos
  if (!clientInfo || !creditItem || !disputeType || !bureau) {
    throw new Error('Missing required parameters for dispute letter generation');
  }

  // Generar prompt
  const prompt = generateDisputePrompt({
    clientInfo,
    creditItem,
    disputeType,
    bureau,
    additionalContext,
    tone,
    language,
  });

  let letterContent;
  const provider = AI_CONFIG.provider;

  try {
    // Llamar a la AI según el proveedor configurado
    if (provider === 'anthropic' && AI_CONFIG.anthropic.apiKey) {
      letterContent = await callAnthropic(prompt);
    } else if (AI_CONFIG.openai.apiKey) {
      letterContent = await callOpenAI(prompt);
    } else {
      // Fallback a plantilla estática si no hay API key
      letterContent = generateStaticLetter(params);
    }
  } catch (error) {
    console.error('AI generation error:', error);
    // Fallback a plantilla estática en caso de error
    letterContent = generateStaticLetter(params);
  }

  return {
    content: letterContent,
    metadata: {
      generatedAt: new Date().toISOString(),
      provider: AI_CONFIG.openai.apiKey || AI_CONFIG.anthropic.apiKey ? provider : 'static',
      disputeType,
      bureau,
      bureauAddress: BUREAU_ADDRESSES[bureau],
    },
  };
};

/**
 * Genera una carta estática como fallback
 * @param {Object} params - Parámetros de la disputa
 * @returns {string} Carta generada
 */
const generateStaticLetter = (params) => {
  const { clientInfo, creditItem, disputeType, bureau } = params;
  const template = DISPUTE_TEMPLATES[disputeType] || DISPUTE_TEMPLATES.other;
  const bureauInfo = BUREAU_ADDRESSES[bureau];
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `${clientInfo.firstName} ${clientInfo.lastName}
${clientInfo.address || '[Your Address]'}
${clientInfo.city || '[City]'}, ${clientInfo.state || '[State]'} ${clientInfo.zipCode || '[ZIP]'}

${today}

${bureauInfo.name}
${bureauInfo.address}
${bureauInfo.city}, ${bureauInfo.state} ${bureauInfo.zip}

Re: Dispute of Inaccurate Credit Information
SSN: XXX-XX-${clientInfo.ssnLast4 || 'XXXX'}
DOB: ${clientInfo.dateOfBirth || '[Date of Birth]'}

To Whom It May Concern:

I am writing to dispute the following information that appears on my credit report. After reviewing my credit report, I have identified an item that I believe to be inaccurate.

DISPUTED ITEM:
Creditor Name: ${creditItem.creditorName}
Account Number: ${creditItem.accountNumber ? `****${creditItem.accountNumber.slice(-4)}` : '[Account Number]'}
Type: ${creditItem.itemType}
${creditItem.balance ? `Reported Balance: $${creditItem.balance.toFixed(2)}` : ''}

REASON FOR DISPUTE:
${template.reason}

LEGAL BASIS:
${template.legalBasis}

REQUESTED ACTION:
${template.requestedAction}

Under the Fair Credit Reporting Act (FCRA), you are required to investigate this dispute within 30 days of receipt. If you cannot verify the accuracy of this information, it must be removed from my credit report.

Please send me written confirmation of your investigation results and any changes made to my credit report.

I am also requesting that you provide me with the name, address, and telephone number of any information provider contacted during your investigation.

Thank you for your prompt attention to this matter.

Sincerely,


_______________________________
${clientInfo.firstName} ${clientInfo.lastName}

Enclosures:
- Copy of government-issued ID
- Proof of address
- Copy of credit report with disputed item highlighted`;
};

/**
 * Analiza un reporte de crédito para identificar items disputables
 * @param {string} reportText - Texto del reporte de crédito
 * @returns {Promise<Object>} Análisis del reporte
 */
const analyzeCreditReport = async (reportText) => {
  if (!AI_CONFIG.openai.apiKey && !AI_CONFIG.anthropic.apiKey) {
    throw new Error('AI API key not configured');
  }

  const prompt = `Analyze this credit report and identify all negative items that could potentially be disputed.
For each item, provide:
1. Creditor name
2. Account type
3. Reported balance
4. Reason it could be disputed
5. Recommended dispute type
6. Priority level (high/medium/low)

Credit Report:
${reportText}

Respond in JSON format with an array of identified items.`;

  try {
    let response;
    if (AI_CONFIG.provider === 'anthropic' && AI_CONFIG.anthropic.apiKey) {
      response = await callAnthropic(prompt);
    } else {
      response = await callOpenAI(prompt);
    }

    // Intentar parsear la respuesta como JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return {
        items: JSON.parse(jsonMatch[0]),
        rawAnalysis: response,
      };
    }

    return {
      items: [],
      rawAnalysis: response,
    };
  } catch (error) {
    console.error('Credit report analysis error:', error);
    throw error;
  }
};

/**
 * Genera recomendaciones personalizadas para mejorar el crédito
 * @param {Object} clientData - Datos del cliente
 * @returns {Promise<Object>} Recomendaciones
 */
const generateCreditRecommendations = async (clientData) => {
  const { creditScores, creditItems, disputes } = clientData;

  const prompt = `As a credit repair expert, analyze this client's credit situation and provide personalized recommendations.

CREDIT SCORES:
${JSON.stringify(creditScores, null, 2)}

NEGATIVE ITEMS:
${JSON.stringify(creditItems, null, 2)}

CURRENT DISPUTES:
${JSON.stringify(disputes, null, 2)}

Provide:
1. Top 3 priority actions to improve credit score
2. Estimated timeline for improvement
3. Items with highest chance of successful dispute
4. General credit building recommendations
5. Warning signs or issues to address immediately

Format response as JSON with keys: priorityActions, timeline, highSuccessItems, recommendations, warnings`;

  try {
    let response;
    if (AI_CONFIG.provider === 'anthropic' && AI_CONFIG.anthropic.apiKey) {
      response = await callAnthropic(prompt);
    } else if (AI_CONFIG.openai.apiKey) {
      response = await callOpenAI(prompt);
    } else {
      return {
        priorityActions: [
          'Review and dispute any inaccurate negative items',
          'Pay down credit card balances to below 30% utilization',
          'Set up automatic payments to avoid late payments',
        ],
        timeline: '3-6 months for initial improvements',
        recommendations: [
          'Consider becoming an authorized user on a family member\'s old account',
          'Apply for a secured credit card to build positive history',
        ],
        warnings: [],
      };
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { rawRecommendations: response };
  } catch (error) {
    console.error('Recommendations generation error:', error);
    throw error;
  }
};

module.exports = {
  generateDisputeLetter,
  generateStaticLetter,
  analyzeCreditReport,
  generateCreditRecommendations,
  BUREAU_ADDRESSES,
  DISPUTE_TEMPLATES,
  AI_CONFIG,
};
