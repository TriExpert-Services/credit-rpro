/**
 * Access Control Middleware
 * Restricts access based on onboarding and subscription status
 */

const { pool, query } = require('../config/database');

/**
 * Check if user has completed onboarding
 */
const checkOnboardingComplete = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.payload?.sub;
    
    if (!auth0Id) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    // Get user and check onboarding status
    const userResult = await pool.query(
      `SELECT u.id, u.role, cp.onboarding_completed 
       FROM users u 
       LEFT JOIN client_profiles cp ON u.id = cp.user_id 
       WHERE u.auth0_id = $1`,
      [auth0Id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];

    // Admins bypass this check
    if (user.role === 'admin' || user.role === 'staff') {
      return next();
    }

    // Check if onboarding is complete
    if (!user.onboarding_completed) {
      return res.status(403).json({
        success: false,
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Debe completar el proceso de registro antes de continuar',
        redirectTo: '/onboarding'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado de registro'
    });
  }
};

/**
 * Check if user has an active subscription
 */
const checkActiveSubscription = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.payload?.sub;
    
    if (!auth0Id) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    // Get user
    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE auth0_id = $1',
      [auth0Id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];

    // Admins bypass this check
    if (user.role === 'admin' || user.role === 'staff') {
      return next();
    }

    // Check for active subscription
    const subscriptionResult = await pool.query(
      `SELECT id, status, current_period_end 
       FROM client_subscriptions 
       WHERE user_id = $1 
         AND status IN ('active', 'trialing')
         AND current_period_end > NOW()
       ORDER BY created_at DESC 
       LIMIT 1`,
      [user.id]
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Debe tener una suscripción activa para acceder a este recurso',
        redirectTo: '/pricing'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar suscripción'
    });
  }
};

/**
 * Combined check: onboarding AND subscription required
 */
const requireFullAccess = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.payload?.sub;
    
    if (!auth0Id) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    // Get complete user status
    const result = await pool.query(
      `SELECT 
        u.id,
        u.role,
        cp.onboarding_completed,
        cs.id as subscription_id,
        cs.status as subscription_status,
        cs.current_period_end
       FROM users u 
       LEFT JOIN client_profiles cp ON u.id = cp.user_id 
       LEFT JOIN client_subscriptions cs ON u.id = cs.user_id 
         AND cs.status IN ('active', 'trialing')
         AND cs.current_period_end > NOW()
       WHERE u.auth0_id = $1`,
      [auth0Id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];

    // Admins bypass all checks
    if (user.role === 'admin' || user.role === 'staff') {
      req.user = user;
      return next();
    }

    // Check onboarding first
    if (!user.onboarding_completed) {
      return res.status(403).json({
        success: false,
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Debe completar el proceso de registro antes de continuar',
        redirectTo: '/onboarding'
      });
    }

    // Then check subscription
    if (!user.subscription_id) {
      return res.status(403).json({
        success: false,
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Debe tener una suscripción activa para acceder a este recurso',
        redirectTo: '/pricing'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error checking full access:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar acceso'
    });
  }
};

/**
 * Get user access status (for frontend use)
 */
const getAccessStatus = async (auth0Id) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.role,
        u.email,
        cp.onboarding_completed,
        cp.full_name,
        cs.id as subscription_id,
        cs.status as subscription_status,
        cs.current_period_end,
        cs.plan_id,
        sp.name as plan_name
       FROM users u 
       LEFT JOIN client_profiles cp ON u.id = cp.user_id 
       LEFT JOIN client_subscriptions cs ON u.id = cs.user_id 
         AND cs.status IN ('active', 'trialing', 'past_due')
       LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
       WHERE u.auth0_id = $1
       ORDER BY cs.created_at DESC
       LIMIT 1`,
      [auth0Id]
    );

    if (result.rows.length === 0) {
      return {
        found: false,
        hasAccess: false,
        onboardingComplete: false,
        hasSubscription: false
      };
    }

    const user = result.rows[0];
    const isAdmin = user.role === 'admin' || user.role === 'staff';
    const onboardingComplete = !!user.onboarding_completed;
    const hasActiveSubscription = !!user.subscription_id && 
      user.subscription_status === 'active' &&
      new Date(user.current_period_end) > new Date();

    return {
      found: true,
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isAdmin,
      onboardingComplete,
      hasSubscription: !!user.subscription_id,
      subscriptionStatus: user.subscription_status,
      subscriptionEndDate: user.current_period_end,
      planName: user.plan_name,
      hasAccess: isAdmin || (onboardingComplete && hasActiveSubscription),
      redirectTo: !onboardingComplete ? '/onboarding' : !hasActiveSubscription ? '/pricing' : null
    };
  } catch (error) {
    console.error('Error getting access status:', error);
    throw error;
  }
};

module.exports = {
  checkOnboardingComplete,
  checkActiveSubscription,
  requireFullAccess,
  getAccessStatus
};
