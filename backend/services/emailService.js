/**
 * Email Service
 * Handles all compliance-related email notifications
 * Required by CROA for contract confirmations
 */

const nodemailer = require('nodemailer');

// Create transporter - configure with your email provider
const createTransporter = () => {
  // For development, use ethereal email
  if (process.env.NODE_ENV !== 'production') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.SMTP_USER || 'test@ethereal.email',
        pass: process.env.SMTP_PASS || 'testpass'
      }
    });
  }

  // Production configuration
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const transporter = createTransporter();

const fromEmail = process.env.FROM_EMAIL || 'noreply@triexpertservice.com';
const companyName = 'TriExpert Credit Repair';
const companyAddress = '2800 E 113th Ave, Tampa, FL 33617';
const companyPhone = '(813) 369-3340';

/**
 * Send Contract Confirmation Email
 * Required by CROA after contract signing
 */
const sendContractConfirmation = async (userData, contractData) => {
  const { email, firstName, lastName } = userData;
  const { 
    contractId, 
    signedAt, 
    cancellationDeadline, 
    planType = 'professional',
    totalAmount = 99.99 
  } = contractData;

  const formattedSignDate = new Date(signedAt).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedDeadline = new Date(cancellationDeadline).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `${companyName} <${fromEmail}>`,
    to: email,
    subject: 'Confirmación de Contrato de Servicio - Credit Repair Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .important { background: #FEF3C7; border: 1px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Contrato Firmado Exitosamente</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Gracias por elegir ${companyName}. Este email confirma que ha firmado digitalmente nuestro contrato de servicio.</p>
            
            <div class="important">
              <h3 style="margin-top: 0; color: #B45309;">⚠️ DERECHO DE CANCELACIÓN - 3 DÍAS</h3>
              <p>De acuerdo con la Ley de Organizaciones de Reparación de Crédito (CROA), usted tiene derecho a cancelar este contrato sin cargo alguno dentro de los <strong>3 días hábiles</strong> siguientes a la firma.</p>
              <p><strong>Fecha límite de cancelación:</strong> ${formattedDeadline}</p>
              <p>Para cancelar, visite nuestra página de cancelación o contáctenos directamente.</p>
            </div>
            
            <div class="details">
              <h3>Detalles del Contrato</h3>
              <table style="width: 100%;">
                <tr>
                  <td><strong>Número de Contrato:</strong></td>
                  <td>#${contractId}</td>
                </tr>
                <tr>
                  <td><strong>Fecha de Firma:</strong></td>
                  <td>${formattedSignDate}</td>
                </tr>
                <tr>
                  <td><strong>Plan Seleccionado:</strong></td>
                  <td>Plan ${planType.charAt(0).toUpperCase() + planType.slice(1)}</td>
                </tr>
                <tr>
                  <td><strong>Tarifa Mensual:</strong></td>
                  <td>$${totalAmount} USD</td>
                </tr>
              </table>
            </div>
            
            <h3>Sus Derechos Bajo la Ley CROA</h3>
            <ul>
              <li>Derecho a cancelar dentro de 3 días hábiles sin cargo</li>
              <li>Ninguna organización puede garantizar resultados específicos</li>
              <li>Usted puede disputar información inexacta directamente con los burós de crédito de forma gratuita</li>
              <li>Tiene derecho a demandar si violamos la ley CROA</li>
            </ul>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">
                Ir a Mi Dashboard
              </a>
            </p>
          </div>
          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>${companyAddress}</p>
            <p>Teléfono: ${companyPhone}</p>
            <p>Este email fue enviado a ${email} como confirmación de su contrato.</p>
            <p>Guarde este email para sus registros.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      CONFIRMACIÓN DE CONTRATO DE SERVICIO
      =====================================
      
      Estimado/a ${firstName} ${lastName},
      
      Gracias por elegir ${companyName}. Este email confirma que ha firmado digitalmente nuestro contrato de servicio.
      
      IMPORTANTE - DERECHO DE CANCELACIÓN
      Usted tiene derecho a cancelar este contrato sin cargo alguno dentro de los 3 días hábiles siguientes a la firma.
      Fecha límite de cancelación: ${formattedDeadline}
      
      DETALLES DEL CONTRATO
      - Número de Contrato: #${contractId}
      - Fecha de Firma: ${formattedSignDate}
      - Plan: ${planType}
      - Tarifa Mensual: $${totalAmount} USD
      
      SUS DERECHOS BAJO LA LEY CROA
      - Derecho a cancelar dentro de 3 días hábiles sin cargo
      - Ninguna organización puede garantizar resultados específicos
      - Puede disputar información inexacta directamente con los burós de crédito de forma gratuita
      
      ${companyName}
      ${companyAddress}
      ${companyPhone}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Contract confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending contract confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Cancellation Confirmation Email
 */
const sendCancellationConfirmation = async (userData, cancellationData) => {
  const { email, firstName, lastName } = userData;
  const { 
    contractId, 
    cancelledAt, 
    withinCancellationPeriod,
    refundAmount = 0 
  } = cancellationData;

  const formattedDate = new Date(cancelledAt).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `${companyName} <${fromEmail}>`,
    to: email,
    subject: 'Confirmación de Cancelación - Credit Repair Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6B7280; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cancelación Confirmada</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Confirmamos que su contrato con ${companyName} ha sido cancelado exitosamente.</p>
            
            <div class="info">
              <h3>Detalles de la Cancelación</h3>
              <p><strong>Número de Contrato:</strong> #${contractId}</p>
              <p><strong>Fecha de Cancelación:</strong> ${formattedDate}</p>
              <p><strong>Cancelación dentro del período de 3 días:</strong> ${withinCancellationPeriod ? 'Sí' : 'No'}</p>
              ${withinCancellationPeriod && refundAmount > 0 ? `
                <p><strong>Reembolso:</strong> $${refundAmount} USD (procesado en 5-10 días hábiles)</p>
              ` : ''}
            </div>
            
            <p>Si tiene alguna pregunta sobre esta cancelación, no dude en contactarnos.</p>
            
            <p>Le deseamos lo mejor en su camino hacia una mejor salud crediticia.</p>
          </div>
          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>${companyAddress}</p>
            <p>Este email confirma la cancelación de su servicio.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Cancellation confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending cancellation confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Rights Acknowledgment Confirmation
 */
const sendRightsAcknowledgment = async (userData) => {
  const { email, firstName, lastName } = userData;

  const mailOptions = {
    from: `${companyName} <${fromEmail}>`,
    to: email,
    subject: 'Confirmación - Derechos del Consumidor CROA',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .rights { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Derechos del Consumidor Confirmados</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Confirmamos que ha recibido y reconocido la información sobre sus derechos bajo la Ley de Organizaciones de Reparación de Crédito (CROA).</p>
            
            <div class="rights">
              <h3>Resumen de Sus Derechos</h3>
              <ul>
                <li>Usted tiene derecho a disputar información inexacta en su reporte de crédito directamente con los burós de crédito, sin costo.</li>
                <li>Ninguna organización de reparación de crédito puede garantizar resultados específicos.</li>
                <li>Tiene 3 días hábiles para cancelar cualquier contrato sin penalidad.</li>
                <li>Tiene derecho a una copia completa del contrato.</li>
                <li>Tiene derecho a demandar por violaciones de la ley CROA.</li>
              </ul>
            </div>
            
            <p><strong>Contacto de la FTC:</strong><br>
            Federal Trade Commission<br>
            Consumer Response Center<br>
            600 Pennsylvania Avenue NW<br>
            Washington, DC 20580<br>
            www.ftc.gov</p>
          </div>
          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>Guarde este email para sus registros.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Rights acknowledgment email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending rights acknowledgment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Fee Disclosure Confirmation
 */
const sendFeeDisclosureConfirmation = async (userData, feeData) => {
  const { email, firstName, lastName } = userData;
  const { planType, totalAmount, paymentSchedule } = feeData;

  const mailOptions = {
    from: `${companyName} <${fromEmail}>`,
    to: email,
    subject: 'Confirmación de Divulgación de Tarifas - Credit Repair Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .fees { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Divulgación de Tarifas Confirmada</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Confirmamos que ha recibido y reconocido nuestra divulgación de tarifas antes de realizar cualquier pago.</p>
            
            <div class="fees">
              <h3>Resumen de Tarifas</h3>
              <table style="width: 100%;">
                <tr>
                  <td><strong>Plan Seleccionado:</strong></td>
                  <td>${planType}</td>
                </tr>
                <tr>
                  <td><strong>Tarifa:</strong></td>
                  <td>$${totalAmount} USD</td>
                </tr>
                <tr>
                  <td><strong>Frecuencia de Pago:</strong></td>
                  <td>${paymentSchedule === 'monthly' ? 'Mensual' : paymentSchedule}</td>
                </tr>
                <tr>
                  <td><strong>Cargos Ocultos:</strong></td>
                  <td>Ninguno</td>
                </tr>
              </table>
            </div>
            
            <p><strong>Importante:</strong> Bajo la ley CROA, no se le cobrará hasta que los servicios hayan sido prestados o hasta después del período de cancelación de 3 días.</p>
          </div>
          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>Guarde este email para sus registros.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Fee disclosure email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending fee disclosure:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendContractConfirmation,
  sendCancellationConfirmation,
  sendRightsAcknowledgment,
  sendFeeDisclosureConfirmation
};
