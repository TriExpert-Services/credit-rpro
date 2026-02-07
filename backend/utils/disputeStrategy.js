/**
 * Dispute Strategy Engine
 * Provides intelligent dispute strategies based on item type, bureau, round, and account details.
 * Recommends the most effective approach for each situation.
 */

/**
 * Strategy rounds define the escalation path
 */
const STRATEGY_ROUNDS = {
  1: {
    id: 1,
    name: 'Initial Dispute',
    description: 'Formal dispute requesting investigation and Method of Verification',
    approach: 'Assert rights under FCRA §611, request investigation, and demand MOV',
    waitDays: 35,
    nextAction: 'If verified, proceed to Round 2 challenging the verification method'
  },
  2: {
    id: 2,
    name: 'Verification Challenge',
    description: 'Challenge the adequacy of the bureau investigation and demand procedural proof',
    approach: 'Cite §611(a)(5)(A) — bureau must forward ALL relevant evidence. Challenge e-OSCAR automated verification as inadequate.',
    waitDays: 35,
    nextAction: 'If still verified, escalate to Round 3 with regulatory threat'
  },
  3: {
    id: 3,
    name: 'Escalation & Warning',
    description: 'Final warning before regulatory complaints — cite civil liability',
    approach: 'Reference §616/§617 civil liability ($100-$1,000/violation + punitive damages). Announce intent to file CFPB complaint and contact state AG.',
    waitDays: 30,
    nextAction: 'File CFPB complaint and state AG complaint in Round 4'
  },
  4: {
    id: 4,
    name: 'Regulatory Complaint',
    description: 'File formal complaints with CFPB and state Attorney General',
    approach: 'Document full dispute history. File CFPB complaint at consumerfinance.gov. File state AG complaint. Prepare for potential litigation.',
    waitDays: 60,
    nextAction: 'Consult attorney for potential FCRA lawsuit'
  }
};

/**
 * Bureau-specific strategies and known weaknesses
 */
const BUREAU_STRATEGIES = {
  equifax: {
    name: 'Equifax',
    address: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256',
    onlineDispute: 'https://www.equifax.com/personal/disputes/',
    weaknesses: [
      'Heavy reliance on ACDV automated system — challenge as inadequate investigation',
      'History of data breaches (2017) — leverage security concerns for identity-related disputes',
      'Often fails to conduct meaningful re-investigation after initial verification',
      'Known for not forwarding complete consumer documentation to furnishers'
    ],
    bestTactics: [
      'Demand human review, not automated ACDV processing',
      'Request the specific individual who conducted the investigation',
      'Reference Equifax\'s consent decree requirements for thorough investigations',
      'Send disputes via certified mail to create paper trail for potential litigation'
    ],
    mailingTips: 'Send to P.O. Box 740256 for disputes. Include a copy of ID and proof of address.'
  },
  experian: {
    name: 'Experian',
    address: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
    onlineDispute: 'https://www.experian.com/disputes/main.html',
    weaknesses: [
      'Frequently fails to forward complete consumer documentation to furnishers via e-OSCAR',
      'Often summarizes disputes with 2-digit codes instead of forwarding full dispute narrative',
      'Known for verifying accounts based on limited furnisher response',
      'Sometimes stalls disputes by requesting additional documentation unnecessarily'
    ],
    bestTactics: [
      'Explicitly state in your letter: "Forward this COMPLETE letter to the furnisher"',
      'Demand they not reduce your dispute to a code — cite §611(a)(5)(A)',
      'If they request more info, send via certified mail with tracking',
      'Reference Experian\'s duty under §611(a)(1)(A) to forward all relevant information'
    ],
    mailingTips: 'Send to P.O. Box 4500 for disputes. Include "ATTENTION: Consumer Disputes Department".'
  },
  transunion: {
    name: 'TransUnion',
    address: 'TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016',
    onlineDispute: 'https://www.transunion.com/credit-disputes/dispute-your-credit',
    weaknesses: [
      'Frequently verifies without meaningful investigation — challenge the process',
      'Uses automated matching that can result in mixed files',
      'Known for delays in updating resolved disputes on consumer reports',
      'Sometimes fails to provide complete MOV upon request'
    ],
    bestTactics: [
      'Always request Method of Verification with specific details',
      'Demand the name, address, and phone of the person who verified',
      'If disputing mixed file issues, demand manual file separation',
      'Reference TransUnion\'s obligation under §611(a)(6)(B)(iii) for unverifiable items'
    ],
    mailingTips: 'Send to P.O. Box 2000 for disputes. Use certified mail with return receipt.'
  }
};

/**
 * Recommended strategies by item type
 */
