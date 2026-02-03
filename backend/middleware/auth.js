const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            // Get user from database
            const result = await query(
                'SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = result.rows[0];

            if (user.status !== 'active') {
                return res.status(403).json({ error: 'Account is not active' });
            }

            req.user = user;
            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Check if user has required role
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

// Check if user is admin or staff
const requireStaff = requireRole('admin', 'staff');

// Check if user is admin only
const requireAdmin = requireRole('admin');

// Check if user can access client data
const canAccessClient = async (req, res, next) => {
    const clientId = req.params.clientId || req.params.id;
    
    // Admins and staff can access any client
    if (req.user.role === 'admin' || req.user.role === 'staff') {
        return next();
    }

    // Clients can only access their own data
    if (req.user.role === 'client' && req.user.id === clientId) {
        return next();
    }

    return res.status(403).json({ error: 'Access denied to this client data' });
};

module.exports = {
    authenticateToken,
    requireRole,
    requireStaff,
    requireAdmin,
    canAccessClient
};
