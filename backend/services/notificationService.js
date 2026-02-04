/**
 * Credit Repair SaaS - Notification Service
 * Sistema de notificaciones por email y en la aplicación
 *
 * @module services/notificationService
 */

const nodemailer = require('nodemailer');
const { query, transaction } = require('../config/database');

/**
 * Tipos de notificación
 * @type {Object}
 */
const NOTIFICATION_TYPES = {
  // Disputas
  DISPUTE_CREATED: 'dispute_created',
  DISPUTE_SENT: 'dispute_sent',
  DISPUTE_RESPONSE: 'dispute_response',
  DISPUTE_RESOLVED: 'dispute_resolved',
  DISPUTE_REJECTED: 'dispute_rejected',

  // Puntajes de crédito
  SCORE_UPDATED: 'score_updated',
  SCORE_IMPROVED: 'score_improved',
  SCORE_DECLINED: 'score_declined',

  // Items de crédito
  ITEM_DELETED: 'item_deleted',
  ITEM_VERIFIED: 'item_verified',
  ITEM_UPDATED: 'item_updated',

  // Cuenta
  WELCOME: 'welcome',
  PASSWORD_CHANGED: 'password_changed',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',

  // Sistema
  DOCUMENT_UPLOADED: 'document_uploaded',
  ACTION_REQUIRED: 'action_required',
  REMINDER: 'reminder',
  MILESTONE: 'milestone',
};

/**
 * Prioridades de notificación
 * @type {Object}
 */
const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

/**
 * Configuración del servicio de email
 * @type {Object}
 */
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.SMTP_FROM || 'Credit Repair Pro <noreply@creditrepair.com>',
};

/**
 * Crea el transporter de nodemailer
 * @returns {Object} Transporter configurado
 */
const createTransporter = () => {
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('Email credentials not configured. Email notifications disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth,
  });
};

/**
 * Plantillas de notificación
 * @type {Object}
 */
const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.WELCOME]: {
    title: 'Bienvenido a Credit Repair Pro',
    titleEn: 'Welcome to Credit Repair Pro',
    getBody: (data) => `¡Hola ${data.firstName}! Tu cuenta ha sido creada exitosamente. Estamos aquí para ayudarte a mejorar tu crédito.`,
    getBodyEn: (data) => `Hi ${data.firstName}! Your account has been successfully created. We're here to help you improve your credit.`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.DISPUTE_CREATED]: {
    title: 'Nueva disputa creada',
    titleEn: 'New Dispute Created',
    getBody: (data) => `Tu disputa contra ${data.creditorName} (${data.bureau}) ha sido creada. La carta está lista para ser enviada.`,
    getBodyEn: (data) => `Your dispute against ${data.creditorName} (${data.bureau}) has been created. The letter is ready to be sent.`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.DISPUTE_SENT]: {
    title: 'Disputa enviada',
    titleEn: 'Dispute Sent',
    getBody: (data) => `Tu carta de disputa ha sido enviada a ${data.bureau}. Número de rastreo: ${data.trackingNumber || 'N/A'}. Esperamos respuesta en 30 días.`,
    getBodyEn: (data) => `Your dispute letter has been sent to ${data.bureau}. Tracking number: ${data.trackingNumber || 'N/A'}. Expect a response within 30 days.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.DISPUTE_RESPONSE]: {
    title: 'Respuesta de disputa recibida',
    titleEn: 'Dispute Response Received',
    getBody: (data) => `Hemos recibido una respuesta de ${data.bureau} sobre tu disputa. Por favor revisa los detalles en tu cuenta.`,
    getBodyEn: (data) => `We've received a response from ${data.bureau} about your dispute. Please review the details in your account.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.DISPUTE_RESOLVED]: {
    title: '¡Disputa resuelta exitosamente!',
    titleEn: 'Dispute Successfully Resolved!',
    getBody: (data) => `¡Excelentes noticias! Tu disputa contra ${data.creditorName} ha sido resuelta a tu favor. El item será removido de tu reporte.`,
    getBodyEn: (data) => `Great news! Your dispute against ${data.creditorName} has been resolved in your favor. The item will be removed from your report.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.DISPUTE_REJECTED]: {
    title: 'Disputa no exitosa',
    titleEn: 'Dispute Not Successful',
    getBody: (data) => `Tu disputa contra ${data.creditorName} no fue exitosa. El bureau verificó la información. Podemos explorar otras opciones.`,
    getBodyEn: (data) => `Your dispute against ${data.creditorName} was not successful. The bureau verified the information. We can explore other options.`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.SCORE_IMPROVED]: {
    title: '¡Tu puntaje de crédito mejoró!',
    titleEn: 'Your Credit Score Improved!',
    getBody: (data) => `¡Felicidades! Tu puntaje de ${data.bureau} aumentó ${data.change} puntos a ${data.newScore}.`,
    getBodyEn: (data) => `Congratulations! Your ${data.bureau} score increased ${data.change} points to ${data.newScore}.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.SCORE_DECLINED]: {
    title: 'Cambio en tu puntaje de crédito',
    titleEn: 'Change in Your Credit Score',
    getBody: (data) => `Tu puntaje de ${data.bureau} disminuyó ${Math.abs(data.change)} puntos a ${data.newScore}. Revisemos juntos qué pasó.`,
    getBodyEn: (data) => `Your ${data.bureau} score decreased ${Math.abs(data.change)} points to ${data.newScore}. Let's review what happened.`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.ITEM_DELETED]: {
    title: '¡Item negativo eliminado!',
    titleEn: 'Negative Item Deleted!',
    getBody: (data) => `¡Excelente! El item de ${data.creditorName} ha sido eliminado de tu reporte de crédito.`,
    getBodyEn: (data) => `Excellent! The item from ${data.creditorName} has been deleted from your credit report.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING]: {
    title: 'Tu suscripción está por vencer',
    titleEn: 'Your Subscription is Expiring',
    getBody: (data) => `Tu suscripción vence en ${data.daysLeft} días. Renueva para continuar con tu proceso de reparación de crédito.`,
    getBodyEn: (data) => `Your subscription expires in ${data.daysLeft} days. Renew to continue your credit repair journey.`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: {
    title: 'Pago recibido',
    titleEn: 'Payment Received',
    getBody: (data) => `Hemos recibido tu pago de $${data.amount}. Gracias por confiar en nosotros.`,
    getBodyEn: (data) => `We've received your payment of $${data.amount}. Thank you for trusting us.`,
    priority: NOTIFICATION_PRIORITIES.LOW,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.ACTION_REQUIRED]: {
    title: 'Acción requerida',
    titleEn: 'Action Required',
    getBody: (data) => data.message,
    getBodyEn: (data) => data.messageEn || data.message,
    priority: NOTIFICATION_PRIORITIES.URGENT,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.MILESTONE]: {
    title: '¡Hito alcanzado!',
    titleEn: 'Milestone Reached!',
    getBody: (data) => data.message,
    getBodyEn: (data) => data.messageEn || data.message,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    sendEmail: true,
  },

  [NOTIFICATION_TYPES.REMINDER]: {
    title: 'Recordatorio',
    titleEn: 'Reminder',
    getBody: (data) => data.message,
    getBodyEn: (data) => data.messageEn || data.message,
    priority: NOTIFICATION_PRIORITIES.LOW,
    sendEmail: false,
  },
};

