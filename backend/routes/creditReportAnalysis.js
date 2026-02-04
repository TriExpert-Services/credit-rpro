/**
 * Credit Report Analysis Routes
 * Handles AI-powered credit report analysis and dispute generation
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const creditReportAnalyzer = require('../utils/creditReportAnalyzer');
const { generateDisputeLetter } = require('../utils/openaiService');

// Configure multer for credit report uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/credit-reports';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for reports
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/msword'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, images, text, and Word documents are allowed'));
    }
  }
});

/**
 * POST /upload-and-analyze
 * Upload credit report(s) and analyze with AI
 */
router.post('/upload-and-analyze', authenticateToken, upload.array('reports', 3), async (req, res) => {
  try {
    const { bureaus } = req.body; // JSON array: ["experian", "equifax", "transunion"]
    const clientId = req.user.role === 'admin' ? req.body.clientId : req.user.id;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const bureauList = typeof bureaus === 'string' ? JSON.parse(bureaus) : bureaus || [];
    const reports = [];

    // Save documents to database and prepare for analysis
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const bureau = bureauList[i] || 'unknown';

      // Insert document record
      const docResult = await query(
        `INSERT INTO documents (client_id, file_name, file_path, file_type, document_category)
         VALUES ($1, $2, $3, $4, 'credit_report')
         RETURNING id`,
        [clientId, file.originalname, file.path, file.mimetype]
      );

      reports.push({
        filePath: file.path,
        bureau: bureau,
        documentId: docResult.rows[0].id
      });
    }

    // Analyze all reports
    const analysisResult = await creditReportAnalyzer.analyzeMultipleReports(clientId, reports);

    res.json({
      success: analysisResult.success,
      message: analysisResult.success 
        ? `Successfully analyzed ${analysisResult.bureausAnalyzed.length} credit report(s)` 
        : 'Analysis completed with some errors',
      data: {
        bureausAnalyzed: analysisResult.bureausAnalyzed,
        scores: analysisResult.scores,
        totalItemsFound: analysisResult.totalItemsFound,
        items: analysisResult.allItems,
        errors: analysisResult.errors
      }
    });

  } catch (error) {
    console.error('Upload and analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /analyze/:documentId
 * Analyze an existing uploaded document
 */
router.post('/analyze/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { bureau } = req.body;

    // Get document info
    const docResult = await query(
      `SELECT d.*, c.id as client_id 
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docResult.rows[0];

    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== doc.client_id) {
      return res.status(403).json({ error: 'Not authorized to analyze this document' });
    }

    // Process the report
    const result = await creditReportAnalyzer.processUploadedReport(
      doc.client_id,
      doc.file_path,
      bureau || 'unknown',
      documentId
    );

    res.json(result);

  } catch (error) {
    console.error('Analyze document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /items/:clientId
 * Get all credit items for a client
 */
router.get('/items/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query(
      `SELECT ci.*, 
              d.status as dispute_status,
              d.id as dispute_id,
              d.letter_content
       FROM credit_items ci
       LEFT JOIN disputes d ON ci.id = d.credit_item_id
       WHERE ci.client_id = $1
       ORDER BY ci.created_at DESC`,
      [clientId]
    );

    res.json({ items: result.rows });

  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /scores/:clientId
 * Get credit score history for a client
 */
router.get('/scores/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get latest scores by bureau
    const latestScores = await query(
      `SELECT DISTINCT ON (bureau) bureau, score, score_date, notes
       FROM credit_scores 
       WHERE client_id = $1
       ORDER BY bureau, score_date DESC`,
      [clientId]
    );

    // Get score history for chart (last 12 months)
    const scoreHistory = await query(
      `SELECT bureau, score, score_date
       FROM credit_scores 
       WHERE client_id = $1 
       AND score_date >= NOW() - INTERVAL '12 months'
       ORDER BY score_date ASC`,
      [clientId]
    );

    // Calculate score improvement
    const firstScores = await query(
      `SELECT DISTINCT ON (bureau) bureau, score
       FROM credit_scores 
       WHERE client_id = $1
       ORDER BY bureau, score_date ASC`,
      [clientId]
    );

    const improvements = {};
    for (const first of firstScores.rows) {
      const latest = latestScores.rows.find(s => s.bureau === first.bureau);
      if (latest) {
        improvements[first.bureau] = latest.score - first.score;
      }
    }

    res.json({
      latestScores: latestScores.rows,
      scoreHistory: scoreHistory.rows,
      improvements,
      averageScore: latestScores.rows.length > 0 
        ? Math.round(latestScores.rows.reduce((sum, s) => sum + s.score, 0) / latestScores.rows.length)
        : null
    });

  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /summary/:clientId
 * Get complete analysis summary for a client (for dashboard)
 */
router.get('/summary/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const summary = await creditReportAnalyzer.getClientAnalysisSummary(clientId);

    // Get dispute stats
    const disputeStats = await query(
      `SELECT status, COUNT(*) as count
       FROM disputes 
       WHERE client_id = $1
       GROUP BY status`,
      [clientId]
    );

    // Get recent activity
    const recentActivity = await query(
      `SELECT action, description, created_at
       FROM activity_log 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [clientId]
    );

    res.json({
      ...summary,
      disputeStats: disputeStats.rows,
      recentActivity: recentActivity.rows
    });

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /generate-disputes/:clientId
 * Generate dispute letters for all identified negative items
 */
router.post('/generate-disputes/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { itemIds, disputeType = 'inaccurate_info' } = req.body;
    
    // Check permissions (admin/staff only for bulk generation)
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only admin or staff can generate bulk disputes' });
    }

    // Get client info
    const clientResult = await query(
      `SELECT u.*, c.ssn_last_four, c.date_of_birth, c.address, c.city, c.state, c.zip_code
       FROM users u
       LEFT JOIN clients c ON u.id = c.user_id
       WHERE u.id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult.rows[0];

    // Get credit items to dispute
    let itemsQuery = `
      SELECT ci.* FROM credit_items ci
      LEFT JOIN disputes d ON ci.id = d.credit_item_id
      WHERE ci.client_id = $1 AND ci.status = 'identified'
    `;
    const params = [clientId];

    if (itemIds && itemIds.length > 0) {
      itemsQuery += ` AND ci.id = ANY($2)`;
      params.push(itemIds);
    }

    const itemsResult = await query(itemsQuery, params);

    if (itemsResult.rows.length === 0) {
      return res.json({ message: 'No items to dispute', disputesGenerated: 0 });
    }

    const generatedDisputes = [];
    const errors = [];

    // Generate dispute letter for each item
    for (const item of itemsResult.rows) {
      try {
        const clientData = {
          firstName: client.first_name,
          lastName: client.last_name,
          address: client.address,
          city: client.city,
          state: client.state,
          zipCode: client.zip_code,
          ssn: client.ssn_last_four ? `XXX-XX-${client.ssn_last_four}` : 'XXX-XX-XXXX',
          dob: client.date_of_birth
        };

        const creditItemData = {
          creditorName: item.creditor_name,
          accountNumber: item.account_number,
          balance: item.balance,
          status: item.status,
          description: item.description
        };

        // Generate letter with AI
        const letter = await generateDisputeLetter(
          clientData,
          creditItemData,
          item.bureau,
          disputeType,
          item.description
        );

        // Save dispute
        const disputeResult = await query(
          `INSERT INTO disputes (client_id, credit_item_id, dispute_type, bureau, letter_content, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING *`,
          [clientId, item.id, disputeType, item.bureau, letter]
        );

        // Update credit item status
        await query(
          `UPDATE credit_items SET status = 'in_dispute' WHERE id = $1`,
          [item.id]
        );

        generatedDisputes.push({
          disputeId: disputeResult.rows[0].id,
          itemId: item.id,
          creditor: item.creditor_name,
          bureau: item.bureau
        });

      } catch (letterError) {
        console.error(`Error generating letter for item ${item.id}:`, letterError);
        errors.push({ itemId: item.id, error: letterError.message });
      }
    }

    // Log activity
    await query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, 'disputes_generated', 'client', $2, $3)`,
      [req.user.id, clientId, `Generated ${generatedDisputes.length} dispute letters for client`]
    );

    res.json({
      success: true,
      message: `Generated ${generatedDisputes.length} dispute letters`,
      disputesGenerated: generatedDisputes.length,
      disputes: generatedDisputes,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Generate disputes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /add-score
 * Manually add a credit score (for tracking purposes)
 */
router.post('/add-score', authenticateToken, async (req, res) => {
  try {
    const { clientId, bureau, score, scoreDate, notes } = req.body;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!bureau || !score) {
      return res.status(400).json({ error: 'Bureau and score are required' });
    }

    const result = await query(
      `INSERT INTO credit_scores (client_id, bureau, score, score_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, bureau.toLowerCase(), score, scoreDate || new Date(), notes || 'Manually entered']
    );

    // Audit log
    await query(
      `INSERT INTO credit_score_audit (client_id, bureau, new_score, data_source)
       VALUES ($1, $2, $3, 'manual_entry')`,
      [clientId, bureau.toLowerCase(), score]
    );

    res.json({ 
      success: true, 
      score: result.rows[0] 
    });

  } catch (error) {
    console.error('Add score error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /items/:itemId
 * Update a credit item (status, notes, etc)
 */
router.put('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status, description } = req.body;
    
    // Verify ownership
    const itemResult = await query(
      `SELECT ci.*, c.id as client_id 
       FROM credit_items ci
       LEFT JOIN clients c ON ci.client_id = c.id
       WHERE ci.id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== itemResult.rows[0].client_id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    params.push(itemId);

    const result = await query(
      `UPDATE credit_items SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    res.json({ success: true, item: result.rows[0] });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /items/:itemId
 * Delete a credit item
 */
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Verify ownership
    const itemResult = await query(
      `SELECT ci.* FROM credit_items ci WHERE ci.id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only admin/staff can delete
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only admin or staff can delete items' });
    }

    // Delete associated disputes first
    await query(`DELETE FROM disputes WHERE credit_item_id = $1`, [itemId]);
    
    // Delete item
    await query(`DELETE FROM credit_items WHERE id = $1`, [itemId]);

    res.json({ success: true, message: 'Item deleted' });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