const ITEM_TYPE_STRATEGIES = {
  late_payment: {
    name: 'Late Payment',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['other'],
    estimatedScoreImpact: { min: 15, max: 110 },
    tips: [
      'Challenge the exact date reported as late — even 1-day discrepancy invalidates the record',
      'Request proof of the exact payment posting date from the original creditor',
      'If payment was made on time but processed late, dispute as inaccurate',
      'Goodwill letters to the original creditor can also result in removal',
      'A single 30-day late payment can drop scores 60-110 points for excellent credit profiles'
    ],
    legalArguments: [
      'FCRA §623(a)(1)(A): Furnisher duty to report only accurate information',
      'FCRA §623(a)(2): Furnisher must update/correct incomplete or inaccurate info',
      'Metro 2 Format: Payment date must reflect actual date payment was received and applied'
    ]
  },
  collection: {
    name: 'Collection Account',
    primaryStrategy: 'not_mine',
    alternativeStrategies: ['paid', 'inaccurate_info', 'outdated'],
    estimatedScoreImpact: { min: 50, max: 150 },
    tips: [
      'Demand debt validation under FDCPA §1692g before acknowledging the debt',
      'Challenge the chain of title — can the collector prove they own the debt?',
      'If original creditor AND collector both report, dispute as duplicate',
      'Collections under $100 are excluded from newer FICO models (FICO 9)',
      'Medical collections have special rules — removed once paid under new FICO models',
      'Paid collections still hurt your score in FICO 8 — negotiate "pay for delete"'
    ],
    legalArguments: [
      'FDCPA §1692g: Right to debt validation within 30 days of first contact',
      'FDCPA §1692e: False/misleading representation if amount is wrong',
      'FCRA §623(a)(1)(A): Collector must verify debt accuracy before reporting',
      'FCRA §605(a): 7-year limit from date of first delinquency with original creditor'
    ]
  },
  charge_off: {
    name: 'Charge-Off',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['paid', 'outdated'],
    estimatedScoreImpact: { min: 75, max: 150 },
    tips: [
      'Challenge the charge-off date — it must match 180 days after first missed payment',
      'If balance shows amount after charge-off, dispute the balance as inaccurate',
      'Charge-offs must show $0 balance once sold to collections',
      'If both charge-off and collection appear for same debt, dispute as duplicate',
      'The date of first delinquency CANNOT be changed — watch for re-aging'
    ],
    legalArguments: [
      'FCRA §623(a)(1)(A): Balance must be accurate at time of reporting',
      'FCRA §605(c): Reporting period starts from date of first delinquency — cannot be re-aged',
      'Metro 2 Guidelines: Charge-offs sold to collectors must report $0 balance'
    ]
  },
  bankruptcy: {
    name: 'Bankruptcy',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['outdated'],
    estimatedScoreImpact: { min: 130, max: 240 },
    tips: [
      'Verify the exact filing date and discharge date — both must be accurate',
      'Chapter 7 can be reported for 10 years; Chapter 13 for 7 years from filing',
      'Individual accounts included in bankruptcy should show "Included in Bankruptcy" — not as separate delinquencies',
      'Challenge any account included in bankruptcy that still shows a balance',
      'After discharge, all included debts must show $0 balance'
    ],
    legalArguments: [
      'FCRA §605(a)(1): Chapter 7 — 10 years from filing; Chapter 13 — 7 years from filing',
      'FCRA §623(a)(1)(A): Accounts in bankruptcy must accurately reflect $0 balance post-discharge',
      '11 U.S.C. §524: Discharge injunction — creditors cannot continue to report discharged debts as owed'
    ]
  },
  foreclosure: {
    name: 'Foreclosure',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['outdated'],
    estimatedScoreImpact: { min: 85, max: 160 },
    tips: [
      'Verify the exact date of foreclosure sale — must be accurate',
      'Challenge any deficiency balance reported after foreclosure (varies by state)',
      'If property was sold for more than owed, no deficiency should be reported',
      'Date of first delinquency must be accurate for 7-year calculation'
    ],
    legalArguments: [
      'FCRA §605(a): 7-year reporting limit from date of first delinquency',
      'State law deficiency regulations (varies by jurisdiction)',
      'FCRA §623(a)(1)(A): Balance and status must be accurately reported post-sale'
    ]
  },
  repossession: {
    name: 'Repossession',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['paid', 'outdated'],
    estimatedScoreImpact: { min: 75, max: 150 },
    tips: [
      'Challenge the deficiency balance — was the vehicle sold at fair market value?',
      'Request proof of commercially reasonable sale under UCC §9-610',
      'Verify that proper notice was given before and after the sale',
      'If deficiency balance is inaccurate, dispute the specific amount'
    ],
    legalArguments: [
      'UCC §9-610: Vehicle must be sold in commercially reasonable manner',
      'UCC §9-611: Notice requirements before disposition',
      'FCRA §623(a)(1)(A): Deficiency balance must accurately reflect sale proceeds'
    ]
  },
  inquiry: {
    name: 'Hard Inquiry',
    primaryStrategy: 'not_mine',
    alternativeStrategies: ['other'],
    estimatedScoreImpact: { min: 5, max: 15 },
    tips: [
      'Hard inquiries require your written authorization — did you apply?',
      'Unauthorized inquiries may indicate identity theft or permissible purpose violation',
      'Inquiries fall off after 2 years but only affect scores for 12 months',
      'Multiple inquiries for same type within 14-45 days count as one (rate shopping)',
      'Challenge any inquiry where you did NOT apply for credit'
    ],
    legalArguments: [
      'FCRA §604: Permissible purposes for accessing credit report',
      'FCRA §615(a): Notice requirements when credit is denied based on report',
      'FCRA §616: Civil liability for unauthorized access ($100-$1,000 per inquiry)'
    ]
  },
  other: {
    name: 'Other Negative Item',
    primaryStrategy: 'inaccurate_info',
    alternativeStrategies: ['not_mine', 'outdated'],
    estimatedScoreImpact: { min: 10, max: 100 },
    tips: [
      'Challenge every data point — creditor name, account number, balance, dates, status',
      'Even minor inaccuracies (wrong address, incorrect account type) make the item disputable',
      'Request the original agreement or documentation supporting the account'
    ],
    legalArguments: [
      'FCRA §611(a): Right to dispute any information believed to be inaccurate',
      'FCRA §611(a)(6)(B)(iii): Unverifiable information must be deleted',
      'FCRA §623(a)(1)(A): Accuracy requirement for all furnished information'
    ]
  }
};

