/**
 * Credit Repair SaaS - Tracking Service
 * Sistema de rastreo y seguimiento del proceso de reparación de crédito
 *
 * @module services/trackingService
 */

const { query, transaction } = require('../config/database');
const { sendNotification, NOTIFICATION_TYPES } = require('./notificationService');

/**
 * Etapas del proceso de reparación de crédito
 * @type {Object}
 */
const PROCESS_STAGES = {
  ONBOARDING: {
    id: 'onboarding',
    name: 'Registro',
    nameEn: 'Onboarding',
    description: 'Creación de cuenta y configuración inicial',
    order: 1,
  },
  DOCUMENT_COLLECTION: {
    id: 'document_collection',
    name: 'Recolección de Documentos',
    nameEn: 'Document Collection',
    description: 'Carga de documentos de identidad y comprobantes',
    order: 2,
  },
  CREDIT_ANALYSIS: {
    id: 'credit_analysis',
    name: 'Análisis de Crédito',
    nameEn: 'Credit Analysis',
    description: 'Revisión del reporte de crédito e identificación de items',
    order: 3,
  },
  DISPUTE_PREPARATION: {
    id: 'dispute_preparation',
    name: 'Preparación de Disputas',
    nameEn: 'Dispute Preparation',
    description: 'Creación de cartas de disputa',
    order: 4,
  },
  DISPUTES_SENT: {
    id: 'disputes_sent',
    name: 'Disputas Enviadas',
    nameEn: 'Disputes Sent',
    description: 'Cartas enviadas a los bureaus de crédito',
    order: 5,
  },
  AWAITING_RESPONSE: {
    id: 'awaiting_response',
    name: 'Esperando Respuesta',
    nameEn: 'Awaiting Response',
    description: 'En espera de respuesta de los bureaus (30 días)',
    order: 6,
  },
  REVIEW_RESULTS: {
    id: 'review_results',
    name: 'Revisión de Resultados',
    nameEn: 'Review Results',
    description: 'Análisis de respuestas y planificación de siguiente ronda',
    order: 7,
  },
  COMPLETED: {
    id: 'completed',
    name: 'Proceso Completado',
    nameEn: 'Process Completed',
    description: 'Objetivos de reparación de crédito alcanzados',
    order: 8,
  },
};

/**
 * Tipos de eventos del timeline
 * @type {Object}
 */
const TIMELINE_EVENT_TYPES = {
  // Sistema
  ACCOUNT_CREATED: 'account_created',
  STAGE_CHANGED: 'stage_changed',
  MILESTONE_REACHED: 'milestone_reached',

  // Documentos
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_VERIFIED: 'document_verified',
  DOCUMENT_REJECTED: 'document_rejected',

  // Items de crédito
  ITEM_IDENTIFIED: 'item_identified',
  ITEM_STATUS_CHANGED: 'item_status_changed',
  ITEM_DELETED: 'item_deleted',

  // Disputas
  DISPUTE_CREATED: 'dispute_created',
  DISPUTE_LETTER_GENERATED: 'dispute_letter_generated',
  DISPUTE_SENT: 'dispute_sent',
  DISPUTE_RESPONSE_RECEIVED: 'dispute_response_received',
  DISPUTE_RESOLVED: 'dispute_resolved',
  DISPUTE_REJECTED: 'dispute_rejected',

  // Puntajes
  SCORE_RECORDED: 'score_recorded',
  SCORE_IMPROVED: 'score_improved',
  SCORE_DECLINED: 'score_declined',

  // Pagos
  PAYMENT_MADE: 'payment_made',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',

  // Notas
  NOTE_ADDED: 'note_added',
  STAFF_ACTION: 'staff_action',
};

/**
 * Hitos del proceso
 * @type {Object}
 */
