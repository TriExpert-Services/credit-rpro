/**
 * Credit Repair SaaS - Auth0 Authentication Context
 * Integración de Auth0 con MFA para autenticación segura
 *
 * @module context/Auth0Context
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { authService, getErrorMessage } from '../services/api';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const AUTH_METHOD_KEY = 'auth_method';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Auth0 hooks
  const {
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
    user: auth0User,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const clearLocalStorage = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_METHOD_KEY);
  };

  // Sincronizar usuario de Auth0 con backend
  const syncAuth0User = useCallback(async () => {
    if (!isAuth0Authenticated || !auth0User) return null;

    setSyncInProgress(true);
    try {
      const token = await getAccessTokenSilently();
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(AUTH_METHOD_KEY, 'auth0');

      const response = await api.post('/auth/auth0/sync', {
        email: auth0User.email,
        firstName: auth0User.given_name || auth0User.nickname || auth0User.email?.split('@')[0],
        lastName: auth0User.family_name || '',
        auth0Id: auth0User.sub,
        picture: auth0User.picture,
        emailVerified: auth0User.email_verified,
      });

      const userData = response.data.user;
      if (!userData) {
        return null;
      }
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setAuthMethod('auth0');
      setSyncInProgress(false);
      return userData;
    } catch (error) {
      console.error('Auth sync error:', error.message);
      setSyncInProgress(false);
      return null;
    }
  }, [isAuth0Authenticated, auth0User, getAccessTokenSilently]);

  // Inicialización
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedMethod = localStorage.getItem(AUTH_METHOD_KEY);
        const token = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (isAuth0Authenticated && auth0User) {
          const syncedUser = await syncAuth0User();
          if (syncedUser) {
            setUser(syncedUser);
            setAuthMethod('auth0');
          } else {
            clearLocalStorage();
          }
        } else if (storedMethod === 'local' && token && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?.id && parsedUser?.email && parsedUser?.role) {
            setUser(parsedUser);
            setAuthMethod('local');
          } else {
            clearLocalStorage();
          }
        } else if (storedMethod === 'auth0' && !isAuth0Authenticated && !isAuth0Loading) {
          clearLocalStorage();
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    // Solo inicializar cuando Auth0 no está cargando
    if (!isAuth0Loading) {
      initializeAuth();
    }
  }, [isAuth0Authenticated, isAuth0Loading, auth0User, syncAuth0User]);

  // Login con Auth0
  const loginWithAuth0 = useCallback(async () => {
    try {
      await loginWithRedirect({
        appState: { returnTo: '/dashboard' },
      });
      return { success: true };
    } catch (error) {
      console.error('Auth0 login error:', error);
      return { success: false, error: 'Error al iniciar sesión con Auth0' };
    }
  }, [loginWithRedirect]);

  // Login tradicional con soporte 2FA
  const login = useCallback(async (email, password, totpCode = null) => {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email y contraseña son requeridos' };
      }

      const response = await authService.login({ email, password, totpCode });
      
      // Verificar si requiere 2FA
      if (response.data.requires2FA) {
        return { success: false, requires2FA: true };
      }

      const { token, user: userData } = response.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      localStorage.setItem(AUTH_METHOD_KEY, 'local');

      setUser(userData);
      setAuthMethod('local');

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: getErrorMessage(error, 'Error al iniciar sesión') };
    }
  }, []);

  // Registro con Auth0
  const registerWithAuth0 = useCallback(async () => {
    try {
      await loginWithRedirect({
        appState: { returnTo: '/dashboard' },
        authorizationParams: { screen_hint: 'signup' },
      });
      return { success: true };
    } catch (error) {
      console.error('Auth0 register error:', error);
      return { success: false, error: 'Error al registrarse con Auth0' };
    }
  }, [loginWithRedirect]);

  // Registro tradicional
  const register = useCallback(async (data) => {
    try {
      if (!data.email || !data.password || !data.firstName || !data.lastName) {
        return { success: false, error: 'Todos los campos obligatorios son requeridos' };
      }

      if (data.password.length < 6) {
        return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
      }

      const response = await authService.register(data);
      const { token, user: userData } = response.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      localStorage.setItem(AUTH_METHOD_KEY, 'local');

      setUser(userData);
      setAuthMethod('local');

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: getErrorMessage(error, 'Error al registrarse') };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    const currentMethod = authMethod || localStorage.getItem(AUTH_METHOD_KEY);
    clearLocalStorage();
    setUser(null);
    setAuthMethod(null);

    if (currentMethod === 'auth0') {
      auth0Logout({ logoutParams: { returnTo: window.location.origin } });
    }
  }, [authMethod, auth0Logout]);

  // Refrescar usuario
  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      if (authMethod === 'auth0') {
        const newToken = await getAccessTokenSilently();
        localStorage.setItem(TOKEN_KEY, newToken);
      }

      const response = await authService.getProfile();
      const userData = response.data.user;

      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [authMethod, getAccessTokenSilently, logout]);

  const value = useMemo(() => ({
    user,
    loading: loading || isAuth0Loading || syncInProgress,
    login,
    loginWithAuth0,
    register,
    registerWithAuth0,
    logout,
    refreshUser,
    authMethod,
    isAuthenticated: !!user,
    isAuth0: authMethod === 'auth0',
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'admin' || user?.role === 'staff',
    isClient: user?.role === 'client',
  }), [user, loading, isAuth0Loading, syncInProgress, login, loginWithAuth0, register, registerWithAuth0, logout, refreshUser, authMethod]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    return <Component {...props} />;
  };
};

export const withAdmin = (Component) => {
  return function AdminComponent(props) {
    const { isAdmin, loading, isAuthenticated } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (!isAdmin) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Acceso Denegado</h1>
            <p className="text-gray-600 mt-2">No tienes permisos para acceder a esta página.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default AuthContext;
