const jwt = require('jsonwebtoken');
const { auth } = require('express-oauth2-jwt-bearer');
const jwksRsa = require('jwks-rsa');
const { query } = require('../config/database');

// Auth0 Configuration
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE;

// Create Auth0 JWT validator (only if Auth0 is configured)
let auth0JwtCheck = null;
if (auth0Domain && auth0Domain !== 'tu-tenant.us.auth0.com') {
    auth0JwtCheck = auth({
        audience: auth0Audience,
        issuerBaseURL: `https://${auth0Domain}`,
        tokenSigningAlg: 'RS256',
    });
}

// JWKS client for manual token verification
const jwksClient = auth0Domain && auth0Domain !== 'tu-tenant.us.auth0.com' 
    ? jwksRsa({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`
    })
    : null;

/**
 * Get signing key from Auth0 JWKS
 */
function getAuth0Key(header, callback) {
    if (!jwksClient) {
        return callback(new Error('Auth0 not configured'));
    }
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

/**
 * Verify if token is from Auth0 (JWT starts with eyJ and has auth0 issuer)
 */
function isAuth0Token(token) {
    try {
        const decoded = jwt.decode(token, { complete: true });
        if (decoded && decoded.payload && decoded.payload.iss) {
            return decoded.payload.iss.includes('auth0.com');
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Verify Auth0 token and get user info
 */
async function verifyAuth0Token(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getAuth0Key, {
            audience: auth0Audience,
            issuer: `https://${auth0Domain}/`,
            algorithms: ['RS256']
        }, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });
}

// Verify JWT token (supports both local JWT and Auth0 tokens)
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            console.log('Auth: No token provided');
            return res.status(401).json({ error: 'Access token required' });
        }

        // Check if it's an Auth0 token
        if (isAuth0Token(token) && auth0Domain && auth0Domain !== 'tu-tenant.us.auth0.com') {
            try {
                console.log('Auth: Verifying Auth0 token...');
                const decoded = await verifyAuth0Token(token);
                console.log('Auth: Auth0 token decoded, sub:', decoded.sub);
                
                // Find user by Auth0 ID (sub) or email
                const auth0Id = decoded.sub;
                const email = decoded.email || decoded['https://triexpertservice.com/email'];
                console.log('Auth: Looking for user with auth0_id:', auth0Id, 'email:', email);
                
                let result = await query(
                    'SELECT id, email, first_name, last_name, role, status FROM users WHERE auth0_id = $1',
                    [auth0Id]
                );

                // If not found by auth0_id, try email
                if (result.rows.length === 0 && email) {
                    result = await query(
                        'SELECT id, email, first_name, last_name, role, status FROM users WHERE email = $1',
                        [email]
                    );
                }

                if (result.rows.length === 0) {
                    console.log('Auth: User not found for auth0_id:', auth0Id);
                    return res.status(404).json({ error: 'User not found. Please sync your account.' });
                }

                const user = result.rows[0];
                console.log('Auth: User found:', user.email, 'role:', user.role);

                if (user.status !== 'active') {
                    return res.status(403).json({ error: 'Account is not active' });
                }

                req.user = user;
                req.auth0Token = decoded;
                return next();
            } catch (auth0Error) {
                console.error('Auth0 token verification failed:', auth0Error.message);
                return res.status(403).json({ error: 'Invalid Auth0 token: ' + auth0Error.message });
            }
        }

        // Local JWT verification
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

// Backwards-compatible exports:
// default export is the authenticateToken function, and helper functions are attached as properties
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireRole = requireRole;
module.exports.requireStaff = requireStaff;
module.exports.requireAdmin = requireAdmin;
module.exports.canAccessClient = canAccessClient;
