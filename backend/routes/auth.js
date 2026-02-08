/**
 * Credit Repair SaaS - Authentication Routes
 * Rutas de autenticación: registro, login, cambio de contraseña, 2FA
 *
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
} = require('../utils/validators');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendInternalError,
  handleValidationErrors,
  asyncHandler,
  sanitizeResponse,
} = require('../utils/responseHelpers');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * Genera un token JWT
 * @param {string} userId - UUID del usuario
 * @param {boolean} requires2FA - Si el usuario necesita completar 2FA
 * @returns {string} Token JWT
 */
const generateToken = (userId, requires2FA = false) => {
  return jwt.sign(
    { userId, requires2FA },
    process.env.JWT_SECRET,
    { expiresIn: requires2FA ? '5m' : (process.env.JWT_EXPIRE || '7d') }
  );
};

/**
 * Genera códigos de respaldo para 2FA
 * @returns {string[]} Array de 10 códigos de respaldo
 */
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

/**
 * Formatea los datos del usuario para la respuesta
 * @param {Object} user - Usuario de la base de datos
 * @returns {Object} Usuario formateado
 */
const formatUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  twoFactorEnabled: user.two_factor_enabled || false,
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo cliente
 * @access  Public
 */
router.post(
  '/register',
  registerValidation,
  asyncHandler(async (req, res) => {
    // Validar entrada
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { email, password, firstName, lastName, phone } = req.body;

    // Verificar si el email ya existe
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return sendError(res, 'Email already registered', 409);
    }

    // Hash de contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear usuario y perfil en transacción
    const result = await transaction(async (client) => {
      // Insertar usuario
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status)
         VALUES ($1, $2, $3, $4, $5, 'client', 'active')
         RETURNING id, email, first_name, last_name, role, two_factor_enabled, created_at`,
        [email, passwordHash, firstName, lastName, phone || null]
      );

      const user = userResult.rows[0];

      // Crear perfil de cliente
      await client.query(
        `INSERT INTO client_profiles (user_id, subscription_status)
         VALUES ($1, 'trial')`,
        [user.id]
      );

      // Registrar actividad
      await client.query(
        `INSERT INTO activity_log (user_id, action, description)
         VALUES ($1, 'user_registered', 'New user registration')`,
        [user.id]
      );

      return user;
    });

    // Generar token
    const token = generateToken(result.id);

    sendCreated(
      res,
      {
        token,
        user: formatUserResponse(result),
      },
      'User registered successfully'
    );
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post(
  '/login',
  loginValidation,
  asyncHandler(async (req, res) => {
    // Validar entrada
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { email, password, totpCode } = req.body;

    // Buscar usuario
    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, status, 
              two_factor_enabled, two_factor_secret, two_factor_backup_codes
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      await auditFromRequest(req, AUDIT_ACTIONS.LOGIN_FAILED, 'user', null, `Failed login attempt for: ${email}`, { email });
      return sendUnauthorized(res, 'Invalid credentials');
    }

    const user = result.rows[0];

    // Verificar estado de cuenta
    if (user.status !== 'active') {
      return sendError(res, 'Account is not active', 403);
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await auditFromRequest(req, AUDIT_ACTIONS.LOGIN_FAILED, 'user', user.id, `Failed password for: ${email}`, { email });
      return sendUnauthorized(res, 'Invalid credentials');
    }

    // Verificar si tiene 2FA habilitado
    if (user.two_factor_enabled && user.two_factor_secret) {
      // Si no se proporciona código TOTP, indicar que se requiere
      if (!totpCode) {
        const tempToken = generateToken(user.id, true);
        return sendSuccess(
          res,
          {
            requires2FA: true,
            tempToken,
            user: { email: user.email },
          },
          '2FA verification required'
        );
      }

      // Verificar código TOTP
      const isValidToken = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: totpCode,
        window: 2, // Permite 2 intervalos de diferencia (60 segundos)
      });

      // Si el código TOTP no es válido, verificar si es un código de respaldo
      if (!isValidToken) {
        let backupCodes = user.two_factor_backup_codes || [];
        const backupIndex = backupCodes.findIndex(code => code === totpCode.toUpperCase());
        
        if (backupIndex === -1) {
          return sendUnauthorized(res, 'Invalid verification code');
        }

        // Eliminar código de respaldo usado
        backupCodes.splice(backupIndex, 1);
        await query(
          'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
          [backupCodes, user.id]
        );
      }
    }

    // Actualizar último login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Registrar actividad
    await query(
      `INSERT INTO activity_log (user_id, action, description, ip_address)
       VALUES ($1, 'user_login', 'User logged in', $2)`,
      [user.id, req.ip]
    );

    // Generar token
    const token = generateToken(user.id);

    sendSuccess(
      res,
      {
        token,
        user: formatUserResponse(user),
      },
      'Login successful'
    );
  })
);

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Generar secreto y QR code para configurar 2FA
 * @access  Private
 */
router.post(
  '/2fa/setup',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Verificar si ya tiene 2FA habilitado
    const userResult = await query(
      'SELECT email, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    if (user.two_factor_enabled) {
      return sendError(res, '2FA is already enabled. Disable it first to set up again.', 400);
    }

    // Generar nuevo secreto
    const secret = speakeasy.generateSecret({
      name: `TriExpert Credit (${user.email})`,
      issuer: 'TriExpert Credit Repair',
      length: 32,
    });

    // Guardar secreto temporalmente (no habilitado aún)
    await query(
      'UPDATE users SET two_factor_secret = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [secret.base32, userId]
    );

    // Generar QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    sendSuccess(
      res,
      {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
      },
      '2FA setup initiated. Scan QR code with authenticator app.'
    );
  })
);

/**
 * @route   POST /api/auth/2fa/verify
 * @desc    Verificar código TOTP y habilitar 2FA
 * @access  Private
 */
router.post(
  '/2fa/verify',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return sendError(res, 'Verification code is required');
    }

    // Obtener secreto del usuario
    const userResult = await query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    if (!user.two_factor_secret) {
      return sendError(res, 'Please setup 2FA first', 400);
    }

    if (user.two_factor_enabled) {
      return sendError(res, '2FA is already enabled', 400);
    }

    // Verificar código TOTP
    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      return sendError(res, 'Invalid verification code. Please try again.', 400);
    }

    // Generar códigos de respaldo
    const backupCodes = generateBackupCodes();

    // Habilitar 2FA
    await query(
      `UPDATE users 
       SET two_factor_enabled = true, 
           two_factor_backup_codes = $1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [backupCodes, userId]
    );

    // Registrar actividad
    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, '2fa_enabled', 'Two-factor authentication enabled')`,
      [userId]
    );

    sendSuccess(
      res,
      {
        enabled: true,
        backupCodes,
      },
      '2FA enabled successfully. Save your backup codes in a safe place.'
    );
  })
);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Deshabilitar 2FA
 * @access  Private
 */
router.post(
  '/2fa/disable',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { code, password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return sendError(res, 'Password is required to disable 2FA');
    }

    // Obtener usuario
    const userResult = await query(
      'SELECT password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    if (!user.two_factor_enabled) {
      return sendError(res, '2FA is not enabled', 400);
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Invalid password');
    }

    // Si se proporciona código, verificarlo también
    if (code) {
      const isValidToken = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      // También verificar si es un código de respaldo
      const backupCodes = user.two_factor_backup_codes || [];
      const isBackupCode = backupCodes.includes(code.toUpperCase());

      if (!isValidToken && !isBackupCode) {
        return sendError(res, 'Invalid verification code', 400);
      }
    }

    // Deshabilitar 2FA
    await query(
      `UPDATE users 
       SET two_factor_enabled = false, 
           two_factor_secret = NULL,
           two_factor_backup_codes = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [userId]
    );

    // Registrar actividad
    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, '2fa_disabled', 'Two-factor authentication disabled')`,
      [userId]
    );

    sendSuccess(res, { enabled: false }, '2FA disabled successfully');
  })
);

/**
 * @route   GET /api/auth/2fa/status
 * @desc    Obtener estado de 2FA del usuario
 * @access  Private
 */
router.get(
  '/2fa/status',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = result.rows[0];
    const backupCodesRemaining = user.two_factor_backup_codes 
      ? user.two_factor_backup_codes.length 
      : 0;

    sendSuccess(res, {
      enabled: user.two_factor_enabled || false,
      backupCodesRemaining,
    });
  })
);

/**
 * @route   POST /api/auth/2fa/regenerate-backup
 * @desc    Regenerar códigos de respaldo
 * @access  Private
 */
router.post(
  '/2fa/regenerate-backup',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { code, password } = req.body;
    const userId = req.user.id;

    if (!password || !code) {
      return sendError(res, 'Password and verification code are required');
    }

    // Obtener usuario
    const userResult = await query(
      'SELECT password_hash, two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    if (!user.two_factor_enabled) {
      return sendError(res, '2FA is not enabled', 400);
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Invalid password');
    }

    // Verificar código TOTP
    const isValidToken = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValidToken) {
      return sendError(res, 'Invalid verification code', 400);
    }

    // Generar nuevos códigos de respaldo
    const backupCodes = generateBackupCodes();

    // Actualizar códigos
    await query(
      'UPDATE users SET two_factor_backup_codes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [backupCodes, userId]
    );

    // Registrar actividad
    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, '2fa_backup_regenerated', 'Backup codes regenerated')`,
      [userId]
    );

    sendSuccess(
      res,
      { backupCodes },
      'Backup codes regenerated successfully. Save them in a safe place.'
    );
  })
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.post(
  '/change-password',
  authenticateToken,
  changePasswordValidation,
  asyncHandler(async (req, res) => {
    // Validar entrada
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Obtener usuario actual
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return sendError(res, 'Current password is incorrect');
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, result.rows[0].password_hash);
    if (isSamePassword) {
      return sendError(res, 'New password must be different from current password');
    }

    // Hash de nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Registrar actividad
    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, 'password_changed', 'User changed password')`,
      [userId]
    );

    sendSuccess(res, {}, 'Password changed successfully');
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión (invalidar token en el cliente)
 * @access  Private
 */
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Registrar actividad de logout
    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, 'user_logout', 'User logged out')`,
      [req.user.id]
    );

    sendSuccess(res, {}, 'Logged out successfully');
  })
);

