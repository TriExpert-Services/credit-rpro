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
      
      setAccounts(accountsRes.data.accounts || []);
      setVerificationStatus(verificationRes.data);
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
      const data = response.data;
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
        <h1 className="text-3xl font-bold text-white">Cuentas Bancarias</h1>
        <p className="mt-2 text-slate-300">
          Conecte sus cuentas bancarias para verificación de identidad y análisis financiero
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-emerald-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-rose-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-rose-400">×</button>
        </div>
      )}

      {/* Verification Status Card */}
      <div className={`mb-8 p-6 rounded-xl border-2 ${
        verificationStatus?.isVerified 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${
            verificationStatus?.isVerified ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}>
            {verificationStatus?.isVerified ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : (
              <Shield className="h-8 w-8 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${
              verificationStatus?.isVerified ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {verificationStatus?.isVerified 
                ? 'Identidad Verificada' 
                : 'Verificación de Identidad Pendiente'}
            </h2>
            {verificationStatus?.isVerified ? (
              <div className="mt-2 space-y-1 text-emerald-400">
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
              <p className="mt-2 text-amber-400">
                Conecte una cuenta bancaria para verificar su identidad automáticamente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Cuentas Conectadas</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300"
            >
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showBalances ? 'Ocultar saldos' : 'Mostrar saldos'}
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-slate-500 hover:text-slate-300"
              title="Actualizar"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No hay cuentas bancarias conectadas</p>
            <p className="text-sm text-slate-500 mt-1">
              Conecte una cuenta para verificar su identidad
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.account_id}
                className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    account.type === 'depository' ? 'bg-sky-500/20 text-sky-400' :
                    account.type === 'credit' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-slate-700/50 text-slate-300'
                  }`}>
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {account.official_name || account.name}
                    </p>
                    <p className="text-sm text-slate-400">
                      {account.institution_name || 'Banco'} • {account.subtype} • ****{account.mask}
                    </p>
                  </div>
                </div>
                
                {showBalances && (
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Saldo disponible</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(account.available_balance)}
                    </p>
                    {account.current_balance !== account.available_balance && (
                      <p className="text-xs text-slate-500">
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
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Análisis de Ingresos</h2>
              <p className="text-sm text-slate-400">
                Analiza tus transacciones para estimar tus ingresos mensuales
              </p>
            </div>
            <button
              onClick={analyzeIncome}
              disabled={analyzingIncome}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-600 transition-colors"
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
              <div className="p-4 bg-emerald-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Ingreso Mensual Est.</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(incomeAnalysis.estimatedMonthlyIncome)}
                </p>
              </div>
              
              <div className="p-4 bg-sky-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-sky-400 mb-2">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm font-medium">Depósitos Totales</span>
                </div>
                <p className="text-2xl font-bold text-sky-400">
                  {formatCurrency(incomeAnalysis.totalIncome)}
                </p>
                <p className="text-xs text-blue-500">
                  {incomeAnalysis.incomeTransactions} transacciones
                </p>
              </div>
              
              <div className="p-4 bg-purple-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-purple-400 mb-2">
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm font-medium">Total Transacciones</span>
                </div>
                <p className="text-2xl font-bold text-purple-300">
                  {incomeAnalysis.totalTransactions}
                </p>
                <p className="text-xs text-purple-500">Últimos 90 días</p>
              </div>
            </div>
          )}

          {!incomeAnalysis && (
            <div className="text-center py-8 text-slate-400">
              <TrendingUp className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p>Haz clic en "Analizar Ingresos" para ver tu análisis financiero</p>
            </div>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-8 p-4 bg-slate-700/30 rounded-lg border">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-slate-500 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-slate-300">Conexión Segura</p>
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
