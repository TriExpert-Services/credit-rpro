/**
 * Admin Compliance Dashboard
 * View all compliance records, contracts, and audit trail
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Shield, FileText, DollarSign, AlertTriangle, CheckCircle,
  XCircle, Clock, Download, Filter, Search, RefreshCw,
  Loader2, Eye, Calendar, Users, Activity
} from 'lucide-react';

export default function AdminCompliance() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalContracts: 0,
    activeContracts: 0,
    cancellations: 0,
    pendingCompliance: 0
  });
  const [filters, setFilters] = useState({
    eventType: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.get('/compliance/events?limit=100'),
        api.get('/admin/compliance-stats').catch(() => ({ data: { data: {} } }))
      ]);

      setEvents(eventsRes.data?.data || eventsRes.data || []);
      setStats(statsRes.data?.data || statsRes.data || stats);
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'contract_signed': return <FileText className="w-4 h-4 text-green-600" />;
      case 'rights_acknowledged': return <Shield className="w-4 h-4 text-blue-600" />;
      case 'fees_acknowledged': return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'contract_cancelled': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventLabel = (type) => {
    const labels = {
      'contract_signed': 'Contrato Firmado',
      'rights_acknowledged': 'Derechos Reconocidos',
      'fees_acknowledged': 'Tarifas Reconocidas',
      'contract_cancelled': 'Contrato Cancelado'
    };
    return labels[type] || type;
  };

  const filteredEvents = events.filter(event => {
    if (filters.eventType && event.event_type !== filters.eventType) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const email = event.email?.toLowerCase() || '';
      const name = `${event.first_name || ''} ${event.last_name || ''}`.toLowerCase();
      if (!email.includes(searchLower) && !name.includes(searchLower)) return false;
    }
    return true;
  });

  const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-4 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cumplimiento Legal</h1>
          <p className="text-gray-500 mt-1">Registros de compliance CROA, FCRA, GLBA</p>
        </div>
        <button
          onClick={loadComplianceData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon={FileText}
          label="Total Contratos"
          value={stats.totalContracts}
          color="bg-indigo-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Contratos Activos"
          value={stats.activeContracts}
          color="bg-green-500"
        />
        <StatCard
          icon={XCircle}
          label="Cancelaciones"
          value={stats.cancellations}
          color="bg-red-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="Pendiente Compliance"
          value={stats.pendingCompliance}
          color="bg-amber-500"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'events', label: 'Eventos de Compliance', icon: Activity },
              { id: 'contracts', label: 'Contratos', icon: FileText },
              { id: 'audit', label: 'Auditoría', icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <select
              value={filters.eventType}
              onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Todos los eventos</option>
              <option value="contract_signed">Contratos Firmados</option>
              <option value="rights_acknowledged">Derechos Reconocidos</option>
              <option value="fees_acknowledged">Tarifas Reconocidas</option>
              <option value="contract_cancelled">Contratos Cancelados</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : activeTab === 'events' ? (
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hay eventos de compliance registrados</p>
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <div
                    key={event.id || index}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {getEventLabel(event.event_type)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          event.compliance_law === 'CROA' ? 'bg-blue-100 text-blue-700' :
                          event.compliance_law === 'FCRA' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {event.compliance_law}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {event.email || 'Usuario'} - {event.first_name} {event.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.created_at).toLocaleString('es-ES')}
                        </span>
                        <span>IP: {event.ip_address || 'N/A'}</span>
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'contracts' ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Vista de contratos en desarrollo</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Vista de auditoría en desarrollo</p>
            </div>
          )}
        </div>
      </div>

      {/* Legal Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900">Nota de Cumplimiento Legal</h3>
            <p className="text-sm text-amber-800 mt-1">
              Todos los registros mostrados aquí son requeridos por las leyes CROA, FCRA y GLBA. 
              Estos registros deben mantenerse por un mínimo de 5 años y estar disponibles para 
              inspección por parte de reguladores federales y estatales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
