/**
 * Payment History Page
 * Shows all payment transactions for the user
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  CreditCard, Download, Search, Filter, Calendar,
  CheckCircle, XCircle, Clock, RefreshCw, Loader2,
  Receipt, DollarSign, AlertCircle, ArrowUpRight
} from 'lucide-react';

const statusConfig = {
  succeeded: { label: 'Completado', color: 'green', icon: CheckCircle },
  pending: { label: 'Pendiente', color: 'yellow', icon: Clock },
  failed: { label: 'Fallido', color: 'red', icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'blue', icon: RefreshCw },
  partially_refunded: { label: 'Reembolso Parcial', color: 'blue', icon: RefreshCw },
};

export default function PaymentHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchPayments();
    fetchSubscription();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await api.get('/subscriptions/payments');
      setPayments(response.data);
    } catch (err) {
      setError('Error al cargar el historial de pagos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/current');
      setSubscription(response.data);
    } catch (err) {
      // No subscription
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await api.post('/subscriptions/portal');
      if (response.data.portalUrl) {
        window.location.href = response.data.portalUrl;
      }
    } catch (err) {
      setError('Error al abrir el portal de pagos');
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        payment.transaction_id?.toLowerCase().includes(search) ||
        payment.description?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) {
      return false;
    }

    // Date range filter
    if (dateRange.start) {
      const paymentDate = new Date(payment.created_at);
      const startDate = new Date(dateRange.start);
      if (paymentDate < startDate) return false;
    }
    if (dateRange.end) {
      const paymentDate = new Date(payment.created_at);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      if (paymentDate > endDate) return false;
    }

    return true;
  });

  // Calculate totals
  const totalPaid = filteredPayments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);

  const totalRefunded = filteredPayments
    .filter(p => p.status === 'refunded' || p.status === 'partially_refunded')
    .reduce((sum, p) => sum + parseFloat(p.refund_amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Pagos</h1>
            <p className="text-gray-600">Vea todas sus transacciones y facturas</p>
          </div>
          <button
            onClick={handleManageSubscription}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Métodos de Pago
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Current Subscription Card */}
        {subscription && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-100 rounded-xl">
                  <Receipt className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Suscripción: {subscription.plan_name}
                  </h2>
                  <p className="text-gray-600">
                    ${subscription.amount}/mes • 
                    Próximo cargo: {new Date(subscription.current_period_end).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscription.status === 'active' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {subscription.status === 'active' ? 'Activa' : subscription.status}
              </span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Pagado</p>
                <p className="text-xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reembolsos</p>
                <p className="text-xl font-bold text-gray-900">${totalRefunded.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Receipt className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Transacciones</p>
                <p className="text-xl font-bold text-gray-900">{filteredPayments.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por ID o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-48">
              <div className="relative">
                <Filter className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 appearance-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="succeeded">Completados</option>
                  <option value="pending">Pendientes</option>
                  <option value="failed">Fallidos</option>
                  <option value="refunded">Reembolsados</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex gap-2 items-center">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400">a</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay transacciones</h3>
              <p className="text-gray-500">
                {payments.length === 0 
                  ? 'Aún no ha realizado ningún pago'
                  : 'No se encontraron transacciones con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => {
                  const status = statusConfig[payment.status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(payment.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(payment.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{payment.description || 'Pago de suscripción'}</div>
                        <div className="text-xs text-gray-500 font-mono">{payment.transaction_id?.slice(0, 20)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${parseFloat(payment.amount_paid || 0).toFixed(2)}
                        </div>
                        {payment.refund_amount > 0 && (
                          <div className="text-xs text-blue-600">
                            -${parseFloat(payment.refund_amount).toFixed(2)} reembolsado
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payment.invoice_url && (
                          <a
                            href={payment.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700"
                            title="Ver factura"
                          >
                            <ArrowUpRight className="h-5 w-5" />
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

        {/* Guarantee Claim Section */}
        {subscription && subscription.guarantee_eligible && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Garantía de 90 Días
            </h3>
            <p className="text-blue-700 mb-4">
              Si ha pasado 90 días desde que inició su suscripción y no ha visto resultados en su reporte de crédito,
              puede solicitar un reembolso completo.
            </p>
            <p className="text-sm text-blue-600 mb-4">
              Fecha de elegibilidad: {new Date(subscription.guarantee_end_date).toLocaleDateString('es-ES')}
            </p>
            <a
              href="/guarantee-claim"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Solicitar Reembolso por Garantía
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
