/**
 * Access Control Wrapper Component
 * Restricts access based on onboarding and subscription status
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import { Loader2, AlertCircle, Lock, CreditCard, FileText } from 'lucide-react';

const AccessContext = createContext(null);

export const useAccess = () => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within AccessProvider');
  }
  return context;
};

// Routes that don't require full access
const publicRoutes = ['/login', '/register', '/pricing', '/onboarding', '/'];
const partialAccessRoutes = ['/profile', '/settings', '/payment-history'];

export function AccessProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [accessStatus, setAccessStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      checkAccess();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, location.pathname]);

  const checkAccess = async () => {
    try {
      const response = await api.get('/subscriptions/access-status');
      console.log('Access status response:', response.data);
      // API returns { data: { ... } }
      setAccessStatus(response.data.data);
    } catch (err) {
      console.error('Error checking access:', err);
      // If endpoint doesn't exist or error, allow access (fail open for now)
      setAccessStatus({ hasAccess: true, isAdmin: user?.role === 'admin' });
    } finally {
      setLoading(false);
    }
  };

  const refreshAccess = async () => {
    setLoading(true);
    await checkAccess();
  };

  // Check if current route requires full access
  const isPublicRoute = publicRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );
  
  const isPartialAccessRoute = partialAccessRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  const value = {
    accessStatus,
    loading,
    refreshAccess,
    hasFullAccess: accessStatus?.hasAccess || false,
    isAdmin: accessStatus?.isAdmin || false,
    onboardingComplete: accessStatus?.onboardingComplete || false,
    hasSubscription: accessStatus?.hasSubscription || false,
  };

  // Don't block while loading
  if (loading || authLoading) {
    return (
      <AccessContext.Provider value={value}>
        {children}
      </AccessContext.Provider>
    );
  }

  // Don't block public routes
  if (isPublicRoute || !user) {
    return (
      <AccessContext.Provider value={value}>
        {children}
      </AccessContext.Provider>
    );
  }

  // Admin bypass
  if (accessStatus?.isAdmin) {
    return (
      <AccessContext.Provider value={value}>
        {children}
      </AccessContext.Provider>
    );
  }

  // Partial access routes (profile, settings) only need authentication
  if (isPartialAccessRoute) {
    return (
      <AccessContext.Provider value={value}>
        {children}
      </AccessContext.Provider>
    );
  }

  // Check onboarding completion
  if (!accessStatus?.onboardingComplete) {
    return (
      <AccessContext.Provider value={value}>
        <AccessBlockedPage 
          type="onboarding"
          message="Debe completar el proceso de registro antes de acceder a esta sección."
          onAction={() => navigate('/onboarding')}
          actionLabel="Completar Registro"
        />
      </AccessContext.Provider>
    );
  }

  // Check subscription
  if (!accessStatus?.hasSubscription) {
    return (
      <AccessContext.Provider value={value}>
        <AccessBlockedPage 
          type="subscription"
          message="Debe tener una suscripción activa para acceder a esta sección."
          onAction={() => navigate('/pricing')}
          actionLabel="Ver Planes"
        />
      </AccessContext.Provider>
    );
  }

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

function AccessBlockedPage({ type, message, onAction, actionLabel }) {
  const icons = {
    onboarding: FileText,
    subscription: CreditCard,
  };
  
  const Icon = icons[type] || Lock;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
            <Icon className="h-8 w-8 text-yellow-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Acceso Restringido
          </h1>
          
          <p className="text-gray-600 mb-8">
            {message}
          </p>
          
          <button
            onClick={onAction}
            className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * HOC to wrap protected pages
 */
export function withAccessControl(Component, options = {}) {
  return function ProtectedComponent(props) {
    const { hasFullAccess, loading, isAdmin, onboardingComplete, hasSubscription } = useAccess();
    const navigate = useNavigate();

    // Loading state
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      );
    }

    // Admin always has access
    if (isAdmin) {
      return <Component {...props} />;
    }

    // Check if only onboarding is required
    if (options.requireOnboarding && !options.requireSubscription) {
      if (!onboardingComplete) {
        return (
          <AccessBlockedPage 
            type="onboarding"
            message="Debe completar el proceso de registro antes de acceder a esta sección."
            onAction={() => navigate('/onboarding')}
            actionLabel="Completar Registro"
          />
        );
      }
      return <Component {...props} />;
    }

    // Full access required by default
    if (!hasFullAccess) {
      if (!onboardingComplete) {
        return (
          <AccessBlockedPage 
            type="onboarding"
            message="Debe completar el proceso de registro antes de acceder a esta sección."
            onAction={() => navigate('/onboarding')}
            actionLabel="Completar Registro"
          />
        );
      }
      
      return (
        <AccessBlockedPage 
          type="subscription"
          message="Debe tener una suscripción activa para acceder a esta sección."
          onAction={() => navigate('/pricing')}
          actionLabel="Ver Planes"
        />
      );
    }

    return <Component {...props} />;
  };
}

export default AccessProvider;
