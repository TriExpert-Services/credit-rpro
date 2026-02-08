/**
 * Documents Routes - Secured with ownership checks and file validation
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const { DOCUMENT_CATEGORIES, MAX_FILE_SIZE } = require('../utils/validators');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendForbidden,
  asyncHandler,
} = require('../utils/responseHelpers');

// Configure multer for secure file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use crypto for unpredictable filenames
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `doc-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG), PDFs, and Word documents are allowed'));
        }
    }
});

// Upload document (with ownership check)
router.post(
  '/upload',
  authenticateToken,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return sendError(res, 'No file uploaded');
    }

    const { clientId, disputeId, documentCategory } = req.body;

    // Clients can only upload to their own profile
    if (req.user.role === 'client' && req.user.id !== clientId) {
      // Delete the uploaded file since access is denied
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return sendForbidden(res, 'Access denied');
    }

    // Validate document category
    if (documentCategory && !DOCUMENT_CATEGORIES.includes(documentCategory.toLowerCase())) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return sendError(res, `Category must be one of: ${DOCUMENT_CATEGORIES.join(', ')}`);
    }

    const result = await query(
      `INSERT INTO documents (client_id, dispute_id, file_name, file_path, file_type, file_size, document_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, client_id, dispute_id, file_name, file_type, file_size, document_category, uploaded_at`,
      [clientId, disputeId || null, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, documentCategory || 'other']
    );

    sendCreated(res, { document: result.rows[0] }, 'File uploaded successfully');
  })
);

// Get documents for a client (with ownership check)
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    // Clients can only view their own documents
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    const result = await query(
      `SELECT id, client_id, dispute_id, file_name, file_type, file_size, document_category, uploaded_at
       FROM documents 
       WHERE client_id = $1 
       ORDER BY uploaded_at DESC`,
      [clientId]
    );

    sendSuccess(res, { documents: result.rows });
  })
);

// Download/view a document (with ownership check)
router.get(
  '/:id/download',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await query(
      'SELECT id, client_id, file_name, file_path, file_type FROM documents WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Document');
    }

    const doc = result.rows[0];

    // Verify ownership
    if (req.user.role === 'client' && req.user.id !== doc.client_id) {
      return sendForbidden(res, 'Access denied');
    }

    // Validate file path is within uploads directory
    const uploadsDir = path.resolve(path.join(__dirname, '../uploads'));
    const resolvedPath = path.resolve(doc.file_path);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return sendError(res, 'Invalid file path', 400);
    }

    if (!fs.existsSync(resolvedPath)) {
      return sendNotFound(res, 'File');
    }

    res.download(resolvedPath, doc.file_name);
  })
);

// Delete document (with ownership check and safe file deletion)
router.delete(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await query(
      'SELECT id, client_id, file_path FROM documents WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Document');
    }

    const doc = result.rows[0];

    // Verify ownership
    if (req.user.role === 'client' && req.user.id !== doc.client_id) {
      return sendForbidden(res, 'Access denied');
    }

    // Safe file deletion - verify path is within uploads directory
    if (doc.file_path) {
      const uploadsDir = path.resolve(path.join(__dirname, '../uploads'));
      const resolvedPath = path.resolve(doc.file_path);
      if (resolvedPath.startsWith(uploadsDir) && fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    }

    await query(
      `UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    sendSuccess(res, {}, 'Document deleted successfully');
  })
);

module.exports = router;
