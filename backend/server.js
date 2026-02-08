require('dotenv').config();
require('express-async-errors'); // Catch unhandled async errors globally
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { pool } = require('./config/database');
const { authenticateToken } = require('./middleware/auth');
const { xssSanitize } = require('./middleware/sanitize');
const { logger, requestLogger } = require('./utils/logger');
const { initSentry, sentryErrorHandler } = require('./utils/sentry');
const { apmMiddleware } = require('./middleware/apm');
const { auditMiddleware } = require('./utils/auditLogger');
const {
  generalLimiter,
  authLimiter,
  sensitiveLimiter,
  writeLimiter,
  aiLimiter,
  uploadLimiter,
} = require('./middleware/rateLimiters');

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

// Monitoring routes (health checks, APM, audit logs)
const monitoringRoutes = require('./routes/monitoring');

const app = express();

// Initialize Sentry — MUST be before any other middleware
initSentry(app);

// Trust proxy (needed for rate limiting behind reverse proxy/Cloudflare)
app.set('trust proxy', 1);

// APM — track all request performance metrics
app.use(apmMiddleware);

// Security middleware - Helmet with Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://*.tawk.to',
        'https://cdn.jsdelivr.net',
        'https://js.stripe.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://*.tawk.to', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://*.tawk.to',
        'wss://*.tawk.to',
        'https://api.ipify.org',
        'https://api.stripe.com',
      ],
      frameSrc: ["'self'", 'https://*.tawk.to', 'https://js.stripe.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Compression - gzip/brotli for all responses
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Structured request logging
app.use(requestLogger);

// Rate limiting - general API
app.use('/api/', generalLimiter);

// Strict rate limiting for authentication endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', sensitiveLimiter);

// Per-endpoint rate limiters for sensitive / expensive operations
app.use('/api/users/:id', sensitiveLimiter);       // user deletion
app.use('/api/admin', sensitiveLimiter);             // admin settings
app.use('/api/ai-disputes', aiLimiter);              // AI generation
app.use('/api/credit-reports', aiLimiter);           // credit report analysis
app.use('/api/documents/upload', uploadLimiter);     // file uploads
app.use('/api/disputes', writeLimiter);              // dispute creation
app.use('/api/payments', writeLimiter);              // payment creation
app.use('/api/subscriptions', writeLimiter);         // subscription management

// Stripe webhook needs raw body - MUST be before body parser
app.use('/api/webhooks/stripe', stripeWebhookRoutes);

// Body parser middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// XSS sanitization - sanitize all string inputs
app.use(xssSanitize);

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
app.use('/api/users', auditMiddleware('user'), userRoutes);
app.use('/api/clients', auditMiddleware('client'), clientRoutes);
app.use('/api/credit-scores', auditMiddleware('credit_score'), creditScoreRoutes);
app.use('/api/credit-items', auditMiddleware('credit_item'), creditItemRoutes);
app.use('/api/disputes', auditMiddleware('dispute'), disputeRoutes);
app.use('/api/documents', auditMiddleware('document'), documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', auditMiddleware('payment'), paymentRoutes);
app.use('/api/ai-disputes', auditMiddleware('ai_dispute'), aiDisputeRoutes);

// Advanced feature routes
app.use('/api/admin', auditMiddleware('admin_settings'), adminSettingsRoutes);
app.use('/api/contracts', auditMiddleware('contract'), contractsRoutes);
app.use('/api/invoices', auditMiddleware('invoice'), invoicesRoutes);
app.use('/api/notifications', auditMiddleware('notification'), notificationsRoutes);
app.use('/api/notes', auditMiddleware('process_note'), processNotesRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/credit-reports', auditMiddleware('credit_report'), creditReportAnalysisRoutes);

// Subscription routes
app.use('/api/subscriptions', auditMiddleware('subscription'), subscriptionsRoutes);

// Plaid bank verification routes
app.use('/api/plaid', plaidRoutes);

// Compliance routes (CROA, FCRA, GLBA)
app.use('/api/compliance', auditMiddleware('compliance'), complianceRoutes);

// Monitoring routes (probes, health, metrics, audit logs)
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint (simple — for basic monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Credit Repair SaaS API',
        version: '1.0.0',
        status: 'running',
        monitoring: '/api/monitoring/health',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Sentry error handler — MUST be before custom error handler
app.use(sentryErrorHandler());

// Global error handler - never leak stack traces in production
app.use((err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';
    logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
    
    // Handle multer file size errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    
    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', errors: err.issues });
    }
    
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'Internal server error',
        ...(isDev && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Credit Repair SaaS API running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown - close server and DB pool
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        logger.info('HTTP server closed');
        try {
            await pool.end();
            logger.info('Database pool closed');
        } catch (err) {
            logger.error({ err }, 'Error closing database pool');
        }
        process.exit(0);
    });
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
