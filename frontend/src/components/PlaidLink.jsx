/**
 * Plaid Link Component - Bank Account Connection
 * Allows users to connect their bank accounts via Plaid
 */

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from '../services/api';
import {
  Building2, Link2, Unlink, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, CreditCard, Wallet, DollarSign,
  Shield, Eye, EyeOff
} from 'lucide-react';

export default function PlaidLinkButton({ 
  onSuccess, 
  onExit, 
  buttonText = 'Conectar Cuenta Bancaria',
  className = '',
  products = ['auth', 'identity'],
  showAccounts = true 
}) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [showBalances, setShowBalances] = useState(false);

  // Fetch link token
  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/plaid/create-link-token', { products });
      setLinkToken(response.data.linkToken);
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError('Error al preparar conexión bancaria');
    } finally {
      setLoading(false);
    }
  }, [products]);

  // Fetch existing accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await api.get('/plaid/accounts');
      setAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  // Fetch verification status
  const fetchVerificationStatus = useCallback(async () => {
    try {
      const response = await api.get('/plaid/verification-status');
      setVerificationStatus(response.data);
    } catch (err) {
      console.error('Error fetching verification status:', err);
    }
  }, []);

  // Initialize on mount only - avoid dependency array issues causing multiple calls
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError('');
      try {
        const response = await api.post('/plaid/create-link-token', { products });
        if (mounted) {
          setLinkToken(response.data.linkToken);
        }
      } catch (err) {
        console.error('Error fetching link token:', err);
        if (mounted) setError('Error al preparar conexión bancaria');
      } finally {
        if (mounted) setLoading(false);
      }
      
      if (showAccounts && mounted) {
        try {
          const [accountsRes, verificationRes] = await Promise.all([
            api.get('/plaid/accounts'),
            api.get('/plaid/verification-status')
          ]);
          if (mounted) {
            setAccounts(accountsRes.data.accounts || []);
            setVerificationStatus(verificationRes.data);
          }
        } catch (err) {
          console.error('Error fetching data:', err);
        }
      }
    };
    
    init();
    
    return () => { mounted = false; };
  }, []); // Empty dependency array - run once on mount

  // Handle Plaid Link success
  const handleSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/plaid/exchange-token', {
        publicToken,
        metadata,
      });

      // Refresh accounts list
      await fetchAccounts();
      await fetchVerificationStatus();

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError('Error al conectar cuenta bancaria');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, fetchAccounts, fetchVerificationStatus]);

  // Handle Plaid Link exit
  const handleExit = useCallback((err, metadata) => {
    if (err) {
      console.error('Plaid Link error:', err);
      setError('Conexión cancelada o error');
    }
    if (onExit) {
      onExit(err, metadata);
    }
  }, [onExit]);

  // Configure Plaid Link
  const config = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  };

  const { open, ready } = usePlaidLink(config);

  // Remove account
  const handleRemoveAccount = async (itemId) => {
    if (!confirm('¿Está seguro de desconectar esta cuenta bancaria?')) return;
    
    setLoading(true);
    try {
      await api.delete(`/plaid/accounts/${itemId}`);
      await fetchAccounts();
    } catch (err) {
      setError('Error al desconectar cuenta');
    } finally {
      setLoading(false);
    }
  };

  // Get account type icon
  const getAccountIcon = (type) => {
    switch (type) {
      case 'depository':
        return <Building2 className="h-5 w-5" />;
      case 'credit':
        return <CreditCard className="h-5 w-5" />;
      case 'investment':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Verification Status */}
      {verificationStatus && (
        <div className={`p-4 rounded-lg border ${
          verificationStatus.isVerified 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            {verificationStatus.isVerified ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-yellow-500" />
            )}
            <div>
              <h4 className={`font-medium ${
                verificationStatus.isVerified ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {verificationStatus.isVerified 
                  ? 'Identidad Verificada' 
                  : 'Verificación Pendiente'}
              </h4>
              {verificationStatus.isVerified && verificationStatus.verifiedName && (
                <p className="text-sm text-green-600">
                  Nombre verificado: {verificationStatus.verifiedName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Connected Accounts */}
      {showAccounts && accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Cuentas Conectadas
            </h3>
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showBalances ? 'Ocultar' : 'Mostrar'} saldos
            </button>
          </div>

          <div className="grid gap-3">
            {accounts.map((account) => (
              <div
                key={account.account_id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
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
                      {account.institution_name} • ****{account.mask}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {showBalances && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Disponible</p>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(account.available_balance)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveAccount(account.item_id)}
                    disabled={loading}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Desconectar cuenta"
                  >
                    <Unlink className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => open()}
          disabled={!ready || loading}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            ready && !loading
              ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          } ${className}`}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Link2 className="h-5 w-5" />
              {accounts.length > 0 ? 'Conectar Otra Cuenta' : buttonText}
            </>
          )}
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="h-4 w-4" />
          <span>Conexión segura con encriptación de nivel bancario</span>
        </div>
      </div>

      {/* Refresh Button */}
      {showAccounts && accounts.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              fetchAccounts();
              fetchVerificationStatus();
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar información
          </button>
        </div>
      )}
    </div>
  );
}

// Simplified button version for onboarding
export function PlaidLinkSimple({ onSuccess, onError }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await api.post('/plaid/create-link-token', { 
          products: ['auth', 'identity'] 
        });
        setLinkToken(response.data.linkToken);
      } catch (err) {
        console.error('Error:', err);
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, []);

  const handleSuccess = async (publicToken, metadata) => {
    try {
      const response = await api.post('/plaid/exchange-token', {
        publicToken,
        metadata,
      });
      if (onSuccess) onSuccess(response.data);
    } catch (err) {
      if (onError) onError(err);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  });

  if (loading) {
    return (
      <button disabled className="w-full py-3 bg-gray-200 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      <Building2 className="h-5 w-5" />
      Verificar con Cuenta Bancaria
    </button>
  );
}