const MILESTONES = {
  FIRST_DOCUMENT: {
    id: 'first_document',
    name: 'Primer Documento',
    description: 'Subiste tu primer documento',
    icon: '📄',
  },
  PROFILE_COMPLETE: {
    id: 'profile_complete',
    name: 'Perfil Completo',
    description: 'Completaste tu información de perfil',
    icon: '👤',
  },
  FIRST_ITEM_IDENTIFIED: {
    id: 'first_item_identified',
    name: 'Primer Item Identificado',
    description: 'Se identificó el primer item negativo',
    icon: '🔍',
  },
  FIRST_DISPUTE_SENT: {
    id: 'first_dispute_sent',
    name: 'Primera Disputa Enviada',
    description: 'Enviaste tu primera carta de disputa',
    icon: '✉️',
  },
  FIRST_ITEM_DELETED: {
    id: 'first_item_deleted',
    name: 'Primer Item Eliminado',
    description: '¡Lograste eliminar tu primer item negativo!',
    icon: '🎉',
  },
  SCORE_IMPROVED_50: {
    id: 'score_improved_50',
    name: 'Puntaje +50 Puntos',
    description: 'Tu puntaje mejoró 50 puntos o más',
    icon: '📈',
  },
  SCORE_IMPROVED_100: {
    id: 'score_improved_100',
    name: 'Puntaje +100 Puntos',
    description: '¡Tu puntaje mejoró 100 puntos o más!',
    icon: '🚀',
  },
  FIVE_ITEMS_DELETED: {
    id: 'five_items_deleted',
    name: '5 Items Eliminados',
    description: 'Has eliminado 5 items negativos',
    icon: '⭐',
  },
  ALL_ITEMS_RESOLVED: {
    id: 'all_items_resolved',
    name: 'Todos los Items Resueltos',
    description: '¡Todos los items negativos han sido resueltos!',
    icon: '🏆',
  },
};

/**
 * Registra un evento en el timeline del cliente
 * @param {Object} params - Parámetros del evento
 * @returns {Promise<Object>} Evento creado
 */
const recordTimelineEvent = async (params) => {
  const {
    clientId,
    eventType,
    title,
    description,
    metadata = {},
    relatedEntityType = null,
    relatedEntityId = null,
    performedBy = null,
  } = params;

  const result = await query(
    `INSERT INTO client_timeline
     (client_id, event_type, title, description, metadata, related_entity_type, related_entity_id, performed_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     RETURNING *`,
    [clientId, eventType, title, description, JSON.stringify(metadata), relatedEntityType, relatedEntityId, performedBy]
  );

  return result.rows[0];
};

/**
 * Obtiene el timeline de un cliente
 * @param {string} clientId - ID del cliente
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<Object>} Timeline del cliente
 */
const getClientTimeline = async (clientId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    eventTypes = null,
    startDate = null,
    endDate = null,
  } = options;

  let whereClause = 'WHERE client_id = $1';
  const params = [clientId];
  let paramIndex = 2;

  if (eventTypes && eventTypes.length > 0) {
    whereClause += ` AND event_type = ANY($${paramIndex})`;
    params.push(eventTypes);
    paramIndex++;
  }

  if (startDate) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  const [events, countResult] = await Promise.all([
    query(
      `SELECT ct.*, u.first_name as performer_first_name, u.last_name as performer_last_name
       FROM client_timeline ct
       LEFT JOIN users u ON ct.performed_by = u.id
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM client_timeline ${whereClause}`, params),
  ]);

  return {
    events: events.rows,
    total: parseInt(countResult.rows[0].count),
  };
};

/**
 * Obtiene el estado actual del proceso del cliente
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object>} Estado del proceso
 */
