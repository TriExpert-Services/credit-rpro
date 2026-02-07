/**
 * Bank Accounts Page - Manage linked bank accounts
 * View, connect, and manage bank account connections
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import PlaidLinkButton from '../components/PlaidLink';
import {
  Building2, CreditCard, DollarSign, Wallet, CheckCircle2,
  AlertCircle, Loader2, RefreshCw, TrendingUp, Shield,
  Eye, EyeOff, FileText, Calendar
} from 'lucide-react';

export default function BankAccounts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [incomeAnalysis, setIncomeAnalysis] = useState(null);
  const [showBalances, setShowBalances] = useState(false);
  const [analyzingIncome, setAnalyzingIncome] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, verificationRes] = await Promise.all([
        api.get('/plaid/accounts'),
        api.get('/plaid/verification-status'),
      ]);
      
      setAccounts(accountsRes.data.data?.accounts || accountsRes.data.accounts || []);
      setVerificationStatus(verificationRes.data.data || verificationRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidSuccess = async () => {
    setSuccess('¡Cuenta bancaria conectada exitosamente!');
    await fetchData();
    setTimeout(() => setSuccess(''), 5000);
  };

  const analyzeIncome = async () => {
    setAnalyzingIncome(true);
    setError('');
    try {
      const response = await api.post('/plaid/get-transactions', { days: 90 });
      const data = response.data.data || response.data;
      setIncomeAnalysis(data);
      
      if (data.message) {
        // Show info message from backend
        setSuccess(data.message);
      } else {
        setSuccess('Análisis de ingresos completado');
      }
    } catch (err) {
      console.error('Income analysis error:', err);
      setError('Error al analizar ingresos. Asegúrate de tener una cuenta conectada.');
    } finally {
      setAnalyzingIncome(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'depository':
        return <Building2 className="h-6 w-6" />;
      case 'credit':
        return <CreditCard className="h-6 w-6" />;
      case 'investment':
        return <DollarSign className="h-6 w-6" />;
      default:
        return <Wallet className="h-6 w-6" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Cuentas Bancarias</h1>
        <p className="mt-2 text-gray-600">
          Conecte sus cuentas bancarias para verificación de identidad y análisis financiero
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Verification Status Card */}
      <div className={`mb-8 p-6 rounded-xl border-2 ${
        verificationStatus?.isVerified 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${
            verificationStatus?.isVerified ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            {verificationStatus?.isVerified ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <Shield className="h-8 w-8 text-yellow-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${
              verificationStatus?.isVerified ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {verificationStatus?.isVerified 
                ? 'Identidad Verificada' 
                : 'Verificación de Identidad Pendiente'}
            </h2>
            {verificationStatus?.isVerified ? (
              <div className="mt-2 space-y-1 text-green-700">
                {verificationStatus.verifiedName && (
                  <p>✓ Nombre: {verificationStatus.verifiedName}</p>
                )}
                {verificationStatus.verifiedEmail && (
                  <p>✓ Email: {verificationStatus.verifiedEmail}</p>
                )}
                {verificationStatus.verifiedPhone && (
                  <p>✓ Teléfono: {verificationStatus.verifiedPhone}</p>
                )}
                {verificationStatus.verifiedAt && (
                  <p className="text-sm mt-2">
                    Verificado el {new Date(verificationStatus.verifiedAt).toLocaleDateString('es-ES')}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-yellow-700">
                Conecte una cuenta bancaria para verificar su identidad automáticamente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Cuentas Conectadas</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showBalances ? 'Ocultar saldos' : 'Mostrar saldos'}
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-gray-600"
              title="Actualizar"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay cuentas bancarias conectadas</p>
            <p className="text-sm text-gray-400 mt-1">
              Conecte una cuenta para verificar su identidad
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.account_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    account.type === 'depository' ? 'bg-blue-100 text-blue-600' :
                    account.type === 'credit' ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {account.official_name || account.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {account.institution_name || 'Banco'} • {account.subtype} • ****{account.mask}
                    </p>
                  </div>
                </div>
                
                {showBalances && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Saldo disponible</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(account.available_balance)}
                    </p>
                    {account.current_balance !== account.available_balance && (
                      <p className="text-xs text-gray-400">
                        Actual: {formatCurrency(account.current_balance)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Connect New Account */}
        <div className="mt-6 pt-6 border-t">
          <PlaidLinkButton 
            onSuccess={handlePlaidSuccess}
            buttonText={accounts.length > 0 ? "Conectar Otra Cuenta" : "Conectar Cuenta Bancaria"}
            showAccounts={false}
          />
        </div>
      </div>

      {/* Income Analysis */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Análisis de Ingresos</h2>
              <p className="text-sm text-gray-500">
                Analiza tus transacciones para estimar tus ingresos mensuales
              </p>
            </div>
            <button
              onClick={analyzeIncome}
              disabled={analyzingIncome}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 transition-colors"
            >
              {analyzingIncome ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Analizar Ingresos
                </>
              )}
            </button>
          </div>

          {incomeAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Ingreso Mensual Est.</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(incomeAnalysis.estimatedMonthlyIncome)}
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm font-medium">Depósitos Totales</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(incomeAnalysis.totalIncome)}
                </p>
                <p className="text-xs text-blue-500">
                  {incomeAnalysis.incomeTransactions} transacciones
                </p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 text-purple-600 mb-2">
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm font-medium">Total Transacciones</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {incomeAnalysis.totalTransactions}
                </p>
                <p className="text-xs text-purple-500">Últimos 90 días</p>
              </div>
            </div>
          )}

          {!incomeAnalysis && (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>Haz clic en "Analizar Ingresos" para ver tu análisis financiero</p>
            </div>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700">Conexión Segura</p>
            <p>
              Usamos Plaid para conectar de forma segura con tu banco. 
              Nunca almacenamos tus credenciales bancarias y toda la información 
              está encriptada con tecnología de nivel bancario.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
