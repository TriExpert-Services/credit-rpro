/**
 * Credit Repair SaaS - Authentication Context
 * Contexto de autenticación para gestionar el estado del usuario
 *
 * @module context/AuthContext
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService, getErrorMessage } from '../services/api';

/**
 * @typedef {Object} AuthUser
 * @property {string} id - UUID del usuario
 * @property {string} email - Email del usuario
 * @property {string} firstName - Nombre
 * @property {string} lastName - Apellido
 * @property {('client'|'admin'|'staff')} role - Rol del usuario
 */

/**
 * @typedef {Object} AuthResult
 * @property {boolean} success - Si la operación fue exitosa
 * @property {string} [error] - Mensaje de error si falló
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user - Usuario autenticado o null
 * @property {boolean} loading - Si está cargando el estado inicial
 * @property {boolean} isAuthenticated - Si hay un usuario autenticado
 * @property {boolean} isAdmin - Si el usuario es administrador
 * @property {boolean} isStaff - Si el usuario es staff o admin
 * @property {boolean} isClient - Si el usuario es cliente
 * @property {function(string, string): Promise<AuthResult>} login - Función para iniciar sesión
 * @property {function(Object): Promise<AuthResult>} register - Función para registrarse
 * @property {function(): void} logout - Función para cerrar sesión
 * @property {function(): Promise<void>} refreshUser - Función para refrescar datos del usuario
 */

/** @type {React.Context<AuthContextValue|null>} */
const AuthContext = createContext(null);

/**
 * Hook para acceder al contexto de autenticación
 * @returns {AuthContextValue} Contexto de autenticación
 * @throws {Error} Si se usa fuera de AuthProvider
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Clave para almacenar el token en localStorage
 * @type {string}
 */
const TOKEN_KEY = 'token';

/**
 * Clave para almacenar el usuario en localStorage
 * @type {string}
 */
const USER_KEY = 'user';

/**
 * Proveedor del contexto de autenticación
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes hijos
 * @returns {JSX.Element}
 *
 * @example
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export const AuthProvider = ({ children }) => {
  /** @type {[AuthUser|null, function]} */
  const [user, setUser] = useState(null);

  /** @type {[boolean, function]} */
  const [loading, setLoading] = useState(true);

  /**
   * Inicializa el estado de autenticación desde localStorage
   */
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (token && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Validar que el usuario tiene los campos requeridos
          if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.role) {
            setUser(parsedUser);
          } else {
            // Datos de usuario inválidos, limpiar
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // En caso de error, limpiar localStorage
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Inicia sesión con email y contraseña
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña
   * @param {string} [totpCode] - Código 2FA opcional
   * @returns {Promise<AuthResult>} Resultado de la operación
   */
  const login = useCallback(async (email, password, totpCode = null) => {
    try {
      // Validación básica
      if (!email || !password) {
        return {
          success: false,
          error: 'Email y contraseña son requeridos',
        };
      }

      const response = await authService.login({ email, password, totpCode });
      const { token, user: userData, requires2FA, tempToken } = response.data;

      // Si requiere 2FA, devolver estado especial
      if (requires2FA) {
        return {
          success: false,
          requires2FA: true,
          tempToken,
          email: response.data.user?.email || email,
          error: null,
        };
      }

      // Guardar en localStorage
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      // Actualizar estado
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Error al iniciar sesión'),
      };
    }
  }, []);

  /**
   * Registra un nuevo usuario
   * @param {Object} data - Datos de registro
   * @param {string} data.email - Email
   * @param {string} data.password - Contraseña
   * @param {string} data.firstName - Nombre
   * @param {string} data.lastName - Apellido
   * @param {string} [data.phone] - Teléfono
   * @returns {Promise<AuthResult>} Resultado de la operación
   */
  const register = useCallback(async (data) => {
    try {
      // Validación básica
      if (!data.email || !data.password || !data.firstName || !data.lastName) {
        return {
          success: false,
          error: 'Todos los campos obligatorios son requeridos',
        };
      }

      if (data.password.length < 6) {
        return {
          success: false,
          error: 'La contraseña debe tener al menos 6 caracteres',
        };
      }

      const response = await authService.register(data);
      const { token, user: userData } = response.data;

      // Guardar en localStorage
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      // Actualizar estado
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Error al registrarse'),
      };
    }
  }, []);

  /**
   * Cierra la sesión del usuario
   */
  const logout = useCallback(() => {
    // Limpiar localStorage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Limpiar estado
    setUser(null);
  }, []);

  /**
   * Refresca los datos del usuario desde el servidor
   * @returns {Promise<void>}
   */
  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        return;
      }

      const response = await authService.getProfile();
      const userData = response.data.user;

      // Actualizar localStorage y estado
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
      // Si hay error de autenticación, hacer logout
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  /**
   * Valor del contexto memoizado para evitar re-renders innecesarios
   * @type {AuthContextValue}
   */
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'admin' || user?.role === 'staff',
      isClient: user?.role === 'client',
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * HOC para requerir autenticación en un componente
 * @param {React.ComponentType} Component - Componente a proteger
 * @returns {React.ComponentType} Componente protegido
 *
 * @example
 * const ProtectedPage = withAuth(MyPage);
 */
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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

/**
 * HOC para requerir rol de admin
 * @param {React.ComponentType} Component - Componente a proteger
 * @returns {React.ComponentType} Componente protegido
 */
export const withAdmin = (Component) => {
  return function AdminComponent(props) {
    const { isAdmin, loading, isAuthenticated } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
