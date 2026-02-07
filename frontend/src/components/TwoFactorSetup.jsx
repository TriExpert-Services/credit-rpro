import { useState, useEffect } from 'react';
import { 
  Shield, Smartphone, Key, Copy, CheckCircle, AlertCircle, 
  Loader2, X, Eye, EyeOff, RefreshCw, AlertTriangle
} from 'lucide-react';
import api from '../services/api';

export default function TwoFactorSetup({ onClose, onStatusChange }) {
  const [step, setStep] = useState('status'); // status, setup, verify, backup, disable
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ enabled: false, backupCodesRemaining: 0 });
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/2fa/status');
      setStatus(res.data);
      setStep('status');
    } catch (err) {
      setError('Error loading 2FA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/auth/2fa/setup');
      setSetupData(res.data);
      setStep('setup');
    } catch (err) {
      setError(err.response?.data?.message || 'Error setting up 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.post('/auth/2fa/verify', { code });
      setBackupCodes(res.data.backupCodes);
      setStep('backup');
      setSuccess('2FA enabled successfully!');
      if (onStatusChange) onStatusChange(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.post('/auth/2fa/disable', { password, code: code || undefined });
      setSuccess('2FA disabled successfully');
      setStatus({ enabled: false, backupCodesRemaining: 0 });
      setStep('status');
      setPassword('');
      setCode('');
      if (onStatusChange) onStatusChange(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Error disabling 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackup = async () => {
    if (!password || !code) {
      setError('Please enter your password and current 2FA code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.post('/auth/2fa/regenerate-backup', { password, code });
      setBackupCodes(res.data.backupCodes);
      setStep('backup');
      setSuccess('Backup codes regenerated!');
    } catch (err) {
      setError(err.response?.data?.message || 'Error regenerating backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAllBackupCodes = () => {
    const text = backupCodes.join('\n');
    copyToClipboard(text);
  };

  if (loading && step === 'status') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-slate-700">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Two-Factor Authentication</h2>
              <p className="text-sm text-slate-400">Secure your account with 2FA</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 mb-6">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Status Step */}
          {step === 'status' && (
            <div className="space-y-6">
              <div className={`p-6 rounded-2xl border ${
                status.enabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    status.enabled ? 'bg-emerald-500/20' : 'bg-slate-700'
                  }`}>
                    <Shield className={`w-8 h-8 ${
                      status.enabled ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${
                      status.enabled ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {status.enabled ? '2FA is Enabled' : '2FA is Disabled'}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {status.enabled 
                        ? `${status.backupCodesRemaining} backup codes remaining`
                        : 'Add an extra layer of security to your account'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {!status.enabled ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-slate-400">
                    <Smartphone className="w-5 h-5 mt-0.5 flex-shrink-0 text-indigo-400" />
                    <p className="text-sm">
                      Use an authenticator app like <strong className="text-slate-200">Google Authenticator</strong>, 
                      <strong className="text-slate-200"> Authy</strong>, or 
                      <strong className="text-slate-200"> Microsoft Authenticator</strong> to generate verification codes.
                    </p>
                  </div>
                  <button
                    onClick={handleSetup}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    Enable 2FA
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {status.backupCodesRemaining < 5 && (
                    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">You're running low on backup codes. Consider regenerating them.</span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setStep('regenerate')}
                    className="w-full py-3 bg-slate-800 text-slate-200 rounded-xl font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Regenerate Backup Codes
                  </button>
                  
                  <button
                    onClick={() => setStep('disable')}
                    className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 border border-red-500/30"
                  >
                    <X className="w-5 h-5" />
                    Disable 2FA
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Setup Step - QR Code */}
          {step === 'setup' && setupData && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-slate-300 mb-4">
                  Scan this QR code with your authenticator app:
                </p>
                <div className="inline-block p-4 bg-white rounded-2xl">
                  <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-400 text-center">
                  Or enter this code manually:
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
                  <code className="flex-1 text-sm text-indigo-400 font-mono break-all">
                    {setupData.manualEntryKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupData.manualEntryKey)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  Enter the 6-digit code from your app:
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-center text-2xl tracking-widest font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('status'); setCode(''); setSetupData(null); }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Verify & Enable
                </button>
              </div>
            </div>
          )}

          {/* Backup Codes Step */}
          {step === 'backup' && backupCodes.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  Save these backup codes in a safe place. You can use them to access your account if you lose your phone.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-slate-800 rounded-xl border border-slate-700">
                {backupCodes.map((backupCode, index) => (
                  <div 
                    key={index}
                    className="p-2 bg-slate-900 rounded-lg text-center font-mono text-sm text-slate-300"
                  >
                    {backupCode}
                  </div>
                ))}
              </div>

              <button
                onClick={copyAllBackupCodes}
                className="w-full py-3 bg-slate-800 text-slate-200 rounded-xl font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                {copied ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Copy All Codes'}
              </button>

              <button
                onClick={() => { loadStatus(); setBackupCodes([]); }}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                I've Saved My Codes
              </button>
            </div>
          )}

          {/* Disable Step */}
          {step === 'disable' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  Disabling 2FA will make your account less secure. Are you sure?
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enter your password:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enter a 2FA code (optional):
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-center text-lg tracking-widest font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('status'); setPassword(''); setCode(''); }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable}
                  disabled={loading || !password}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
                  Disable 2FA
                </button>
              </div>
            </div>
          )}

          {/* Regenerate Step */}
          {step === 'regenerate' && (
            <div className="space-y-6">
              <p className="text-slate-300">
                To regenerate your backup codes, please verify your identity:
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enter your password:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enter a 2FA code from your app:
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-center text-lg tracking-widest font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('status'); setPassword(''); setCode(''); }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerateBackup}
                  disabled={loading || !password || code.length !== 6}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
