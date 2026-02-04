/**
 * Credit Repair SaaS - Authentication Routes
 * Rutas de autenticación: registro, login, cambio de contraseña
 *
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

/**
 * Genera un token JWT
 * @param {string} userId - UUID del usuario
 * @returns {string} Token JWT
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
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
         RETURNING id, email, first_name, last_name, role, created_at`,
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

    const { email, password } = req.body;

    // Buscar usuario
    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, status
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
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
      return sendUnauthorized(res, 'Invalid credentials');
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

module.exports = router;
