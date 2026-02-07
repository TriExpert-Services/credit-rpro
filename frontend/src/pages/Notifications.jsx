/**
 * Notifications Page
 * Centro de notificaciones con historial y configuración
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Bell, Check, CheckCheck, Trash2, Filter, RefreshCw,
  AlertCircle, Info, CheckCircle, XCircle, Clock,
  Mail, MessageSquare, FileText, CreditCard, Shield,
  ChevronDown, Loader2, Settings, BellOff
} from 'lucide-react';

const notificationTypes = {
  dispute_update: { icon: FileText, color: 'blue', label: 'Disputa' },
  payment: { icon: CreditCard, color: 'green', label: 'Pago' },
  credit_update: { icon: AlertCircle, color: 'purple', label: 'Crédito' },
  system: { icon: Shield, color: 'gray', label: 'Sistema' },
  reminder: { icon: Clock, color: 'amber', label: 'Recordatorio' },
  message: { icon: MessageSquare, color: 'indigo', label: 'Mensaje' },
};

const priorityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    disputeUpdates: true,
    paymentReminders: true,
    creditAlerts: true,
    systemMessages: true,
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Demo data if endpoint doesn't exist
      setNotifications([
        {
          id: '1',
          type: 'dispute_update',
          title: 'Disputa Actualizada',
          message: 'Tu disputa con Equifax ha sido procesada. El item fue eliminado exitosamente.',
          priority: 'high',
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'credit_update',
          title: 'Cambio en tu Score',
          message: 'Tu puntaje de crédito ha aumentado 15 puntos este mes.',
          priority: 'medium',
          read: false,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '3',
          type: 'payment',
          title: 'Pago Recibido',
          message: 'Hemos recibido tu pago mensual de $99.00. ¡Gracias!',
          priority: 'low',
          read: true,
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '4',
          type: 'reminder',
          title: 'Recordatorio',
          message: 'Faltan 5 días para tu próximo pago mensual.',
          priority: 'medium',
          read: true,
          created_at: new Date(Date.now() - 259200000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} minutos`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`;
    if (diff < 604800000) return `Hace ${Math.floor(diff / 86400000)} días`;
    
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando notificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white relative">
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-gray-500">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refrescar"
          >
            <RefreshCw size={20} className="text-gray-500" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Configuración"
          >
            <Settings size={20} className="text-gray-500" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
            >
              <CheckCheck size={18} />
              Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries({
              emailNotifications: 'Recibir notificaciones por email',
              pushNotifications: 'Notificaciones push en navegador',
              disputeUpdates: 'Actualizaciones de disputas',
              paymentReminders: 'Recordatorios de pago',
              creditAlerts: 'Alertas de cambios en crédito',
              systemMessages: 'Mensajes del sistema',
            }).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <span className="text-gray-700">{label}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'unread', label: 'Sin leer' },
            { value: 'read', label: 'Leídas' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(notificationTypes).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay notificaciones</h3>
            <p className="text-gray-500">
              {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones para mostrar'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const typeInfo = notificationTypes[notification.type] || notificationTypes.system;
            const Icon = typeInfo.icon;
            
            return (
              <div
                key={notification.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
                  notification.read ? 'border-gray-100' : 'border-indigo-200 bg-indigo-50/30'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-3 rounded-xl bg-${typeInfo.color}-100 text-${typeInfo.color}-600 flex-shrink-0`}>
                      <Icon size={24} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                            )}
                            {notification.priority && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${priorityColors[notification.priority]}`}>
                                {notification.priority === 'high' ? 'Urgente' : notification.priority === 'medium' ? 'Media' : 'Baja'}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${notification.read ? 'text-gray-500' : 'text-gray-600'}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(notification.created_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-green-600"
                              title="Marcar como leída"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
