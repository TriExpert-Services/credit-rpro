require('dotenv').config();
require('express-async-errors'); // Catch unhandled async errors globally
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { pool } = require('./config/database');
const { authenticateToken } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const creditScoreRoutes = require('./routes/creditScores');
const creditItemRoutes = require('./routes/creditItems');
const disputeRoutes = require('./routes/disputes');
const documentRoutes = require('./routes/documents');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const aiDisputeRoutes = require('./routes/aiDisputes');

// New advanced feature routes
const adminSettingsRoutes = require('./routes/adminSettings');
const contractsRoutes = require('./routes/contracts');
const invoicesRoutes = require('./routes/invoices');
const notificationsRoutes = require('./routes/notifications');
const processNotesRoutes = require('./routes/processNotes');
const onboardingRoutes = require('./routes/onboarding');
const creditReportAnalysisRoutes = require('./routes/creditReportAnalysis');

// Stripe and subscription routes
const subscriptionsRoutes = require('./routes/subscriptions');
const stripeWebhookRoutes = require('./routes/stripeWebhook');

// Plaid bank verification routes
const plaidRoutes = require('./routes/plaid');

// Compliance routes (CROA, FCRA, GLBA)
const complianceRoutes = require('./routes/compliance');

const app = express();

// Trust proxy (needed for rate limiting behind reverse proxy/Cloudflare)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting - general API
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Only 10 login/register attempts per 15 min
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Stripe webhook needs raw body - MUST be before body parser
app.use('/api/webhooks/stripe', stripeWebhookRoutes);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Protected static files - require authentication to access uploads
app.use('/uploads', authenticateToken, (req, res, next) => {
    // Only allow access to own files for clients
    // Admins and staff can access all files
    if (req.user.role === 'client') {
        // Files are served from the static middleware below
        // The path validation happens in the document routes
    }
    next();
}, express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/credit-scores', creditScoreRoutes);
app.use('/api/credit-items', creditItemRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai-disputes', aiDisputeRoutes);

// Advanced feature routes
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notes', processNotesRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/credit-reports', creditReportAnalysisRoutes);

// Subscription routes
app.use('/api/subscriptions', subscriptionsRoutes);

// Plaid bank verification routes
app.use('/api/plaid', plaidRoutes);

// Compliance routes (CROA, FCRA, GLBA)
app.use('/api/compliance', complianceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Credit Repair SaaS API',
        version: '1.0.0',
        status: 'running'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler - never leak stack traces in production
app.use((err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';
    console.error(`[ERROR] ${req.method} ${req.path}:`, isDev ? err.stack : err.message);
    
    // Handle multer file size errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'Internal server error',
        ...(isDev && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Credit Repair SaaS API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown - close server and DB pool
const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await pool.end();
            console.log('Database pool closed');
        } catch (err) {
            console.error('Error closing database pool:', err);
        }
        process.exit(0);
    });
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