/**
 * Crea una notificación en la base de datos
 * @param {Object} params - Parámetros de la notificación
 * @returns {Promise<Object>} Notificación creada
 */
const createNotification = async (params) => {
  const {
    userId,
    type,
    data = {},
    language = 'es',
  } = params;

  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const title = language === 'en' ? template.titleEn : template.title;
  const body = language === 'en' ? template.getBodyEn(data) : template.getBody(data);

  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, priority, data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     RETURNING *`,
    [userId, type, title, body, template.priority, JSON.stringify(data)]
  );

  return result.rows[0];
};

/**
 * Envía un email
 * @param {Object} params - Parámetros del email
 * @returns {Promise<Object>} Resultado del envío
 */
const sendEmail = async (params) => {
  const { to, subject, html, text } = params;

  const transporter = createTransporter();
  if (!transporter) {
    console.log('Email skipped (not configured):', subject);
    return { skipped: true };
  }

  try {
    const result = await transporter.sendMail({
      from: EMAIL_CONFIG.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    console.log('Email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

/**
 * Genera el HTML del email
 * @param {Object} params - Parámetros del email
 * @returns {string} HTML del email
 */
const generateEmailHtml = (params) => {
  const { title, body, ctaText, ctaUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .cta-button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Credit Repair Pro</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${body}</p>
      ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="cta-button">${ctaText}</a>` : ''}
    </div>
    <div class="footer">
      <p>Credit Repair Pro - Tu aliado en la reparación de crédito</p>
      <p>Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Envía una notificación completa (DB + Email si aplica)
 * @param {Object} params - Parámetros
 * @returns {Promise<Object>} Resultado
 */