const getClientProcessStatus = async (clientId) => {
  // Obtener información del cliente y su perfil
  const clientResult = await query(
    `SELECT u.*, cp.*
     FROM users u
     LEFT JOIN client_profiles cp ON u.id = cp.user_id
     WHERE u.id = $1`,
    [clientId]
  );

  if (clientResult.rows.length === 0) {
    throw new Error('Client not found');
  }

  const client = clientResult.rows[0];

  // Obtener estadísticas
  const [
    documentsResult,
    itemsResult,
    disputesResult,
    scoresResult,
    milestonesResult,
  ] = await Promise.all([
    // Documentos
    query(
      `SELECT document_category, COUNT(*) as count
       FROM documents WHERE client_id = $1
       GROUP BY document_category`,
      [clientId]
    ),
    // Items de crédito por estado
    query(
      `SELECT status, COUNT(*) as count
       FROM credit_items WHERE client_id = $1
       GROUP BY status`,
      [clientId]
    ),
    // Disputas por estado
    query(
      `SELECT status, COUNT(*) as count
       FROM disputes WHERE client_id = $1
       GROUP BY status`,
      [clientId]
    ),
    // Puntajes más recientes
    query(
      `SELECT DISTINCT ON (bureau) bureau, score, score_date
       FROM credit_scores WHERE client_id = $1
       ORDER BY bureau, score_date DESC`,
      [clientId]
    ),
    // Hitos alcanzados
    query(
      `SELECT * FROM client_milestones WHERE client_id = $1`,
      [clientId]
    ),
  ]);

  // Calcular estadísticas
  const documents = documentsResult.rows.reduce((acc, row) => {
    acc[row.document_category] = parseInt(row.count);
    return acc;
  }, {});

  const items = itemsResult.rows.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count);
    return acc;
  }, { identified: 0, disputing: 0, deleted: 0, verified: 0, updated: 0 });

  const disputes = disputesResult.rows.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count);
    return acc;
  }, { draft: 0, sent: 0, received: 0, investigating: 0, resolved: 0, rejected: 0 });

  const scores = scoresResult.rows.reduce((acc, row) => {
    acc[row.bureau] = { score: row.score, date: row.score_date };
    return acc;
  }, {});

  const milestones = milestonesResult.rows.map(m => m.milestone_id);

  // Determinar la etapa actual
  const currentStage = determineCurrentStage({
    documents,
    items,
    disputes,
    subscriptionStatus: client.subscription_status,
  });

  // Calcular progreso general
  const progress = calculateOverallProgress({
    documents,
    items,
    disputes,
    milestones,
  });

  return {
    client: {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email,
      subscriptionStatus: client.subscription_status,
      memberSince: client.created_at,
    },
    currentStage,
    progress,
    statistics: {
      documents,
      items,
      disputes,
      scores,
      totalItemsIdentified: Object.values(items).reduce((a, b) => a + b, 0),
      totalItemsDeleted: items.deleted || 0,
      totalDisputesSent: (disputes.sent || 0) + (disputes.received || 0) + (disputes.investigating || 0) + (disputes.resolved || 0) + (disputes.rejected || 0),
      activeDisputes: (disputes.sent || 0) + (disputes.received || 0) + (disputes.investigating || 0),
    },
    milestones: {
      achieved: milestones,
      available: Object.keys(MILESTONES),
    },
    stages: Object.values(PROCESS_STAGES),
  };
};

/**
 * Determina la etapa actual del proceso
 * @param {Object} data - Datos del cliente
 * @returns {Object} Etapa actual
 */
const determineCurrentStage = (data) => {
  const { documents, items, disputes, subscriptionStatus } = data;

  const hasRequiredDocs = documents.id > 0 && documents.proof_of_address > 0;
  const hasIdentifiedItems = Object.values(items).reduce((a, b) => a + b, 0) > 0;
  const hasDraftDisputes = disputes.draft > 0;
  const hasSentDisputes = (disputes.sent || 0) + (disputes.received || 0) + (disputes.investigating || 0) > 0;
  const hasResolvedDisputes = (disputes.resolved || 0) + (disputes.rejected || 0) > 0;
  const allItemsResolved = hasIdentifiedItems && items.identified === 0 && items.disputing === 0;

  if (allItemsResolved) {
    return PROCESS_STAGES.COMPLETED;
  }
  if (hasResolvedDisputes && hasIdentifiedItems) {
    return PROCESS_STAGES.REVIEW_RESULTS;
  }
  if (hasSentDisputes) {
    return PROCESS_STAGES.AWAITING_RESPONSE;
  }
  if (hasDraftDisputes || (hasIdentifiedItems && hasSentDisputes === false)) {
    return PROCESS_STAGES.DISPUTE_PREPARATION;
  }
  if (hasIdentifiedItems) {
    return PROCESS_STAGES.CREDIT_ANALYSIS;
  }
  if (hasRequiredDocs) {
    return PROCESS_STAGES.CREDIT_ANALYSIS;
  }
  if (Object.values(documents).some(v => v > 0)) {
    return PROCESS_STAGES.DOCUMENT_COLLECTION;
  }

  return PROCESS_STAGES.ONBOARDING;
};