/**
 * Get recommended strategy for a credit item
 */
function getRecommendedStrategy(itemType, currentRound = 1, previousResult = null) {
  const strategy = ITEM_TYPE_STRATEGIES[itemType] || ITEM_TYPE_STRATEGIES.other;
  const round = STRATEGY_ROUNDS[currentRound] || STRATEGY_ROUNDS[1];

  let recommendedDisputeType = strategy.primaryStrategy;

  // Adjust strategy based on round
  if (currentRound >= 2 && previousResult === 'verified') {
    // If first round was verified, try an alternative approach
    recommendedDisputeType = strategy.alternativeStrategies[0] || strategy.primaryStrategy;
  }
  if (currentRound >= 3) {
    // Escalation round — use the strongest legal argument regardless
    recommendedDisputeType = 'inaccurate_info'; // Always challenge accuracy in escalation
  }

  return {
    itemType: strategy.name,
    recommendedDisputeType,
    alternativeStrategies: strategy.alternativeStrategies,
    round,
    estimatedScoreImpact: strategy.estimatedScoreImpact,
    tips: strategy.tips,
    legalArguments: strategy.legalArguments,
    bureauStrategy: null // Will be filled when bureau is known
  };
}

/**
 * Get bureau-specific strategy
 */
function getBureauStrategy(bureau) {
  return BUREAU_STRATEGIES[bureau?.toLowerCase()] || null;
}

/**
 * Get complete dispute strategy
 */
function getCompleteStrategy(itemType, bureau, currentRound = 1, previousResult = null) {
  const strategy = getRecommendedStrategy(itemType, currentRound, previousResult);
  strategy.bureauStrategy = getBureauStrategy(bureau);
  return strategy;
}

/**
 * Determine the current round based on existing disputes for an item
 */
async function determineCurrentRound(pool, creditItemId, bureau) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as dispute_count, 
              MAX(status) as last_status
       FROM disputes 
       WHERE credit_item_id = $1 AND bureau = $2`,
      [creditItemId, bureau]
    );

    const count = parseInt(result.rows[0]?.dispute_count || 0);
    const lastStatus = result.rows[0]?.last_status;

    // Determine round based on previous dispute count
    if (count === 0) return { round: 1, previousResult: null };
    if (count === 1) return { round: 2, previousResult: lastStatus === 'resolved' ? 'resolved' : 'verified' };
    if (count === 2) return { round: 3, previousResult: 'verified' };
    return { round: 4, previousResult: 'verified' };
  } catch (error) {
    console.error('Error determining dispute round:', error.message);
    return { round: 1, previousResult: null };
  }
}

/**
 * Estimate score improvement if item is removed
 */
function estimateScoreImprovement(itemType, currentScore, totalNegativeItems) {
  const strategy = ITEM_TYPE_STRATEGIES[itemType] || ITEM_TYPE_STRATEGIES.other;
  const { min, max } = strategy.estimatedScoreImpact;

  // Adjust impact based on current score and number of items
  // Lower scores see more improvement per item removed
  let multiplier = 1.0;
  if (currentScore < 580) multiplier = 1.3;
  else if (currentScore < 650) multiplier = 1.1;
  else if (currentScore >= 740) multiplier = 0.7;

  // More items = less impact per individual removal
  if (totalNegativeItems > 10) multiplier *= 0.7;
  else if (totalNegativeItems > 5) multiplier *= 0.85;

  return {
    estimatedMin: Math.round(min * multiplier),
    estimatedMax: Math.round(max * multiplier),
    projectedScoreMin: Math.min(850, currentScore + Math.round(min * multiplier)),
    projectedScoreMax: Math.min(850, currentScore + Math.round(max * multiplier)),
    confidence: totalNegativeItems <= 3 ? 'high' : totalNegativeItems <= 7 ? 'medium' : 'low'
  };
}

module.exports = {
  STRATEGY_ROUNDS,
  BUREAU_STRATEGIES,
  ITEM_TYPE_STRATEGIES,
  getRecommendedStrategy,
  getBureauStrategy,
  getCompleteStrategy,
  determineCurrentRound,
  estimateScoreImprovement
};
