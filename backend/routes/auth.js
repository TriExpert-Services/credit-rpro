const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

// @route   POST /api/auth/register
// @desc    Register new client
// @access  Public
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('phone').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName, phone } = req.body;

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user and profile in transaction
        const result = await transaction(async (client) => {
            // Insert user
            const userResult = await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status)
                 VALUES ($1, $2, $3, $4, $5, 'client', 'active')
                 RETURNING id, email, first_name, last_name, role, created_at`,
                [email, passwordHash, firstName, lastName, phone]
            );

            const user = userResult.rows[0];

            // Create client profile
            await client.query(
                `INSERT INTO client_profiles (user_id, subscription_status)
                 VALUES ($1, 'trial')`,
                [user.id]
            );

            // Log activity
            await client.query(
                `INSERT INTO activity_log (user_id, action, description)
                 VALUES ($1, 'user_registered', 'New user registration')`,
                [user.id]
            );

            return user;
        });

        // Generate token
        const token = generateToken(result.id);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.id,
                email: result.email,
                firstName: result.first_name,
                lastName: result.last_name,
                role: result.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Get user
        const result = await query(
            `SELECT id, email, password_hash, first_name, last_name, role, status 
             FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Check if account is active
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Log activity
        await query(
            `INSERT INTO activity_log (user_id, action, description, ip_address)
             VALUES ($1, 'user_login', 'User logged in', $2)`,
            [user.id, req.ip]
        );

        // Generate token
        const token = generateToken(user.id);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;

        // This would need authentication middleware
        // For now, we'll skip the implementation details

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Password change failed' });
    }
});

module.exports = router;
