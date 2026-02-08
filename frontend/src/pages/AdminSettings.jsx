/**
 * Admin Settings Page
 * Gestión de API Keys, configuraciones de sistema e integraciones
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Settings, Key, Mail, Bell, Shield, Database, Cloud, Save,
  Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Loader2,
  Server, CreditCard, Zap, Lock, Unlock, TestTube, Send, Building2, Globe
} from 'lucide-react';

const settingCategories = {
  api_keys: {
    title: 'API Keys',
    icon: Key,
    description: 'Claves de API para servicios externos',
    color: 'from-purple-500 to-indigo-600'
  },
  bureau_apis: {
    title: 'Bureau APIs',
    icon: Building2,
    description: 'Credenciales de Experian, Equifax, TransUnion',
    color: 'from-teal-500 to-cyan-600'
  },
  email: {
    title: 'Email / SMTP',
    icon: Mail,
    description: 'Configuración de envío de correos',
    color: 'from-blue-500 to-cyan-600'
  },
  auth: {
    title: 'Autenticación',
    icon: Shield,
    description: 'Auth0 y seguridad',
    color: 'from-green-500 to-emerald-600'
  },
  payments: {
    title: 'Pagos',
    icon: CreditCard,
    description: 'Stripe y procesamiento de pagos',
    color: 'from-orange-500 to-amber-600'
  },
  notifications: {
    title: 'Notificaciones',
    icon: Bell,
    description: 'Configuración de alertas',
    color: 'from-pink-500 to-rose-600'
  },
  system: {
    title: 'Sistema',
    icon: Server,
    description: 'Configuraciones generales',
    color: 'from-gray-500 to-slate-600'
  }
};

const defaultSettings = [
  // API Keys
  { key: 'OPENAI_API_KEY', category: 'api_keys', label: 'OpenAI API Key', type: 'api_key', sensitive: true, description: 'Clave para GPT-4 y análisis de IA' },
  { key: 'OPENAI_MODEL', category: 'api_keys', label: 'Modelo OpenAI', type: 'string', sensitive: false, description: 'gpt-4-turbo, gpt-4, gpt-3.5-turbo', defaultValue: 'gpt-4-turbo' },
  
  // Bureau APIs - Experian
  { key: 'EXPERIAN_CLIENT_ID', category: 'bureau_apis', label: 'Experian Client ID', type: 'string', sensitive: false, description: 'Client ID de Experian Connect API' },
  { key: 'EXPERIAN_CLIENT_SECRET', category: 'bureau_apis', label: 'Experian Client Secret', type: 'api_key', sensitive: true, description: 'Client Secret de Experian' },
  { key: 'EXPERIAN_SUBSCRIBER_CODE', category: 'bureau_apis', label: 'Experian Subscriber Code', type: 'string', sensitive: false, description: 'Código de suscriptor Experian' },
  { key: 'EXPERIAN_API_URL', category: 'bureau_apis', label: 'Experian API URL', type: 'string', sensitive: false, description: 'URL del API (sandbox o producción)', defaultValue: 'https://sandbox-us-api.experian.com' },
  
  // Bureau APIs - Equifax
  { key: 'EQUIFAX_CLIENT_ID', category: 'bureau_apis', label: 'Equifax Client ID', type: 'string', sensitive: false, description: 'Client ID de Equifax API' },
  { key: 'EQUIFAX_CLIENT_SECRET', category: 'bureau_apis', label: 'Equifax Client Secret', type: 'api_key', sensitive: true, description: 'Client Secret de Equifax' },
  { key: 'EQUIFAX_MEMBER_NUMBER', category: 'bureau_apis', label: 'Equifax Member Number', type: 'string', sensitive: false, description: 'Número de miembro Equifax' },
  { key: 'EQUIFAX_API_URL', category: 'bureau_apis', label: 'Equifax API URL', type: 'string', sensitive: false, description: 'URL del API (sandbox o producción)', defaultValue: 'https://api.sandbox.equifax.com' },
  
  // Bureau APIs - TransUnion
  { key: 'TRANSUNION_CLIENT_ID', category: 'bureau_apis', label: 'TransUnion Client ID', type: 'string', sensitive: false, description: 'Client ID de TransUnion API' },
  { key: 'TRANSUNION_CLIENT_SECRET', category: 'bureau_apis', label: 'TransUnion Client Secret', type: 'api_key', sensitive: true, description: 'Client Secret de TransUnion' },
  { key: 'TRANSUNION_SUBSCRIBER_CODE', category: 'bureau_apis', label: 'TransUnion Subscriber Code', type: 'string', sensitive: false, description: 'Código de suscriptor TransUnion' },
  { key: 'TRANSUNION_API_URL', category: 'bureau_apis', label: 'TransUnion API URL', type: 'string', sensitive: false, description: 'URL del API (sandbox o producción)', defaultValue: 'https://api.sandbox.transunion.com' },
  
  // Auth0
  { key: 'AUTH0_DOMAIN', category: 'auth', label: 'Auth0 Domain', type: 'string', sensitive: false, description: 'tu-tenant.us.auth0.com' },
  { key: 'AUTH0_CLIENT_ID', category: 'auth', label: 'Auth0 Client ID', type: 'string', sensitive: false, description: 'ID de la aplicación Auth0' },
  { key: 'AUTH0_CLIENT_SECRET', category: 'auth', label: 'Auth0 Client Secret', type: 'api_key', sensitive: true, description: 'Secret de Auth0' },
  { key: 'AUTH0_AUDIENCE', category: 'auth', label: 'Auth0 Audience', type: 'string', sensitive: false, description: 'URL de la API' },
  
  // SMTP
  { key: 'SMTP_HOST', category: 'email', label: 'SMTP Host', type: 'string', sensitive: false, description: 'smtp.gmail.com, smtp.sendgrid.net, etc.' },
  { key: 'SMTP_PORT', category: 'email', label: 'SMTP Port', type: 'number', sensitive: false, description: '587 para TLS, 465 para SSL', defaultValue: '587' },
  { key: 'SMTP_USER', category: 'email', label: 'SMTP Usuario', type: 'string', sensitive: false, description: 'Email o usuario SMTP' },
  { key: 'SMTP_PASS', category: 'email', label: 'SMTP Password', type: 'api_key', sensitive: true, description: 'Contraseña o App Password' },
  { key: 'SMTP_FROM_EMAIL', category: 'email', label: 'Email Remitente', type: 'string', sensitive: false, description: 'noreply@tudominio.com' },
  { key: 'SMTP_FROM_NAME', category: 'email', label: 'Nombre Remitente', type: 'string', sensitive: false, description: 'TriExpert Credit Repair' },
  
  // Stripe
  { key: 'STRIPE_SECRET_KEY', category: 'payments', label: 'Stripe Secret Key', type: 'api_key', sensitive: true, description: 'sk_live_... o sk_test_...' },
  { key: 'STRIPE_PUBLISHABLE_KEY', category: 'payments', label: 'Stripe Publishable Key', type: 'string', sensitive: false, description: 'pk_live_... o pk_test_...' },
  { key: 'STRIPE_WEBHOOK_SECRET', category: 'payments', label: 'Stripe Webhook Secret', type: 'api_key', sensitive: true, description: 'whsec_...' },
  
  // Notifications
  { key: 'ENABLE_EMAIL_NOTIFICATIONS', category: 'notifications', label: 'Notificaciones por Email', type: 'boolean', sensitive: false, description: 'Activar/desactivar emails' },
  { key: 'ENABLE_PUSH_NOTIFICATIONS', category: 'notifications', label: 'Notificaciones Push', type: 'boolean', sensitive: false, description: 'Activar/desactivar push' },
  { key: 'ADMIN_NOTIFICATION_EMAIL', category: 'notifications', label: 'Email Admin', type: 'string', sensitive: false, description: 'Email para alertas de admin' },
  
  // System
  { key: 'MAINTENANCE_MODE', category: 'system', label: 'Modo Mantenimiento', type: 'boolean', sensitive: false, description: 'Bloquear acceso a clientes' },
  { key: 'MAX_UPLOAD_SIZE_MB', category: 'system', label: 'Tamaño Máx. Upload (MB)', type: 'number', sensitive: false, description: 'Límite de archivos', defaultValue: '20' },
  { key: 'SESSION_TIMEOUT_MINUTES', category: 'system', label: 'Timeout Sesión (min)', type: 'number', sensitive: false, description: 'Tiempo de inactividad', defaultValue: '60' },
];

export default function AdminSettings() {
  const { user, isAdmin } = useAuth();
  const [activeCategory, setActiveCategory] = useState('api_keys');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showSecrets, setShowSecrets] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingBureau, setTestingBureau] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      const loadedSettings = {};
      
      if (response.data.settings) {
        response.data.settings.forEach(s => {
          loadedSettings[s.setting_key] = s.setting_value;
        });
      }
      
      // Merge with defaults
      defaultSettings.forEach(ds => {
        if (!loadedSettings[ds.key] && ds.defaultValue) {
          loadedSettings[ds.key] = ds.defaultValue;
        }
      });
      
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Error loading settings:', err);
      // Load defaults on error
      const defaults = {};
      defaultSettings.forEach(ds => {
        if (ds.defaultValue) defaults[ds.key] = ds.defaultValue;
      });
      setSettings(defaults);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSetting = async (settingDef) => {
    setSaving(prev => ({ ...prev, [settingDef.key]: true }));
    setError('');
    
    try {
      await api.post('/admin/settings', {
        settingKey: settingDef.key,
        settingValue: settings[settingDef.key] || '',
        settingType: settingDef.sensitive ? 'api_key' : settingDef.type,
        description: settingDef.description
      });
      
      setSuccess(`${settingDef.label} guardado correctamente`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Error guardando ${settingDef.label}: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [settingDef.key]: false }));
    }
  };

  const saveAllInCategory = async (category) => {
    const categorySettings = defaultSettings.filter(s => s.category === category);
    
    for (const setting of categorySettings) {
      if (settings[setting.key]) {
        await saveSetting(setting);
      }
    }
  };

  const testEmailConnection = async () => {
    setTestingEmail(true);
    setError('');
    
    try {
      const response = await api.post('/admin/test-email', {
        to: settings['ADMIN_NOTIFICATION_EMAIL'] || user.email
      });
      
      if (response.data.success) {
        setSuccess('Email de prueba enviado correctamente!');
      } else {
        setError(response.data.message || 'Error enviando email de prueba');
      }
    } catch (err) {
      setError(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setTestingEmail(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const testBureauConnection = async (bureau) => {
    setTestingBureau(prev => ({ ...prev, [bureau]: true }));
    setError('');
    
    try {
      const response = await api.get('/bureau/status');
      const status = response.data?.[bureau] || response.data?.data?.[bureau];
      
      if (status?.configured || status?.mode === 'live') {
        setSuccess(`${bureau.charAt(0).toUpperCase() + bureau.slice(1)}: Conexión verificada (modo ${status.mode || 'live'})`);
      } else {
        setSuccess(`${bureau.charAt(0).toUpperCase() + bureau.slice(1)}: Modo sandbox activo - configure las credenciales para modo producción`);
      }
    } catch (err) {
      setError(`Error verificando ${bureau}: ${err.response?.data?.message || err.message}`);
    } finally {
      setTestingBureau(prev => ({ ...prev, [bureau]: false }));
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const toggleShowSecret = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCategorySettings = (category) => {
    return defaultSettings.filter(s => s.category === category);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-slate-300 mt-2">Solo administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Cargando configuraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">API Keys, integraciones y ajustes del sistema</p>
          </div>
        </div>
        
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Recargar
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-4 sticky top-4">
            <h3 className="font-semibold text-white mb-4">Categorías</h3>
            <nav className="space-y-1">
              {Object.entries(settingCategories).map(([key, cat]) => {
                const Icon = cat.icon;
                const isActive = activeCategory === key;
                
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon size={20} />
                    <div className="text-left">
                      <p className="font-medium">{cat.title}</p>
                      {isActive && (
                        <p className="text-xs opacity-80">{cat.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
            {/* Category Header */}
            <div className={`bg-gradient-to-r ${settingCategories[activeCategory].color} p-6 text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = settingCategories[activeCategory].icon;
                    return <Icon size={28} />;
                  })()}
                  <div>
                    <h2 className="text-2xl font-bold">{settingCategories[activeCategory].title}</h2>
                    <p className="text-white/80">{settingCategories[activeCategory].description}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => saveAllInCategory(activeCategory)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50/20 hover:bg-slate-800/50/30 rounded-lg transition-colors"
                >
                  <Save size={18} />
                  Guardar Todo
                </button>
              </div>
            </div>

            {/* Settings List */}
            <div className="p-6 space-y-6">
              {getCategorySettings(activeCategory).map((setting) => (
                <div key={setting.key} className="border-b border-slate-700/30 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <label className="font-semibold text-white flex items-center gap-2">
                        {setting.sensitive && <Lock size={14} className="text-amber-500" />}
                        {setting.label}
                      </label>
                      <p className="text-sm text-slate-400 mt-1">{setting.description}</p>
                    </div>
                    
                    <button
                      onClick={() => saveSetting(setting)}
                      disabled={saving[setting.key]}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {saving[setting.key] ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Guardar
                    </button>
                  </div>
                  
                  <div className="mt-3">
                    {setting.type === 'boolean' ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings[setting.key] === 'true' || settings[setting.key] === true}
                          onChange={(e) => handleSettingChange(setting.key, e.target.checked.toString())}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-600/50 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-sm text-slate-300">
                          {settings[setting.key] === 'true' || settings[setting.key] === true ? 'Activado' : 'Desactivado'}
                        </span>
                      </label>
                    ) : setting.sensitive ? (
                      <div className="relative">
                        <input
                          type={showSecrets[setting.key] ? 'text' : 'password'}
                          value={settings[setting.key] || ''}
                          onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                          placeholder={`Ingresa ${setting.label}`}
                          className="w-full px-4 py-3 pr-12 bg-slate-700/30 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowSecret(setting.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showSecrets[setting.key] ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    ) : (
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        value={settings[setting.key] || ''}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        placeholder={`Ingresa ${setting.label}`}
                        className="w-full px-4 py-3 bg-slate-700/30 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Special Actions */}
              {activeCategory === 'email' && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h3 className="font-semibold text-white mb-4">Acciones</h3>
                  <button
                    onClick={testEmailConnection}
                    disabled={testingEmail}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {testingEmail ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                    Enviar Email de Prueba
                  </button>
                  <p className="text-sm text-slate-400 mt-2">
                    Se enviará un email de prueba a {settings['ADMIN_NOTIFICATION_EMAIL'] || user?.email || 'tu email'}
                  </p>
                </div>
              )}

              {/* Bureau API Actions */}
              {activeCategory === 'bureau_apis' && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h3 className="font-semibold text-white mb-4">Verificar Conexiones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['experian', 'equifax', 'transunion'].map(bureau => (
                      <button
                        key={bureau}
                        onClick={() => testBureauConnection(bureau)}
                        disabled={testingBureau[bureau]}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {testingBureau[bureau] ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Globe size={18} />
                        )}
                        {bureau.charAt(0).toUpperCase() + bureau.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
                    <p className="text-sm text-teal-300">
                      <strong>Modo Sandbox:</strong> Si no se configuran credenciales, el sistema genera datos 
                      simulados automáticamente para pruebas. Configure las credenciales reales para conectarse 
                      a los bureaus de crédito en producción.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertCircle className="text-amber-500" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-400">Importante</h4>
                  <p className="text-sm text-amber-300 mt-1">
                    Las API keys se encriptan antes de guardarse. Los cambios en algunas configuraciones 
                    pueden requerir reiniciar el servidor.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-sky-500/20 rounded-lg">
                  <Zap className="text-sky-400" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-sky-400">Tip</h4>
                  <p className="text-sm text-sky-400 mt-1">
                    Para Gmail, usa una "App Password" en lugar de tu contraseña normal.
                    Activa 2FA y genera una en tu cuenta de Google.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
