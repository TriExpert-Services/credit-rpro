/**
 * Credit Score Service
 * FCRA-compliant credit score calculations and tracking
 * Includes historical tracking and factor analysis
 */

const { query } = require('../config/database');

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
      const latestScores = await this.getLatestScores(clientId);
      
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
        interpretation: this.interpretScoreRange(average)
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
      const latestScores = await this.getLatestScores(clientId);
      const factors = await this.getScoreFactors(clientId);
      const comparison = await this.getBureauComparison(clientId);
      
      return {
        clientId,
        reportDate: new Date().toISOString(),
        summary: {
          averageScore: comparison.average,
          bureaus: latestScores,
          trend: 'stable', // Would be calculated
          factors
        },
        recommendations: this.generateRecommendations(comparison.average, factors),
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
   * Generate improvement recommendations
   */
  generateRecommendations: (averageScore, factors) => {
    const recommendations = [];
    
    if (averageScore < 650) {
      recommendations.push({
        priority: 'high',
        action: 'Dispute negative items',
        description: 'Focus on removing inaccurate or outdated items from your credit report'
      });
    }
    
    if (factors.creditItems.some(item => item.item_type === 'late_payment')) {
      recommendations.push({
        priority: 'high',
        action: 'Address late payments',
        description: 'Recent late payments significantly impact your score'
      });
    }
    
    if (factors.creditItems.some(item => item.item_type === 'collection')) {
      recommendations.push({
        priority: 'high',
        action: 'Resolve collections',
        description: 'Collections accounts require immediate attention'
      });
    }
    
    recommendations.push({
      priority: 'medium',
      action: 'Monitor progress',
      description: 'Check score regularly to track improvement'
    });
    
    return recommendations;
  }
};

module.exports = creditScoreService;
