/**
 * Process Notes Routes
 * Handle apuntes throughout the dispute resolution process
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const processNotesService = require('../utils/processNotesService');

/**
 * GET /api/notes/client/:clientId
 * Get all notes for a client
 */
router.get('/client/:clientId', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const processStage = req.query.stage;
    const limit = req.query.limit || 100;
    
    const notes = await processNotesService.getClientNotes(
      req.params.clientId,
      processStage,
      limit
    );
    
    res.json({
      success: true,
      notes,
      totalCount: notes.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notes/client/:clientId/important
 * Get important notes for a client
 */
router.get('/client/:clientId/important', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const notes = await processNotesService.getImportantNotes(req.params.clientId);
    
    res.json({
      success: true,
      notes,
      importantCount: notes.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notes/client/:clientId/timeline
 * Get timeline view of notes
 */
router.get('/client/:clientId/timeline', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const timeline = await processNotesService.getTimeline(req.params.clientId);
    
    res.json({
      success: true,
      timeline
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notes/client/:clientId/summary
 * Get process stage summary
 */
router.get('/client/:clientId/summary', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const summary = await processNotesService.getStageSummary(req.params.clientId);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notes
 * Create a note
 */
router.post('/', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const { clientId, processStage, noteText, noteCategory, isImportant, relatedEntity } = req.body;
    
    if (!clientId || !processStage || !noteText) {
      return res.status(400).json({
        message: 'Missing required fields: clientId, processStage, noteText'
      });
    }
    
    const note = await processNotesService.createNote(
      clientId,
      req.user.id,
      processStage,
      noteText,
      noteCategory || 'observation',
      isImportant || false,
      relatedEntity
    );
    
    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/notes/:id
 * Update a note
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const { noteText, isImportant } = req.body;
    
    if (!noteText) {
      return res.status(400).json({ message: 'Note text required' });
    }
    
    const note = await processNotesService.updateNote(
      req.params.id,
      noteText,
      isImportant
    );
    
    res.json({
      success: true,
      message: 'Note updated successfully',
      note
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    await processNotesService.deleteNote(req.params.id);
    
    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notes/follow-up
 * Add a follow-up action note
 */
router.post('/follow-up', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const { clientId, actionDescription, dueDate } = req.body;
    
    if (!clientId || !actionDescription) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }
    
    const note = await processNotesService.addFollowUp(
      clientId,
      req.user.id,
      actionDescription,
      dueDate
    );
    
    res.status(201).json({
      success: true,
      message: 'Follow-up note created successfully',
      note
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notes/client/:clientId/export
 * Export notes as document
 */
router.get('/client/:clientId/export', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const format = req.query.format || 'pdf';
    
    const result = await processNotesService.exportNotes(req.params.clientId, format);
    
    res.json({
      success: true,
      export: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notes/client/:clientId/activity-report
 * Get activity report for date range
 */
router.get('/client/:clientId/activity-report', authMiddleware, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const report = await processNotesService.getActivityReport(
      req.params.clientId,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      report,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
