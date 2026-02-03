const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and Word documents are allowed'));
        }
    }
});

// Upload document
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { clientId, disputeId, documentCategory } = req.body;

        const result = await query(
            `INSERT INTO documents (client_id, dispute_id, file_name, file_path, file_type, file_size, document_category)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [clientId, disputeId || null, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, documentCategory]
        );

        res.status(201).json({
            message: 'File uploaded successfully',
            document: result.rows[0]
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Get documents for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM documents 
             WHERE client_id = $1 
             ORDER BY uploaded_at DESC`,
            [req.params.clientId]
        );
        res.json({ documents: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT file_path FROM documents WHERE id = $1', [req.params.id]);
        
        if (result.rows.length > 0) {
            const filePath = result.rows[0].file_path;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await query('DELETE FROM documents WHERE id = $1', [req.params.id]);
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

module.exports = router;