/**
 * Calcula el progreso general del proceso
 * @param {Object} data - Datos del cliente
 * @returns {Object} Progreso
 */
const calculateOverallProgress = (data) => {
  const { documents, items, disputes, milestones } = data;

  // Puntos por diferentes logros
  let points = 0;
  let maxPoints = 100;

  // Documentos (20 puntos máx)
  const requiredDocs = ['id', 'proof_of_address'];
  const docPoints = requiredDocs.filter(d => documents[d] > 0).length * 10;
  points += Math.min(docPoints, 20);

  // Items identificados (10 puntos)
  const totalItems = Object.values(items).reduce((a, b) => a + b, 0);
  if (totalItems > 0) points += 10;

  // Disputas enviadas (20 puntos)
  const sentDisputes = (disputes.sent || 0) + (disputes.received || 0) + (disputes.investigating || 0) + (disputes.resolved || 0) + (disputes.rejected || 0);
  if (sentDisputes > 0) points += 20;

  // Items resueltos (30 puntos máx)
  const resolvedItems = (items.deleted || 0) + (items.updated || 0);
  if (totalItems > 0) {
    points += Math.round((resolvedItems / totalItems) * 30);
  }

  // Hitos alcanzados (20 puntos máx)
  const milestonePoints = Math.min(milestones.length * 2, 20);
  points += milestonePoints;

  return {
    percentage: Math.min(Math.round((points / maxPoints) * 100), 100),
    points,
    maxPoints,
  };
};

/**
 * Verifica y otorga hitos al cliente
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object[]>} Nuevos hitos otorgados
 */
