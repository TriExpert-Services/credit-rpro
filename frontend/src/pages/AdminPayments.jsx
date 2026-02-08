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
      const data = response.data;
      setTransactions(Array.isArray(data) ? data : data?.transactions || []);
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
          <Shield className="h-16 w-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white">Acceso Restringido</h2>
          <p className="text-slate-300">Solo administradores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Pagos</h1>
          <p className="text-slate-300">Administra transacciones, ingresos y reclamos de garantía</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchTransactions(); fetchGuaranteeClaims(); }}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/30 text-slate-300 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-rose-400">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-rose-400">×</button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <DollarSign className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Ingresos del Mes</p>
                <p className="text-2xl font-bold text-white">
                  ${parseFloat(stats.monthlyRevenue?.net || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-500/20 rounded-xl">
                <TrendingUp className="h-6 w-6 text-sky-400" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Ingresos Brutos</p>
                <p className="text-2xl font-bold text-white">
                  ${parseFloat(stats.monthlyRevenue?.gross || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Suscripciones Activas</p>
                <p className="text-2xl font-bold text-white">{stats.subscriptions?.active || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Reclamos Pendientes</p>
                <p className="text-2xl font-bold text-white">
                  {guaranteeClaims.filter(c => c.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border">
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
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600/50'
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
              <h3 className="text-lg font-semibold text-white">Distribución por Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.planDistribution?.map(plan => (
                  <div key={plan.name} className="bg-slate-700/30 rounded-xl p-4">
                    <h4 className="font-medium text-white">{plan.name}</h4>
                    <p className="text-2xl font-bold text-primary-600">{plan.subscribers}</p>
                    <p className="text-sm text-slate-400">suscriptores</p>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-white mt-8">Resumen del Mes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
                  <p className="text-sm text-emerald-400">Ingresos Brutos</p>
                  <p className="text-xl font-bold text-emerald-300">${parseFloat(stats.monthlyRevenue?.gross || 0).toLocaleString()}</p>
                </div>
                <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/30">
                  <p className="text-sm text-rose-400">Reembolsos</p>
                  <p className="text-xl font-bold text-rose-300">${parseFloat(stats.monthlyRevenue?.refunds || 0).toLocaleString()}</p>
                </div>
                <div className="bg-sky-500/10 rounded-xl p-4 border border-sky-500/30">
                  <p className="text-sm text-sky-400">Pagos del Mes</p>
                  <p className="text-xl font-bold text-sky-300">{stats.monthlyRevenue?.paymentCount || 0}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6">Reclamos de Garantía</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 border">
                  <p className="text-sm text-slate-300">Total Reclamos</p>
                  <p className="text-xl font-bold text-white">{stats.guaranteeClaims?.total || 0}</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                  <p className="text-sm text-amber-400">Pendientes</p>
                  <p className="text-xl font-bold text-amber-300">{stats.guaranteeClaims?.pending || 0}</p>
                </div>
                <div className="bg-sky-500/10 rounded-xl p-4 border border-sky-500/30">
                  <p className="text-sm text-sky-400">Total Reembolsado</p>
                  <p className="text-xl font-bold text-sky-300">${parseFloat(stats.guaranteeClaims?.totalRefunded || 0).toLocaleString()}</p>
                </div>
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
                    <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  className="px-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No se encontraron transacciones</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead className="bg-slate-700/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Plan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Monto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {transactions.map((tx) => {
                      const status = statusConfig[tx.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-sm text-white">
                            {new Date(tx.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-white">{tx.client_name || 'N/A'}</div>
                            <div className="text-xs text-slate-400">{tx.client_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-white">{tx.plan_name || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-white">
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
                  <Shield className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No hay reclamos de garantía</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {guaranteeClaims.map((claim) => {
                    const status = claimStatusConfig[claim.status] || claimStatusConfig.pending;
                    return (
                      <div key={claim.id} className="bg-slate-700/30 rounded-xl p-4 border">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-white">{claim.client_name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{claim.client_email}</p>
                            <p className="text-sm text-slate-300">
                              <strong>Razón:</strong> {claim.reason}
                            </p>
                            <p className="text-sm text-slate-400 mt-2">
                              Solicitado: {new Date(claim.created_at).toLocaleDateString('es-ES')}
                            </p>
                            {claim.subscription_start && (
                              <p className="text-sm text-slate-400">
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
                          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                            <p className="text-xs text-slate-400">Notas del administrador:</p>
                            <p className="text-sm text-slate-300">{claim.admin_notes}</p>
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