/**
 * @route   POST /api/auth/auth0/sync
 * @desc    Sincronizar usuario de Auth0 con la base de datos local
 * @access  Private (requires Auth0 token authentication)
 */
router.post(
  '/auth0/sync',
  authenticateToken,  // SECURED: Require valid Auth0 or local token
  asyncHandler(async (req, res) => {
    const { email, firstName, lastName, auth0Id, picture, emailVerified } = req.body;

    if (!email || !auth0Id) {
      return sendError(res, 'Email and Auth0 ID are required');
    }

    // Buscar usuario existente por auth0_id o email
    let result = await query(
      'SELECT id, email, first_name, last_name, role, status, auth0_id, two_factor_enabled FROM users WHERE auth0_id = $1',
      [auth0Id]
    );

    let user;
    let isNewUser = false;

    if (result.rows.length > 0) {
      // Usuario encontrado por auth0_id - actualizar datos
      user = result.rows[0];
      await query(
        `UPDATE users SET 
          email = $1,
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          picture = $4,
          email_verified = $5,
          last_login = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE auth0_id = $6
        RETURNING id, email, first_name, last_name, role, status, two_factor_enabled`,
        [email, firstName, lastName, picture, emailVerified, auth0Id]
      );
    } else {
      // Buscar por email
      result = await query(
        'SELECT id, email, first_name, last_name, role, status, auth0_id, two_factor_enabled FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length > 0) {
        // Usuario existe por email - vincular con Auth0
        user = result.rows[0];
        await query(
          `UPDATE users SET 
            auth0_id = $1,
            picture = $2,
            email_verified = $3,
            auth_provider = 'auth0',
            last_login = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE email = $4`,
          [auth0Id, picture, emailVerified, email]
        );
      } else {
        // Usuario nuevo - crear
        isNewUser = true;
        const createResult = await transaction(async (client) => {
          const userResult = await client.query(
            `INSERT INTO users (
              email, first_name, last_name, role, status, 
              auth0_id, picture, email_verified, auth_provider
            )
            VALUES ($1, $2, $3, 'client', 'active', $4, $5, $6, 'auth0')
            RETURNING id, email, first_name, last_name, role, status, two_factor_enabled`,
            [email, firstName || email.split('@')[0], lastName || '', auth0Id, picture, emailVerified]
          );

          const newUser = userResult.rows[0];

          // Crear perfil de cliente
          await client.query(
            `INSERT INTO client_profiles (user_id, subscription_status)
             VALUES ($1, 'trial')`,
            [newUser.id]
          );

          // Registrar actividad
          await client.query(
            `INSERT INTO activity_log (user_id, action, description)
             VALUES ($1, 'auth0_user_created', 'User created via Auth0 login')`,
            [newUser.id]
          );

          return newUser;
        });

        user = createResult;
      }
    }

    // Obtener datos actualizados del usuario
    const finalResult = await query(
      'SELECT id, email, first_name, last_name, role, status, two_factor_enabled FROM users WHERE auth0_id = $1 OR email = $2 LIMIT 1',
      [auth0Id, email]
    );

    if (finalResult.rows.length === 0) {
      return sendError(res, 'Failed to sync user', 500);
    }

    user = finalResult.rows[0];

    // Registrar actividad de sync
    if (!isNewUser) {
      await query(
        `INSERT INTO activity_log (user_id, action, description)
         VALUES ($1, 'auth0_sync', 'User synced via Auth0')`,
        [user.id]
      );
    }

    sendSuccess(
      res,
      {
        user: formatUserResponse(user),
        isNewUser,
      },
      isNewUser ? 'User created successfully' : 'User synced successfully'
    );
  })
);

module.exports = router;