const checkAndAwardMilestones = async (clientId) => {
  const newMilestones = [];

  // Obtener hitos actuales
  const currentMilestones = await query(
    'SELECT milestone_id FROM client_milestones WHERE client_id = $1',
    [clientId]
  );
  const achieved = currentMilestones.rows.map(m => m.milestone_id);

  // Verificar cada hito
  const checks = [
    {
      id: 'first_document',
      check: async () => {
        const result = await query(
          'SELECT COUNT(*) FROM documents WHERE client_id = $1',
          [clientId]
        );
        return parseInt(result.rows[0].count) > 0;
      },
    },
    {
      id: 'first_item_identified',
      check: async () => {
        const result = await query(
          'SELECT COUNT(*) FROM credit_items WHERE client_id = $1',
          [clientId]
        );
        return parseInt(result.rows[0].count) > 0;
      },
    },
    {
      id: 'first_dispute_sent',
      check: async () => {
        const result = await query(
          "SELECT COUNT(*) FROM disputes WHERE client_id = $1 AND status != 'draft'",
          [clientId]
        );
        return parseInt(result.rows[0].count) > 0;
      },
    },
    {
      id: 'first_item_deleted',
      check: async () => {
        const result = await query(
          "SELECT COUNT(*) FROM credit_items WHERE client_id = $1 AND status = 'deleted'",
          [clientId]
        );
        return parseInt(result.rows[0].count) > 0;
      },
    },
    {
      id: 'five_items_deleted',
      check: async () => {
        const result = await query(
          "SELECT COUNT(*) FROM credit_items WHERE client_id = $1 AND status = 'deleted'",
          [clientId]
        );
        return parseInt(result.rows[0].count) >= 5;
      },
    },
    {
      id: 'all_items_resolved',
      check: async () => {
        const result = await query(
          `SELECT
            COUNT(*) FILTER (WHERE status IN ('identified', 'disputing')) as pending,
            COUNT(*) as total
           FROM credit_items WHERE client_id = $1`,
          [clientId]
        );
        const { pending, total } = result.rows[0];
        return parseInt(total) > 0 && parseInt(pending) === 0;
      },
    },
  ];

  for (const { id, check } of checks) {
    if (!achieved.includes(id) && await check()) {
      // Otorgar hito
      await query(
        `INSERT INTO client_milestones (client_id, milestone_id, achieved_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [clientId, id]
      );

      const milestone = MILESTONES[id.toUpperCase()] || MILESTONES[id];
      newMilestones.push(milestone);

      // Registrar en timeline
      await recordTimelineEvent({
        clientId,
        eventType: TIMELINE_EVENT_TYPES.MILESTONE_REACHED,
        title: `¡Hito alcanzado: ${milestone.name}!`,
        description: milestone.description,
        metadata: { milestoneId: id },
      });

      // Enviar notificación
      await sendNotification({
        userId: clientId,
        type: NOTIFICATION_TYPES.MILESTONE,
        data: {
          message: `${milestone.icon} ${milestone.description}`,
          messageEn: `${milestone.icon} ${milestone.description}`,
          milestoneId: id,
        },
      });
    }
  }

  return newMilestones;
};

/**
 * Obtiene el resumen del proceso para el dashboard
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object>} Resumen
 */
const getProcessSummary = async (clientId) => {
  const status = await getClientProcessStatus(clientId);
  const recentTimeline = await getClientTimeline(clientId, { limit: 5 });

  // Calcular días en el programa
  const memberSince = new Date(status.client.memberSince);
  const daysInProgram = Math.floor((new Date() - memberSince) / (1000 * 60 * 60 * 24));

  // Próximos pasos recomendados
  const nextSteps = generateNextSteps(status);

  return {
    currentStage: status.currentStage,
    progress: status.progress,
    statistics: status.statistics,
    recentActivity: recentTimeline.events,
    daysInProgram,
    nextSteps,
    milestonesAchieved: status.milestones.achieved.length,
    totalMilestones: status.milestones.available.length,
  };
};

/**
 * Genera los próximos pasos recomendados
 * @param {Object} status - Estado del proceso
 * @returns {Array} Próximos pasos
 */
const generateNextSteps = (status) => {
  const steps = [];
  const { currentStage, statistics } = status;

  if (currentStage.id === 'onboarding') {
    steps.push({
      priority: 'high',
      action: 'Completa tu perfil',
      description: 'Añade tu información personal para continuar',
    });
    steps.push({
      priority: 'high',
      action: 'Sube tu identificación',
      description: 'Necesitamos verificar tu identidad',
    });
  }

  if (!statistics.documents.id) {
    steps.push({
      priority: 'high',
      action: 'Sube un documento de identidad',
      description: 'ID, licencia de conducir o pasaporte',
    });
  }

  if (!statistics.documents.proof_of_address) {
    steps.push({
      priority: 'high',
      action: 'Sube comprobante de domicilio',
      description: 'Factura de servicios o estado de cuenta',
    });
  }

  if (!statistics.documents.credit_report && statistics.totalItemsIdentified === 0) {
    steps.push({
      priority: 'medium',
      action: 'Obtén tu reporte de crédito',
      description: 'Visita annualcreditreport.com para obtenerlo gratis',
    });
  }

  if (statistics.items.identified > 0) {
    steps.push({
      priority: 'high',
      action: `Crear disputas para ${statistics.items.identified} items pendientes`,
      description: 'Inicia el proceso de disputa para los items identificados',
    });
  }

  if (statistics.disputes.draft > 0) {
    steps.push({
      priority: 'high',
      action: `Enviar ${statistics.disputes.draft} disputas en borrador`,
      description: 'Revisa y envía las cartas de disputa pendientes',
    });
  }

  if (statistics.activeDisputes > 0) {
    steps.push({
      priority: 'low',
      action: 'Esperar respuesta de los bureaus',
      description: `Tienes ${statistics.activeDisputes} disputas activas. Respuesta esperada en 30 días.`,
    });
  }

  return steps.slice(0, 5); // Máximo 5 pasos
};

module.exports = {
  PROCESS_STAGES,
  TIMELINE_EVENT_TYPES,
  MILESTONES,
  recordTimelineEvent,
  getClientTimeline,
  getClientProcessStatus,
  checkAndAwardMilestones,
  getProcessSummary,
  generateNextSteps,
};
