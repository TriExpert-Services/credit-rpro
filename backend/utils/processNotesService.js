/**
 * Process Notes Service
 * Manages detailed notes/apuntes throughout the dispute resolution process
 * Supports multiple process stages and categorization
 */

const { query } = require('../config/database');

const processNotesService = {
  /**
   * Create a process note
   */
  createNote: async (clientId, staffId, processStage, noteText, noteCategory, isImportant = false, relatedEntity = null) => {
    try {
      const result = await query(
        `INSERT INTO process_notes (
          client_id, staff_id, process_stage, note_text, note_category,
          is_important, related_entity_type, related_entity_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at;`,
        [
          clientId,
          staffId,
          processStage,
          noteText,
          noteCategory,
          isImportant,
          relatedEntity?.type || null,
          relatedEntity?.id || null
        ]
      );
      
      const note = result.rows[0];
      
      // Log to activity
      await query(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
         VALUES ($1, 'Process note created', 'process_notes', $2, $3)`,
        [staffId, note.id, `Stage: ${processStage} - Category: ${noteCategory}`]
      );
      
      console.log(`✅ Process note created: ${clientId} - ${processStage}`);
      return note;
    } catch (error) {
      console.error('Error creating process note:', error);
      throw error;
    }
  },

  /**
   * Get all notes for a client
   */
  getClientNotes: async (clientId, processStage = null, limit = 100) => {
    try {
      let query_text = 'SELECT * FROM process_notes WHERE client_id = $1';
      const params = [clientId];
      
      if (processStage) {
        query_text += ' AND process_stage = $2';
        params.push(processStage);
      }
      
      query_text += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await query(query_text, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting client notes:', error);
      throw error;
    }
  },

  /**
   * Get notes by process stage
   */
  getNotesByStage: async (clientId, processStage) => {
    try {
      const result = await query(
        `SELECT * FROM process_notes
         WHERE client_id = $1 AND process_stage = $2
         ORDER BY created_at DESC`,
        [clientId, processStage]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting notes by stage:', error);
      throw error;
    }
  },

  /**
   * Get important notes (flagged)
   */
  getImportantNotes: async (clientId) => {
    try {
      const result = await query(
        `SELECT * FROM process_notes
         WHERE client_id = $1 AND is_important = true
         ORDER BY created_at DESC`,
        [clientId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting important notes:', error);
      throw error;
    }
  },

  /**
   * Get timeline of notes
   */
  getTimeline: async (clientId) => {
    try {
      const result = await query(
        `SELECT 
          created_at,
          process_stage,
          note_category,
          note_text,
          is_important,
          (SELECT first_name || ' ' || last_name FROM users WHERE id = staff_id) as staff_name
         FROM process_notes
         WHERE client_id = $1
         ORDER BY created_at ASC`,
        [clientId]
      );
      
      // Group by process stage for better visualization
      const timeline = {};
      result.rows.forEach(note => {
        if (!timeline[note.process_stage]) {
          timeline[note.process_stage] = [];
        }
        timeline[note.process_stage].push(note);
      });
      
      return timeline;
    } catch (error) {
      console.error('Error getting timeline:', error);
      throw error;
    }
  },

  /**
   * Update a note
   */
  updateNote: async (noteId, noteText, isImportant = null) => {
    try {
      const result = await query(
        `UPDATE process_notes
         SET note_text = $1, updated_at = CURRENT_TIMESTAMP
           ${isImportant !== null ? ', is_important = ' + isImportant : ''}
         WHERE id = $2
         RETURNING id, updated_at;`,
        [noteText, noteId]
      );
      
      console.log(`✅ Process note updated: ${noteId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating process note:', error);
      throw error;
    }
  },

  /**
   * Delete a note
   */
  deleteNote: async (noteId) => {
    try {
      await query(
        'DELETE FROM process_notes WHERE id = $1',
        [noteId]
      );
      
      console.log(`✅ Process note deleted: ${noteId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting process note:', error);
      throw error;
    }
  },

  /**
   * Add follow-up action note
   */
  addFollowUp: async (clientId, staffId, actionDescription, dueDate = null) => {
    try {
      const result = await query(
        `INSERT INTO process_notes (
          client_id, staff_id, process_stage, note_text, note_category, is_important
        ) VALUES ($1, $2, 'follow_up', $3, 'action_item', true)
         RETURNING id;`,
        [clientId, staffId, `Follow-up: ${actionDescription}\nDue: ${dueDate || 'ASAP'}`]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding follow-up:', error);
      throw error;
    }
  },

  /**
   * Get stage summary
   */
  getStageSummary: async (clientId) => {
    try {
      const stages = [
        'intake',
        'profile',
        'analysis',
        'strategy',
        'disputes',
        'follow_up',
        'resolution'
      ];
      
      const summary = {};
      
      for (const stage of stages) {
        const notesResult = await query(
          `SELECT COUNT(*) as count, 
                  MAX(created_at) as last_note
           FROM process_notes
           WHERE client_id = $1 AND process_stage = $2`,
          [clientId, stage]
        );
        
        const noteCount = notesResult.rows[0];
        summary[stage] = {
          noteCount: parseInt(noteCount.count),
          lastNoteDate: noteCount.last_note,
          completed: parseInt(noteCount.count) > 0
        };
      }
      
      return summary;
    } catch (error) {
      console.error('Error getting stage summary:', error);
      throw error;
    }
  },

  /**
   * Export notes as document
   */
  exportNotes: async (clientId, format = 'pdf') => {
    try {
      const timeline = await this.getTimeline(clientId);
      
      // Build document content
      let content = `CLIENT PROCESS NOTES - ${new Date().toLocaleDateString()}\n\n`;
      
      Object.keys(timeline).forEach(stage => {
        content += `\n=== ${stage.toUpperCase()} ===\n`;
        timeline[stage].forEach(note => {
          content += `\n[${new Date(note.created_at).toLocaleDateString()}] `;
          if (note.is_important) content += '[★ IMPORTANT] ';
          content += `(${note.note_category})\n`;
          content += `${note.note_text}\n`;
          if (note.staff_name) content += `By: ${note.staff_name}\n`;
        });
      });
      
      return {
        success: true,
        content,
        format,
        fileName: `client_notes_${clientId}_${Date.now()}.${format === 'pdf' ? 'pdf' : 'txt'}`
      };
    } catch (error) {
      console.error('Error exporting notes:', error);
      throw error;
    }
  },

  /**
   * Get activity report for a date range
   */
  getActivityReport: async (clientId, startDate, endDate) => {
    try {
      const result = await query(
        `SELECT 
          DATE(created_at) as activity_date,
          process_stage,
          COUNT(*) as note_count,
          COUNT(CASE WHEN is_important THEN 1 END) as important_count,
          COUNT(CASE WHEN note_category = 'action_item' THEN 1 END) as action_items
         FROM process_notes
         WHERE client_id = $1 
         AND created_at >= $2 
         AND created_at <= $3
         GROUP BY DATE(created_at), process_stage
         ORDER BY activity_date DESC`,
        [clientId, startDate, endDate]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting activity report:', error);
      throw error;
    }
  }
};

module.exports = processNotesService;
