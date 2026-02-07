/**
 * Credit Score Service
 * FCRA-compliant credit score calculations, tracking, anomaly detection,
 * impact analysis, and improvement projections.
 */

const { query } = require('../config/database');
const { estimateScoreImprovement, ITEM_TYPE_STRATEGIES } = require('./disputeStrategy');

const creditScoreService = {
  /**
   * Record a credit score (manual or from API)
   */
  recordScore: async (clientId, bureau, score, source = 'manual_entry', notes = null) => {
    try {
      // Validate score range
      if (score < 300 || score > 850) {
        throw new Error('Credit score must be between 300 and 850');
      }
      
      // Get previous score if exists
      const previousScoreResult = await query(
        `SELECT score FROM credit_scores
         WHERE client_id = $1 AND bureau = $2
         ORDER BY score_date DESC LIMIT 1`,
        [clientId, bureau]
      );
      
      const previousScore = previousScoreResult.rows.length > 0 
        ? previousScoreResult.rows[0].score 
        : null;
      
      // Insert new score
      const result = await query(
        `INSERT INTO credit_scores (client_id, bureau, score, score_date, notes)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)
         RETURNING id, score, score_date;`,
        [clientId, bureau, score, notes]
      );
      
      const newScore = result.rows[0];
      
      // Log to audit
      await query(
        `INSERT INTO credit_score_audit (
          client_id, bureau, previous_score, new_score, score_change, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [clientId, bureau, previousScore, score, score - (previousScore || score), source]
      );
      
      // Log to activity
      await query(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
         VALUES ($1, 'Credit score recorded', 'credit_scores', $2, $3)`,
        [clientId, newScore.id, `${bureau}: ${score} (${source})`]
      );
      
      console.log(`✅ Credit score recorded: ${bureau} = ${score}`);
      
      return {
        ...newScore,
        previousScore,
        change: score - (previousScore || score),
        trend: previousScore ? (score >= previousScore ? 'up' : 'down') : 'new'
      };
    } catch (error) {
      console.error('Error recording credit score:', error);
      throw error;
    }
  },

  /**
   * Get latest credit scores for a client (all bureaus)
   */
  getLatestScores: async (clientId) => {
    try {
      const result = await query(
        `SELECT DISTINCT ON (bureau) 
           id, client_id, bureau, score, score_date
         FROM credit_scores
         WHERE client_id = $1
         ORDER BY bureau, score_date DESC`,
        [clientId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting latest scores:', error);
      throw error;
    }
  },

  /**
   * Get score history for a bureau
   */
  getScoreHistory: async (clientId, bureau, limit = 12) => {
    try {
      const result = await query(
        `SELECT id, score, score_date, notes
         FROM credit_scores
         WHERE client_id = $1 AND bureau = $2
         ORDER BY score_date DESC
         LIMIT $3`,
        [clientId, bureau, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting score history:', error);
      throw error;
    }
  },

  /**
   * Calculate score trend
   */
  calculateTrend: async (clientId, bureau, months = 6) => {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - months);
      
      const result = await query(
        `SELECT 
          (SELECT score FROM credit_scores 
           WHERE client_id = $1 AND bureau = $2 
           ORDER BY score_date DESC LIMIT 1) as current_score,
          (SELECT score FROM credit_scores 
           WHERE client_id = $1 AND bureau = $2 AND score_date <= $3
           ORDER BY score_date DESC LIMIT 1) as past_score,
          COUNT(*) as data_points
         FROM credit_scores
         WHERE client_id = $1 AND bureau = $2`,
        [clientId, bureau, sixMonthsAgo]
      );
      
      const trend = result.rows[0];
      
      if (!trend.current_score || !trend.past_score) {
        return {
          trend: 'insufficient_data',
          currentScore: trend.current_score,
          dataPoints: trend.data_points
        };
      }
      
      const change = trend.current_score - trend.past_score;
      
      return {
        trend: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
        currentScore: trend.current_score,
        pastScore: trend.past_score,
        change,
        percentChange: ((change / trend.past_score) * 100).toFixed(2),
        dataPoints: trend.data_points,
        period: `${months} months`
      };
    } catch (error) {
      console.error('Error calculating trend:', error);
      throw error;
    }
  },

  /**
   * Get score factors analysis
   */
  getScoreFactors: async (clientId) => {
    try {
      // Get credit items and their impact
      const itemsResult = await query(
        `SELECT 
          item_type,
          status,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as resolved_count
         FROM credit_items
         WHERE client_id = $1
         GROUP BY item_type, status`,
        [clientId]
      );
      
      // Get dispute progress
      const disputesResult = await query(
        `SELECT 
          status,
          COUNT(*) as count
         FROM disputes
         WHERE client_id = $1
         GROUP BY status`,
        [clientId]
      );
      
      return {
        creditItems: itemsResult.rows,
        disputes: disputesResult.rows,
        analysis: {
          totalNegativeItems: itemsResult.rows.reduce((sum, row) => sum + row.count, 0),
          resolvedItems: itemsResult.rows.reduce((sum, row) => sum + (row.resolved_count || 0), 0),
          totalDisputes: disputesResult.rows.reduce((sum, row) => sum + row.count, 0),
          successRate: '0%' // Would be calculated based on resolution
        }
      };
    } catch (error) {
      console.error('Error getting score factors:', error);
      throw error;
    }
  },

  /**
   * Get score comparison between bureaus
   */
  getBureauComparison: async (clientId) => {
    try {
      const latestScores = await creditScoreService.getLatestScores(clientId);
      
      if (latestScores.length === 0) {
        return {
          scores: [],
          average: 0,
          highest: 0,
          lowest: 0,
          spread: 0
        };
      }
      
      const scores = latestScores.map(s => s.score);
      const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);
      
      return {
        scores: latestScores,
        average,
        highest,
        lowest,
        spread: highest - lowest,
        interpretation: creditScoreService.interpretScoreRange(average)
      };
    } catch (error) {
      console.error('Error getting bureau comparison:', error);
      throw error;
    }
  },

  /**
   * Generate credit report summary
   */
  generateReport: async (clientId) => {
    try {
      const latestScores = await creditScoreService.getLatestScores(clientId);
      const factors = await creditScoreService.getScoreFactors(clientId);
      const comparison = await creditScoreService.getBureauComparison(clientId);
      
      return {
        clientId,
        reportDate: new Date().toISOString(),
        summary: {
          averageScore: comparison.average,
          bureaus: latestScores,
          trend: 'stable', // Would be calculated
          factors
        },
        recommendations: creditScoreService.generateRecommendations(comparison.average, factors),
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  },

  /**
   * Interpret credit score range
   */
  interpretScoreRange: (score) => {
    if (score >= 800) return { range: 'Excellent', description: 'Superior credit profile' };
    if (score >= 740) return { range: 'Very Good', description: 'Strong credit profile' };
    if (score >= 670) return { range: 'Good', description: 'Acceptable credit profile' };
    if (score >= 580) return { range: 'Fair', description: 'Below average credit profile' };
    return { range: 'Poor', description: 'Significant credit challenges' };
  },

  /**
   * Generate detailed improvement recommendations
   */
  generateRecommendations: (averageScore, factors) => {
    const recommendations = [];
    
    const negativeItems = factors.creditItems || [];
    const resolvedCount = negativeItems.reduce((sum, row) => sum + (parseInt(row.resolved_count) || 0), 0);
    const totalCount = negativeItems.reduce((sum, row) => sum + (parseInt(row.count) || 0), 0);
    
    // Score-based recommendations
    if (averageScore < 580) {
      recommendations.push({
        priority: 'critical',
        category: 'score',
        action: 'Aggressive dispute strategy needed',
        description: 'Your score is in the "Poor" range. Focus on disputing all inaccurate negative items starting with collections and charge-offs, which have the highest score impact.',
        estimatedImpact: '+50 to +150 points if successful'
      });
    } else if (averageScore < 650) {
      recommendations.push({
        priority: 'high',
        category: 'score',
        action: 'Target high-impact negative items',
        description: 'Your score is in the "Fair" range. Prioritize disputing collections and late payments to cross the 650+ threshold, which unlocks better interest rates.',
        estimatedImpact: '+30 to +80 points if successful'
      });
    } else if (averageScore < 740) {
      recommendations.push({
        priority: 'medium',
        category: 'score',
        action: 'Fine-tune your credit profile',
        description: 'Your score is "Good" — with targeted disputes of remaining negatives, you can reach "Very Good" (740+) for premium rates.',
        estimatedImpact: '+20 to +50 points if successful'
      });
    }
    
    // Item-type specific recommendations
    const hasCollections = negativeItems.some(item => item.item_type === 'collection' && item.status !== 'resolved' && item.status !== 'deleted');
    const hasLatePayments = negativeItems.some(item => item.item_type === 'late_payment' && item.status !== 'resolved' && item.status !== 'deleted');
    const hasChargeOffs = negativeItems.some(item => item.item_type === 'charge_off' && item.status !== 'resolved' && item.status !== 'deleted');
    const hasInquiries = negativeItems.some(item => item.item_type === 'inquiry');
    
    if (hasCollections) {
      recommendations.push({
        priority: 'high',
        category: 'collections',
        action: 'Dispute collection accounts',
        description: 'Collections have the highest negative impact (50-150 pts). Demand debt validation under FDCPA §1692g and challenge the chain of title. Many collectors cannot provide proper documentation.',
        estimatedImpact: '+50 to +150 points per collection removed'
      });
    }
    
    if (hasChargeOffs) {
      recommendations.push({
        priority: 'high',
        category: 'charge_offs',
        action: 'Challenge charge-off reporting',
        description: 'Verify the charge-off date and balance. If the account was sold to collections, the original creditor must report $0 balance. Challenge any duplicate reporting.',
        estimatedImpact: '+75 to +150 points per charge-off resolved'
      });
    }
    
    if (hasLatePayments) {
      recommendations.push({
        priority: 'high',
        category: 'late_payments',
        action: 'Dispute late payment records',
        description: 'Late payments can drop scores 60-110 points. Challenge exact dates and request proof of payment posting. Consider goodwill letters to original creditors.',
        estimatedImpact: '+15 to +110 points per late payment removed'
      });
    }
    
    if (hasInquiries) {
      recommendations.push({
        priority: 'low',
        category: 'inquiries',
        action: 'Challenge unauthorized inquiries',
        description: 'Hard inquiries affect scores for 12 months. Dispute any inquiry you did not authorize. Unauthorized access is a FCRA §604 violation.',
        estimatedImpact: '+5 to +15 points per inquiry removed'
      });
    }
    
    // Progress encouragement
    if (resolvedCount > 0) {
      recommendations.push({
        priority: 'info',
        category: 'progress',
        action: 'Keep up the momentum!',
        description: `You've already resolved ${resolvedCount} of ${totalCount} items. Continue disputing remaining items for maximum score improvement.`,
        estimatedImpact: 'Ongoing improvement'
      });
    }
    
    // General best practices
    recommendations.push({
      priority: 'medium',
      category: 'best_practice',
      action: 'Monitor all 3 bureaus monthly',
      description: 'Discrepancies between bureaus are common and disputable. Each bureau reports independently — an item verified by one may be removed by another.'
    });
    
    return recommendations;
  },

  /**
   * Detect score anomalies (sudden drops, bureau inconsistencies)
   */
  detectAnomalies: async (clientId) => {
    try {
      const alerts = [];

      // 1. Check for sudden score drops (>30 points in one month)
      const dropResult = await query(
        `SELECT a.bureau, a.score as current_score, a.score_date as current_date,
                b.score as previous_score, b.score_date as previous_date,
                (a.score - b.score) as change
         FROM credit_scores a
         INNER JOIN LATERAL (
           SELECT score, score_date FROM credit_scores
           WHERE client_id = $1 AND bureau = a.bureau AND score_date < a.score_date
           ORDER BY score_date DESC LIMIT 1
         ) b ON true
         WHERE a.client_id = $1 
           AND a.score_date >= NOW() - INTERVAL '90 days'
           AND (a.score - b.score) < -30
         ORDER BY a.score_date DESC`,
        [clientId]
      );

      for (const drop of dropResult.rows) {
        alerts.push({
          type: 'sudden_drop',
          severity: Math.abs(drop.change) > 60 ? 'critical' : 'warning',
          bureau: drop.bureau,
          message: `${drop.bureau} score dropped ${Math.abs(drop.change)} points (${drop.previous_score} → ${drop.current_score})`,
          detail: `Between ${new Date(drop.previous_date).toLocaleDateString()} and ${new Date(drop.current_date).toLocaleDateString()}`,
          recommendation: 'Check for new negative items, increased credit utilization, or new hard inquiries. Pull your credit report immediately.',
          change: drop.change,
          date: drop.current_date
        });
      }

      // 2. Check for bureau score inconsistencies (>40 point spread)
      const latestScores = await creditScoreService.getLatestScores(clientId);
      if (latestScores.length >= 2) {
        const scores = latestScores.map(s => s.score);
        const maxSpread = Math.max(...scores) - Math.min(...scores);
        
        if (maxSpread > 40) {
          const highBureau = latestScores.find(s => s.score === Math.max(...scores));
          const lowBureau = latestScores.find(s => s.score === Math.min(...scores));
          
          alerts.push({
            type: 'bureau_inconsistency',
            severity: maxSpread > 80 ? 'critical' : 'warning',
            message: `${maxSpread}-point spread between bureaus: ${highBureau.bureau} (${highBureau.score}) vs ${lowBureau.bureau} (${lowBureau.score})`,
            detail: 'Large differences between bureaus indicate items reported to some bureaus but not others — a key opportunity for targeted disputes.',
            recommendation: `Compare your ${lowBureau.bureau} report with ${highBureau.bureau} to identify items dragging ${lowBureau.bureau} down. Dispute those items specifically with ${lowBureau.bureau}.`,
            spread: maxSpread
          });
        }
      }

      // 3. Check for stagnant scores (no improvement in 3+ months despite disputes)
      const stagnantResult = await query(
        `SELECT cs.bureau,
                MIN(cs.score) as min_score, MAX(cs.score) as max_score,
                COUNT(*) as data_points,
                (SELECT COUNT(*) FROM disputes WHERE client_id = $1 AND status = 'sent' AND created_at >= NOW() - INTERVAL '90 days') as recent_disputes
         FROM credit_scores cs
         WHERE cs.client_id = $1 AND cs.score_date >= NOW() - INTERVAL '90 days'
         GROUP BY cs.bureau
         HAVING MAX(cs.score) - MIN(cs.score) < 10 AND COUNT(*) >= 2`,
        [clientId]
      );

      for (const stagnant of stagnantResult.rows) {
        if (parseInt(stagnant.recent_disputes) > 0) {
          alerts.push({
            type: 'stagnant_score',
            severity: 'info',
            bureau: stagnant.bureau,
            message: `${stagnant.bureau} score has not improved significantly in 90 days despite active disputes`,
            detail: `Score range: ${stagnant.min_score}-${stagnant.max_score} with ${stagnant.recent_disputes} disputes sent`,
            recommendation: 'Consider escalating to Round 2/3 strategy. Change dispute angles — try different dispute types or challenge verification methods.'
          });
        }
      }

      // 4. Check for potential re-aging (score drop after item should have aged off)
      const reagingResult = await query(
        `SELECT ci.creditor_name, ci.item_type, ci.date_opened, ci.bureau,
                EXTRACT(YEAR FROM AGE(NOW(), ci.date_opened)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), ci.date_opened)) as months_old
         FROM credit_items ci
         WHERE ci.client_id = $1 
           AND ci.status NOT IN ('resolved', 'deleted')
           AND ci.date_opened IS NOT NULL
           AND ci.date_opened < NOW() - INTERVAL '6 years'
           AND ci.item_type != 'bankruptcy'`,
        [clientId]
      );

      for (const item of reagingResult.rows) {
        const monthsOld = parseInt(item.months_old);
        if (monthsOld >= 78) { // 6.5 years — approaching 7 year limit
          alerts.push({
            type: 'approaching_expiration',
            severity: monthsOld >= 82 ? 'critical' : 'info',
            bureau: item.bureau,
            message: `"${item.creditor_name}" is ${Math.floor(monthsOld / 12)} years ${monthsOld % 12} months old — ${monthsOld >= 82 ? 'should be removed soon' : 'approaching 7-year limit'}`,
            detail: `Item type: ${item.item_type}. Date opened: ${new Date(item.date_opened).toLocaleDateString()}`,
            recommendation: monthsOld >= 84 
              ? 'This item has exceeded the 7-year reporting period under FCRA §605(a). Dispute immediately for removal as obsolete information.'
              : 'This item is approaching the reporting limit. Prepare a dispute citing FCRA §605(a) for when it reaches 7 years.'
          });
        }
      }

      return {
        alerts,
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length,
        infoCount: alerts.filter(a => a.severity === 'info').length
      };
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  },

  /**
   * Project score improvement based on resolving specific items
   */
  projectImprovement: async (clientId) => {
    try {
      // Get current scores
      const latestScores = await creditScoreService.getLatestScores(clientId);
      const avgScore = latestScores.length > 0 
        ? Math.round(latestScores.reduce((sum, s) => sum + s.score, 0) / latestScores.length) 
        : 600;

      // Get unresolved negative items
      const itemsResult = await query(
        `SELECT id, item_type, creditor_name, balance, bureau, status, date_opened
         FROM credit_items
         WHERE client_id = $1 AND status NOT IN ('resolved', 'deleted')
         ORDER BY balance DESC NULLS LAST`,
        [clientId]
      );

      const items = itemsResult.rows;
      const totalNegativeItems = items.length;

      // Calculate per-item impact
      const itemImpacts = items.map(item => {
        const impact = estimateScoreImprovement(item.item_type, avgScore, totalNegativeItems);
        const strategy = ITEM_TYPE_STRATEGIES[item.item_type] || ITEM_TYPE_STRATEGIES.other;
        
        return {
          id: item.id,
          creditorName: item.creditor_name,
          itemType: item.item_type,
          itemTypeName: strategy.name,
          balance: parseFloat(item.balance || 0),
          bureau: item.bureau,
          status: item.status,
          dateOpened: item.date_opened,
          estimatedImpact: impact,
          primaryDisputeStrategy: strategy.primaryStrategy,
          priority: impact.estimatedMax > 80 ? 'critical' : impact.estimatedMax > 40 ? 'high' : 'medium'
        };
      });

      // Sort by estimated max impact (highest first)
      itemImpacts.sort((a, b) => b.estimatedImpact.estimatedMax - a.estimatedImpact.estimatedMax);

      // Calculate cumulative projection
      let projectedScore = avgScore;
      const projectionTimeline = [];

      for (let i = 0; i < itemImpacts.length; i++) {
        const item = itemImpacts[i];
        const avgGain = Math.round((item.estimatedImpact.estimatedMin + item.estimatedImpact.estimatedMax) / 2);
        projectedScore = Math.min(850, projectedScore + avgGain);
        
        projectionTimeline.push({
          step: i + 1,
          itemRemoved: item.creditorName,
          itemType: item.itemTypeName,
          pointsGained: avgGain,
          cumulativeScore: projectedScore,
          scoreCategory: creditScoreService.interpretScoreRange(projectedScore)
        });
      }

      return {
        currentAverageScore: avgScore,
        currentCategory: creditScoreService.interpretScoreRange(avgScore),
        totalNegativeItems,
        itemImpacts,
        projectionTimeline,
        bestCaseScore: Math.min(850, avgScore + itemImpacts.reduce((sum, item) => sum + item.estimatedImpact.estimatedMax, 0)),
        conservativeScore: Math.min(850, avgScore + itemImpacts.reduce((sum, item) => sum + item.estimatedImpact.estimatedMin, 0)),
        topPriorityItems: itemImpacts.slice(0, 3)
      };
    } catch (error) {
      console.error('Error projecting improvement:', error);
      throw error;
    }
  },

  /**
   * Get detailed score factors with weighting
   */
  getDetailedFactors: async (clientId) => {
    try {
      // FICO score factor weights (approximate)
      const FACTOR_WEIGHTS = {
        payment_history: { weight: 35, description: 'Payment History (35%)' },
        credit_utilization: { weight: 30, description: 'Credit Utilization (30%)' },
        credit_age: { weight: 15, description: 'Length of Credit History (15%)' },
        credit_mix: { weight: 10, description: 'Credit Mix (10%)' },
        new_credit: { weight: 10, description: 'New Credit / Inquiries (10%)' }
      };

      // Analyze payment history impact
      const paymentResult = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE item_type = 'late_payment' AND status NOT IN ('resolved', 'deleted')) as active_late_payments,
          COUNT(*) FILTER (WHERE item_type = 'late_payment' AND status IN ('resolved', 'deleted')) as resolved_late_payments,
          COUNT(*) FILTER (WHERE item_type IN ('collection', 'charge_off') AND status NOT IN ('resolved', 'deleted')) as active_derogatory,
          COUNT(*) FILTER (WHERE item_type IN ('collection', 'charge_off') AND status IN ('resolved', 'deleted')) as resolved_derogatory
         FROM credit_items WHERE client_id = $1`,
        [clientId]
      );

      const payment = paymentResult.rows[0];

      // Analyze credit age
      const ageResult = await query(
        `SELECT 
          MIN(date_opened) as oldest_account,
          MAX(date_opened) as newest_account,
          AVG(EXTRACT(EPOCH FROM (NOW() - date_opened)) / 86400 / 365) as avg_age_years
         FROM credit_items 
         WHERE client_id = $1 AND date_opened IS NOT NULL`,
        [clientId]
      );

      // Analyze inquiries
      const inquiryResult = await query(
        `SELECT COUNT(*) as hard_inquiries
         FROM credit_items 
         WHERE client_id = $1 AND item_type = 'inquiry' 
           AND date_reported >= NOW() - INTERVAL '24 months'`,
        [clientId]
      );

      // Build factor analysis
      const factors = {
        paymentHistory: {
          ...FACTOR_WEIGHTS.payment_history,
          status: parseInt(payment.active_late_payments) + parseInt(payment.active_derogatory) === 0 ? 'excellent' : 
                  parseInt(payment.active_late_payments) + parseInt(payment.active_derogatory) <= 2 ? 'fair' : 'poor',
          details: {
            activeLatePayments: parseInt(payment.active_late_payments),
            resolvedLatePayments: parseInt(payment.resolved_late_payments),
            activeDerogatory: parseInt(payment.active_derogatory),
            resolvedDerogatory: parseInt(payment.resolved_derogatory)
          },
          recommendation: parseInt(payment.active_late_payments) + parseInt(payment.active_derogatory) > 0
            ? `You have ${parseInt(payment.active_late_payments) + parseInt(payment.active_derogatory)} active negative items affecting your payment history (35% of your score). Prioritize disputing these for maximum impact.`
            : 'Your payment history appears clean. Keep it up!'
        },
        creditAge: {
          ...FACTOR_WEIGHTS.credit_age,
          status: ageResult.rows[0]?.avg_age_years >= 7 ? 'excellent' : 
                  ageResult.rows[0]?.avg_age_years >= 3 ? 'good' : 'building',
          details: {
            oldestAccount: ageResult.rows[0]?.oldest_account,
            newestAccount: ageResult.rows[0]?.newest_account,
            averageAgeYears: ageResult.rows[0]?.avg_age_years ? parseFloat(ageResult.rows[0].avg_age_years).toFixed(1) : null
          },
          recommendation: 'Keep older accounts open even if unused. Closing old accounts shortens your average credit age.'
        },
        newCredit: {
          ...FACTOR_WEIGHTS.new_credit,
          status: parseInt(inquiryResult.rows[0]?.hard_inquiries) <= 2 ? 'good' : 
                  parseInt(inquiryResult.rows[0]?.hard_inquiries) <= 5 ? 'fair' : 'poor',
          details: {
            hardInquiries24Months: parseInt(inquiryResult.rows[0]?.hard_inquiries || 0)
          },
          recommendation: parseInt(inquiryResult.rows[0]?.hard_inquiries) > 5
            ? `You have ${inquiryResult.rows[0].hard_inquiries} hard inquiries in the last 24 months. Dispute any unauthorized inquiries. Avoid applying for new credit until disputes are resolved.`
            : 'Your inquiry count is within a healthy range.'
        }
      };

      return factors;
    } catch (error) {
      console.error('Error getting detailed factors:', error);
      throw error;
    }
  }
};

module.exports = creditScoreService;
