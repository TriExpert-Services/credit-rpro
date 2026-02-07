/**
 * Compliance Routes
 * Complete CROA, FCRA, GLBA Compliance API
 * Full audit trail and legal record keeping
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateToken = require('../middleware/auth');

// =====================================================
// SIGN CONTRACT
// Records digital signature with full audit trail
// =====================================================
router.post('/sign-contract', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const {
      contractType,
      signature,
      acknowledgments,
      signedAt,
      effectiveDate
    } = req.body;

    // Validate required fields
    if (!signature || !acknowledgments) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere firma y reconocimientos'
      });
    }

    // Verify signature matches user name
    const userResult = await client.query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    
    if (signature.toLowerCase() !== fullName) {
      return res.status(400).json({
        success: false,
        error: 'La firma debe coincidir con su nombre completo'
      });
    }

    await client.query('BEGIN');

    // Calculate 3-day cancellation deadline
    const signDate = new Date(signedAt);
    const cancellationDeadline = new Date(signDate);
    cancellationDeadline.setDate(cancellationDeadline.getDate() + 3);
    
    // Skip weekends for cancellation period
    while (cancellationDeadline.getDay() === 0 || cancellationDeadline.getDay() === 6) {
      cancellationDeadline.setDate(cancellationDeadline.getDate() + 1);
    }

    // Insert contract record
    const contractResult = await client.query(`
      INSERT INTO client_contracts (
        client_id, 
        contract_type,
        signed_date,
        signed_at,
        effective_date,
        cancellation_deadline,
        digital_signature,
        ip_address,
        user_agent,
        acknowledgments,
        status
      ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING id, cancellation_deadline
    `, [
      userId,
      contractType || 'service_agreement',
      signedAt,
      effectiveDate || signedAt,
      cancellationDeadline.toISOString(),
      signature,
      req.ip || req.connection?.remoteAddress || 'unknown',
      req.headers['user-agent'] || 'unknown',
      JSON.stringify(acknowledgments)
    ]);

    const contractId = contractResult.rows[0].id;

    // Record consumer rights acknowledgment
    await client.query(`
      INSERT INTO consumer_rights_acknowledgments (
        user_id,
        client_id,
        contract_id,
        acknowledged_at,
        version,
        ip_address,
        acknowledgment_data
      ) VALUES ($1, $1, $2, $3, '1.0', $4, $5)
      ON CONFLICT (user_id, version) DO UPDATE SET
        acknowledged_at = EXCLUDED.acknowledged_at,
        contract_id = EXCLUDED.contract_id,
        ip_address = EXCLUDED.ip_address,
        acknowledgment_data = EXCLUDED.acknowledgment_data
    `, [userId, contractId, signedAt, req.ip || 'unknown', JSON.stringify(acknowledgments)]);

    // Log compliance event
    await client.query(`
      INSERT INTO compliance_events (
        user_id,
        client_id,
        event_type,
        compliance_law,
        description,
        metadata,
        ip_address
      ) VALUES ($1, $1, 'contract_signed', 'CROA', 'Cliente firmó contrato de servicio', $2, $3)
    `, [
      userId,
      JSON.stringify({
        contractId,
        contractType,
        signedAt,
        cancellationDeadline: cancellationDeadline.toISOString(),
        acknowledgments
      }),
      req.ip || 'unknown'
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        contractId,
        signedAt,
        cancellationDeadline: cancellationDeadline.toISOString(),
        message: 'Contrato firmado exitosamente'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Contract sign error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar la firma del contrato'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// ACKNOWLEDGE CONSUMER RIGHTS
// Records that user has read and understood CROA rights
// =====================================================
router.post('/acknowledge-rights', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { 
      acknowledgedAt, 
      rightsVersion = '1.0',
      acknowledgments 
    } = req.body;

    await client.query('BEGIN');

    // Insert or update rights acknowledgment
    const result = await client.query(`
      INSERT INTO consumer_rights_acknowledgments (
        user_id,
        client_id,
        acknowledged_at,
        version,
        acknowledgment_data,
        ip_address
      ) VALUES ($1, $1, $2, $3, $4, $5)
      ON CONFLICT (user_id, version) DO UPDATE SET
        acknowledged_at = EXCLUDED.acknowledged_at,
        acknowledgment_data = EXCLUDED.acknowledgment_data,
        ip_address = EXCLUDED.ip_address
      RETURNING id
    `, [
      userId,
      acknowledgedAt || new Date().toISOString(),
      rightsVersion,
      JSON.stringify(acknowledgments),
      req.ip || 'unknown'
    ]);

    // Log compliance event
    await client.query(`
      INSERT INTO compliance_events (
        user_id,
        client_id,
        event_type,
        compliance_law,
        description,
        metadata,
        ip_address
      ) VALUES ($1, $1, 'rights_acknowledged', 'CROA', 'Cliente reconoció derechos del consumidor', $2, $3)
    `, [
      userId,
      JSON.stringify({
        acknowledgedAt,
        rightsVersion,
        acknowledgments
      }),
      req.ip || 'unknown'
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        acknowledgmentId: result.rows[0].id,
        acknowledgedAt,
        message: 'Derechos del consumidor reconocidos'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rights acknowledgment error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el reconocimiento'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// ACKNOWLEDGE FEES
// Records fee disclosure acknowledgment before payment
// =====================================================
router.post('/acknowledge-fees', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const {
      planType,
      totalAmount,
      currency = 'USD',
      paymentSchedule,
      acknowledgments,
      acknowledgedAt
    } = req.body;

    await client.query('BEGIN');

    // Insert fee disclosure record
    const result = await client.query(`
      INSERT INTO fee_disclosures (
        user_id,
        client_id,
        plan_type,
        total_cost,
        service_description,
        payment_schedule,
        disclosed_at,
        acknowledged,
        acknowledged_at,
        acknowledgment_data,
        ip_address
      ) VALUES ($1, $1, $2, $3, $4, $5, $6, true, $6, $7, $8)
      RETURNING id
    `, [
      userId,
      planType,
      totalAmount,
      `Plan ${planType} - Servicio de reparación de crédito`,
      paymentSchedule || 'monthly',
      acknowledgedAt || new Date().toISOString(),
      JSON.stringify(acknowledgments),
      req.ip || 'unknown'
    ]);

    // Log compliance event
    await client.query(`
      INSERT INTO compliance_events (
        user_id,
        client_id,
        event_type,
        compliance_law,
        description,
        metadata,
        ip_address
      ) VALUES ($1, $1, 'fees_acknowledged', 'CROA', 'Cliente reconoció divulgación de tarifas', $2, $3)
    `, [
      userId,
      JSON.stringify({
        planType,
        totalAmount,
        currency,
        paymentSchedule,
        acknowledgedAt
      }),
      req.ip || 'unknown'
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        disclosureId: result.rows[0].id,
        acknowledgedAt,
        message: 'Divulgación de tarifas reconocida'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fee acknowledgment error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar la divulgación de tarifas'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// GET COMPLIANCE STATUS
// Returns complete compliance status for a user
// =====================================================
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get latest contract
    const contractResult = await pool.query(`
      SELECT id, contract_type, signed_date, signed_at, effective_date, 
             cancellation_deadline, status, cancelled_at
      FROM client_contracts 
      WHERE client_id = $1 
      ORDER BY signed_date DESC 
      LIMIT 1
    `, [userId]);

    // Get rights acknowledgments
    const rightsResult = await pool.query(`
      SELECT id, acknowledged_at, version
      FROM consumer_rights_acknowledgments
      WHERE user_id = $1
      ORDER BY acknowledged_at DESC
      LIMIT 1
    `, [userId]);

    // Get fee disclosures
    const feesResult = await pool.query(`
      SELECT id, plan_type, total_cost, acknowledged_at
      FROM fee_disclosures
      WHERE user_id = $1
      ORDER BY acknowledged_at DESC
      LIMIT 1
    `, [userId]);

    // Calculate compliance status
    const hasContract = contractResult.rows.length > 0;
    const hasRightsAck = rightsResult.rows.length > 0;
    const hasFeesAck = feesResult.rows.length > 0;
    
    const contract = hasContract ? contractResult.rows[0] : null;
    const canCancel = contract && 
      contract.status === 'active' && 
      new Date() <= new Date(contract.cancellation_deadline);

    res.json({
      success: true,
      data: {
        isCompliant: hasContract && hasRightsAck && hasFeesAck,
        contract: hasContract ? {
          id: contract.id,
          type: contract.contract_type,
          signedAt: contract.signed_at || contract.signed_date,
          effectiveDate: contract.effective_date,
          cancellationDeadline: contract.cancellation_deadline,
          status: contract.status,
          canCancel
        } : null,
        rightsAcknowledgment: hasRightsAck ? {
          id: rightsResult.rows[0].id,
          acknowledgedAt: rightsResult.rows[0].acknowledged_at,
          version: rightsResult.rows[0].version
        } : null,
        feeDisclosure: hasFeesAck ? {
          id: feesResult.rows[0].id,
          planType: feesResult.rows[0].plan_type,
          amount: feesResult.rows[0].total_cost,
          acknowledgedAt: feesResult.rows[0].acknowledged_at
        } : null
      }
    });

  } catch (error) {
    console.error('Compliance status error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de cumplimiento'
    });
  }
});

// =====================================================
// GET COMPLIANCE EVENTS (Admin)
// Full audit trail for admin review
// =====================================================
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Check if admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    const isAdmin = userResult.rows[0]?.role === 'admin';
    
    // Query based on role
    const query = isAdmin
      ? `SELECT ce.*, u.email, u.first_name, u.last_name
         FROM compliance_events ce
         JOIN users u ON ce.user_id = u.id
         ORDER BY ce.created_at DESC
         LIMIT $1 OFFSET $2`
      : `SELECT * FROM compliance_events 
         WHERE user_id = $1 
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`;

    const params = isAdmin 
      ? [parseInt(limit), parseInt(offset)]
      : [userId, parseInt(limit), parseInt(offset)];

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Compliance events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener eventos de cumplimiento'
    });
  }
});

// =====================================================
// CANCEL CONTRACT
// Process contract cancellation with 3-day rule
// =====================================================
router.post('/cancel-contract', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { contractId, reason, cancelledAt } = req.body;

    // Get contract
    const contractResult = await client.query(`
      SELECT * FROM client_contracts 
      WHERE id = $1 AND client_id = $2
    `, [contractId, userId]);

    if (!contractResult.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Contrato no encontrado'
      });
    }

    const contract = contractResult.rows[0];

    if (contract.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'El contrato ya no está activo'
      });
    }

    const now = new Date();
    const deadline = new Date(contract.cancellation_deadline);
    const isWithinCancellationPeriod = now <= deadline;

    await client.query('BEGIN');

    // Update contract
    await client.query(`
      UPDATE client_contracts 
      SET status = 'cancelled',
          cancelled_at = $1,
          cancellation_reason = $2
      WHERE id = $3
    `, [cancelledAt || now.toISOString(), reason, contractId]);

    // Record cancellation request
    await client.query(`
      INSERT INTO cancellation_requests (
        user_id,
        client_id,
        contract_id,
        requested_at,
        processed_at,
        reason,
        within_3_day_period,
        status
      ) VALUES ($1, $1, $2, $3, $3, $4, $5, 'approved')
    `, [
      userId,
      contractId,
      cancelledAt || now.toISOString(),
      reason,
      isWithinCancellationPeriod
    ]);

    // Log compliance event
    await client.query(`
      INSERT INTO compliance_events (
        user_id,
        client_id,
        event_type,
        compliance_law,
        description,
        metadata,
        ip_address
      ) VALUES ($1, $1, 'contract_cancelled', 'CROA', 'Cliente canceló contrato', $2, $3)
    `, [
      userId,
      JSON.stringify({
        contractId,
        reason,
        withinCancellationPeriod: isWithinCancellationPeriod,
        cancelledAt: cancelledAt || now.toISOString()
      }),
      req.ip || 'unknown'
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        contractId,
        cancelledAt: cancelledAt || now.toISOString(),
        withinCancellationPeriod: isWithinCancellationPeriod,
        refundEligible: isWithinCancellationPeriod,
        message: isWithinCancellationPeriod
          ? 'Contrato cancelado dentro del período de 3 días. Es elegible para reembolso completo.'
          : 'Contrato cancelado. El servicio continuará hasta el final del período de facturación actual.'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Contract cancellation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar la cancelación'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// DOWNLOAD CONTRACT PDF
// Generate PDF copy of signed contract
// =====================================================
router.get('/contract/:contractId/download', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contractId } = req.params;

    const result = await pool.query(`
      SELECT cc.*, u.first_name, u.last_name, u.email
      FROM client_contracts cc
      JOIN users u ON cc.client_id = u.id
      WHERE cc.id = $1 AND cc.client_id = $2
    `, [contractId, userId]);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Contrato no encontrado'
      });
    }

    const contract = result.rows[0];

    // Return contract data (frontend will generate PDF)
    res.json({
      success: true,
      data: {
        contractId: contract.id,
        clientName: `${contract.first_name} ${contract.last_name}`,
        clientEmail: contract.email,
        contractType: contract.contract_type,
        signedAt: contract.signed_at || contract.signed_date,
        effectiveDate: contract.effective_date,
        cancellationDeadline: contract.cancellation_deadline,
        digitalSignature: contract.digital_signature,
        acknowledgments: contract.acknowledgments,
        status: contract.status
      }
    });

  } catch (error) {
    console.error('Contract download error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al descargar contrato'
    });
  }
});

module.exports = router;
