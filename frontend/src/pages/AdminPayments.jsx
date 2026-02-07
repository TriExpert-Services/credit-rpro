/**
 * Admin Payment Management Page
 * View all transactions, revenue stats, and manage guarantee claims
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  DollarSign, TrendingUp, Users, CreditCard, Search, Filter,
  Calendar, CheckCircle, XCircle, Clock, RefreshCw, Loader2,
  Receipt, AlertCircle, Download, Eye, ChevronDown, ArrowUpRight,
  Shield, FileText, BarChart3
} from 'lucide-react';

const statusConfig = {
  succeeded: { label: 'Completado', color: 'green', icon: CheckCircle },
  pending: { label: 'Pendiente', color: 'yellow', icon: Clock },
  failed: { label: 'Fallido', color: 'red', icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'blue', icon: RefreshCw },
};

const claimStatusConfig = {
  pending: { label: 'Pendiente', color: 'yellow' },
  under_review: { label: 'En Revisión', color: 'blue' },
  approved: { label: 'Aprobado', color: 'green' },
  denied: { label: 'Denegado', color: 'red' },
  processed: { label: 'Procesado', color: 'gray' },
};

export default function AdminPayments() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data states
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [guaranteeClaims, setGuaranteeClaims] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchTransactions();
      fetchGuaranteeClaims();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/subscriptions/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end }),
      });
      
      const response = await api.get(`/subscriptions/admin/transactions?${params}`);
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setError('Error al cargar transacciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuaranteeClaims = async () => {
    try {
      const response = await api.get('/subscriptions/admin/guarantee-claims');
      setGuaranteeClaims(response.data || []);
    } catch (err) {
      console.error('Error fetching guarantee claims:', err);
    }
  };

  const handleProcessClaim = async (claimId, status, notes) => {
    try {
      await api.post(`/subscriptions/admin/process-claim/${claimId}`, {
        status,
        adminNotes: notes
      });
      fetchGuaranteeClaims();
      fetchStats();
    } catch (err) {
      setError('Error al procesar reclamo');
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [statusFilter, dateRange, page]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Acceso Restringido</h2>
          <p className="text-gray-600">Solo administradores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Pagos</h1>
          <p className="text-gray-600">Administra transacciones, ingresos y reclamos de garantía</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchTransactions(); fetchGuaranteeClaims(); }}
          className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ingresos del Mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${parseFloat(stats.monthlyRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ingresos Totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${parseFloat(stats.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Suscripciones Activas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeSubscriptions || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Shield className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reclamos Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {guaranteeClaims.filter(c => c.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            {[
              { id: 'overview', label: 'Resumen', icon: BarChart3 },
              { id: 'transactions', label: 'Transacciones', icon: Receipt },
              { id: 'claims', label: 'Reclamos Garantía', icon: Shield },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Distribución por Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.planDistribution?.map(plan => (
                  <div key={plan.plan_name} className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900">{plan.plan_name}</h4>
                    <p className="text-2xl font-bold text-primary-600">{plan.count}</p>
                    <p className="text-sm text-gray-500">suscriptores</p>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-8">Ingresos Recientes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transacciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.recentRevenue?.map((period, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-900">{period.period}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          ${parseFloat(period.revenue).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {period.transaction_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="succeeded">Completados</option>
                  <option value="pending">Pendientes</option>
                  <option value="failed">Fallidos</option>
                  <option value="refunded">Reembolsados</option>
                </select>

                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontraron transacciones</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((tx) => {
                      const status = statusConfig[tx.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(tx.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{tx.client_name || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{tx.client_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{tx.plan_name || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            ${parseFloat(tx.amount_paid || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {tx.receipt_url && (
                              <a
                                href={tx.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Guarantee Claims Tab */}
          {activeTab === 'claims' && (
            <div className="space-y-4">
              {guaranteeClaims.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay reclamos de garantía</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {guaranteeClaims.map((claim) => {
                    const status = claimStatusConfig[claim.status] || claimStatusConfig.pending;
                    return (
                      <div key={claim.id} className="bg-gray-50 rounded-xl p-4 border">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900">{claim.client_name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{claim.client_email}</p>
                            <p className="text-sm text-gray-700">
                              <strong>Razón:</strong> {claim.reason}
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                              Solicitado: {new Date(claim.created_at).toLocaleDateString('es-ES')}
                            </p>
                            {claim.subscription_start && (
                              <p className="text-sm text-gray-500">
                                Inicio suscripción: {new Date(claim.subscription_start).toLocaleDateString('es-ES')}
                              </p>
                            )}
                          </div>
                          
                          {claim.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleProcessClaim(claim.id, 'approved', '')}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleProcessClaim(claim.id, 'denied', '')}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                              >
                                Denegar
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {claim.admin_notes && (
                          <div className="mt-3 p-3 bg-white rounded-lg">
                            <p className="text-xs text-gray-500">Notas del administrador:</p>
                            <p className="text-sm text-gray-700">{claim.admin_notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