const sendNotification = async (params) => {
  const {
    userId,
    type,
    data = {},
    language = 'es',
    forceEmail = false,
  } = params;

  // Crear notificación en DB
  const notification = await createNotification({ userId, type, data, language });

  // Obtener información del usuario para email
  const template = NOTIFICATION_TEMPLATES[type];
  if (template.sendEmail || forceEmail) {
    const userResult = await query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const title = language === 'en' ? template.titleEn : template.title;
      const body = language === 'en' ? template.getBodyEn(data) : template.getBody(data);

      try {
        await sendEmail({
          to: user.email,
          subject: title,
          html: generateEmailHtml({
            title,
            body,
            ctaText: data.ctaText || 'Ver en tu cuenta',
            ctaUrl: data.ctaUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
          }),
        });

        // Marcar como enviado por email
        await query(
          'UPDATE notifications SET email_sent = true, email_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
          [notification.id]
        );
      } catch (error) {
        console.error('Failed to send email notification:', error);
      }
    }
  }

  return notification;
};

/**
 * Obtiene las notificaciones de un usuario
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<Object>} Notificaciones
 */
const getUserNotifications = async (userId, options = {}) => {
  const {
    limit = 20,
    offset = 0,
    unreadOnly = false,
  } = options;

  let whereClause = 'WHERE user_id = $1';
  if (unreadOnly) {
    whereClause += ' AND read_at IS NULL';
  }

  const [notifications, countResult] = await Promise.all([
    query(
      `SELECT * FROM notifications ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM notifications ${whereClause}`,
      [userId]
    ),
  ]);

  return {
    notifications: notifications.rows,
    total: parseInt(countResult.rows[0].count),
    unreadCount: unreadOnly
      ? parseInt(countResult.rows[0].count)
      : (await query(
          'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
          [userId]
        )).rows[0].count,
  };
};

/**
 * Marca notificaciones como leídas
 * @param {string} userId - ID del usuario
 * @param {string[]} notificationIds - IDs de notificaciones (opcional, si no se pasa marca todas)
 * @returns {Promise<number>} Cantidad de notificaciones actualizadas
 */
const markAsRead = async (userId, notificationIds = null) => {
  let result;
  if (notificationIds && notificationIds.length > 0) {
    result = await query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL
       RETURNING id`,
      [userId, notificationIds]
    );
  } else {
    result = await query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL
       RETURNING id`,
      [userId]
    );
  }
  return result.rowCount;
};

/**
 * Envía notificaciones de recordatorio para disputas pendientes
 * @returns {Promise<number>} Cantidad de recordatorios enviados
 */
const sendDisputeReminders = async () => {
  // Buscar disputas enviadas hace más de 25 días sin respuesta
  const result = await query(
    `SELECT d.*, u.id as user_id, ci.creditor_name
     FROM disputes d
     JOIN users u ON d.client_id = u.id
     LEFT JOIN credit_items ci ON d.credit_item_id = ci.id
     WHERE d.status = 'sent'
     AND d.sent_date <= CURRENT_DATE - INTERVAL '25 days'
     AND d.sent_date > CURRENT_DATE - INTERVAL '30 days'
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
       WHERE n.user_id = u.id
       AND n.type = 'reminder'
       AND n.data->>'disputeId' = d.id::text
       AND n.created_at > CURRENT_DATE - INTERVAL '5 days'
     )`
  );

  let sent = 0;
  for (const dispute of result.rows) {
    await sendNotification({
      userId: dispute.user_id,
      type: NOTIFICATION_TYPES.REMINDER,
      data: {
        disputeId: dispute.id,
        message: `Tu disputa contra ${dispute.creditor_name || 'el acreedor'} fue enviada hace más de 25 días. El bureau debería responder pronto.`,
        messageEn: `Your dispute against ${dispute.creditor_name || 'the creditor'} was sent over 25 days ago. The bureau should respond soon.`,
      },
    });
    sent++;
  }

  return sent;
};

/**
 * Envía notificaciones de suscripciones por vencer
 * @returns {Promise<number>} Cantidad de notificaciones enviadas
 */
const sendSubscriptionExpirationReminders = async () => {
  const result = await query(
    `SELECT cp.*, u.id as user_id, u.first_name
     FROM client_profiles cp
     JOIN users u ON cp.user_id = u.id
     WHERE cp.subscription_status = 'active'
     AND cp.subscription_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
       WHERE n.user_id = u.id
       AND n.type = 'subscription_expiring'
       AND n.created_at > CURRENT_DATE - INTERVAL '3 days'
     )`
  );

  let sent = 0;
  for (const profile of result.rows) {
    const daysLeft = Math.ceil(
      (new Date(profile.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24)
    );

    await sendNotification({
      userId: profile.user_id,
      type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING,
      data: { daysLeft, firstName: profile.first_name },
    });
    sent++;
  }

  return sent;
};

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TEMPLATES,
  createNotification,
  sendEmail,
  generateEmailHtml,
  sendNotification,
  getUserNotifications,
  markAsRead,
  sendDisputeReminders,
  sendSubscriptionExpirationReminders,
};
