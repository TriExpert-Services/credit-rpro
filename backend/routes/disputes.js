const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Dispute letter templates
const disputeTemplates = {
    not_mine: (client, item, bureau) => `
${new Date().toLocaleDateString()}

${bureau.toUpperCase()} Credit Bureau
P.O. Box [Address based on bureau]

Re: Dispute of Inaccurate Information

Dear Sir/Madam,

I am writing to dispute the following information in my credit file. The items I dispute are circled on the attached copy of my credit report.

Account: ${item.creditor_name}
Account Number: ${item.account_number || 'N/A'}

This item is inaccurate because this account does not belong to me. I have never opened an account with ${item.creditor_name}, and I did not authorize anyone to open this account on my behalf.

I am requesting that you remove this item from my credit report as it is not mine and is damaging my credit score.

Please conduct a complete investigation of my dispute and remove the inaccurate information as soon as possible.

Sincerely,

${client.first_name} ${client.last_name}
${client.address_line1}
${client.city}, ${client.state} ${client.zip_code}
SSN: XXX-XX-${client.ssn_last_4 || 'XXXX'}
`,
    inaccurate_info: (client, item, bureau) => `
${new Date().toLocaleDateString()}

${bureau.toUpperCase()} Credit Bureau

Re: Request for Investigation - Inaccurate Information

Dear Credit Bureau,

I recently reviewed my credit report and found inaccurate information that needs to be corrected immediately.

The following account contains errors:
Creditor: ${item.creditor_name}
Account: ${item.account_number || 'N/A'}
Issue: ${item.description || 'Contains inaccurate information'}

Under the Fair Credit Reporting Act, I have the right to dispute inaccurate information. I request that you investigate this matter and remove or correct the inaccurate data within 30 days.

Please send me written confirmation of your investigation results and any corrections made to my credit file.

Respectfully,

${client.first_name} ${client.last_name}
${client.address_line1}
${client.city}, ${client.state} ${client.zip_code}
`
};

// Get all disputes for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT d.*, ci.creditor_name, ci.account_number
             FROM disputes d
             LEFT JOIN credit_items ci ON d.credit_item_id = ci.id
             WHERE d.client_id = $1
             ORDER BY d.created_at DESC`,
            [req.params.clientId]
        );
        res.json({ disputes: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch disputes' });
    }
});

// Create new dispute with letter
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { clientId, creditItemId, disputeType, bureau } = req.body;

        // Get client and credit item info
        const clientResult = await query(
            `SELECT u.first_name, u.last_name, cp.address_line1, cp.city, cp.state, cp.zip_code, cp.ssn_last_4
             FROM users u
             JOIN client_profiles cp ON u.id = cp.user_id
             WHERE u.id = $1`,
            [clientId]
        );

        const itemResult = await query(
            'SELECT * FROM credit_items WHERE id = $1',
            [creditItemId]
        );

        if (clientResult.rows.length === 0 || itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client or credit item not found' });
        }

        const client = clientResult.rows[0];
        const item = itemResult.rows[0];

        // Generate letter content
        const letterTemplate = disputeTemplates[disputeType] || disputeTemplates.inaccurate_info;
        const letterContent = letterTemplate(client, item, bureau);

        // Create dispute record
        const result = await query(
            `INSERT INTO disputes (client_id, credit_item_id, dispute_type, bureau, letter_content, status)
             VALUES ($1, $2, $3, $4, $5, 'draft')
             RETURNING *`,
            [clientId, creditItemId, disputeType, bureau, letterContent]
        );

        // Update credit item status
        await query(
            `UPDATE credit_items SET status = 'disputing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [creditItemId]
        );

        res.status(201).json({ 
            message: 'Dispute created successfully',
            dispute: result.rows[0] 
        });
    } catch (error) {
        console.error('Create dispute error:', error);
        res.status(500).json({ error: 'Failed to create dispute' });
    }
});

// Update dispute status
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status, sentDate, responseDate, responseText, trackingNumber } = req.body;

        await query(
            `UPDATE disputes 
             SET status = COALESCE($1, status),
                 sent_date = COALESCE($2, sent_date),
                 response_date = COALESCE($3, response_date),
                 response_text = COALESCE($4, response_text),
                 tracking_number = COALESCE($5, tracking_number),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [status, sentDate, responseDate, responseText, trackingNumber, req.params.id]
        );

        res.json({ message: 'Dispute updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update dispute' });
    }
});

// Get dispute by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT d.*, ci.creditor_name, ci.account_number,
                    u.first_name, u.last_name
             FROM disputes d
             LEFT JOIN credit_items ci ON d.credit_item_id = ci.id
             LEFT JOIN users u ON d.client_id = u.id
             WHERE d.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dispute not found' });
        }

        res.json({ dispute: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch dispute' });
    }
});

module.exports = router;
