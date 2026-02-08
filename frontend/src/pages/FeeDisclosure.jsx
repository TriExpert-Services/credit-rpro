/**
 * Fee Disclosure Page
 * CROA-Compliant Fee Disclosure Before Payment
 * Must be acknowledged before any payment is processed
 */

import { useState } from 'react';
import { useAuth } from '../context/Auth0Context';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import {
  DollarSign, CheckCircle, AlertTriangle, CreditCard,
  Calendar, Shield, FileText, Loader2
} from 'lucide-react';

export default function FeeDisclosure() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlan = location.state?.plan || 'professional';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState({
    fees: false,
    noAdvanceFees: false,
    cancellation: false,
    noGuarantee: false
  });

  const plans = {
    basic: { name: 'Plan Básico', price: 49.99, disputes: 3 },
    professional: { name: 'Plan Profesional', price: 99.99, disputes: 'Ilimitadas' },
    premium: { name: 'Plan Premium', price: 149.99, disputes: 'Ilimitadas', extras: true }
  };

  const currentPlan = plans[selectedPlan] || plans.professional;
  const allAcknowledged = Object.values(acknowledged).every(v => v);

  const handleAcknowledge = (key) => {
    setAcknowledged(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = async () => {
    setLoading(true);
    setError('');

    try {
      // Record fee disclosure acknowledgment
      await api.post('/compliance/acknowledge-fees', {
        planType: selectedPlan,
        totalAmount: currentPlan.price,
        currency: 'USD',
        paymentSchedule: 'monthly',
        acknowledgments: acknowledged,
        acknowledgedAt: new Date().toISOString()
      });

      // Navigate to payment
      navigate('/pricing', { 
        state: { 
          feeDisclosureCompleted: true,
          selectedPlan 
        }
      });
    } catch (err) {
      setError('Error al procesar. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4 shadow-lg">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            DIVULGACIÓN DE TARIFAS
          </h1>
          <p className="text-slate-300">
            Requerido por la Ley CROA antes de procesar cualquier pago
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
          {/* Plan Summary */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm">Plan Seleccionado</p>
                <h2 className="text-2xl font-bold">{currentPlan.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-sm">Precio Mensual</p>
                <p className="text-3xl font-bold">${currentPlan.price}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Fee Breakdown */}
            <section className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Desglose de Tarifas
              </h3>
              <div className="bg-slate-700/30 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                  <span className="text-slate-300">Tarifa mensual de servicio</span>
                  <span className="font-semibold">${currentPlan.price}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                  <span className="text-slate-300">Cargo por configuración</span>
                  <span className="font-semibold text-emerald-400">$0.00</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                  <span className="text-slate-300">Cargos ocultos</span>
                  <span className="font-semibold text-emerald-400">NINGUNO</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-white font-bold">TOTAL MENSUAL</span>
                  <span className="text-2xl font-bold text-indigo-400">${currentPlan.price}</span>
                </div>
              </div>
            </section>

            {/* Services Included */}
            <section className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Servicios Incluidos
              </h3>
              <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/30">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Análisis completo de reportes de crédito</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Disputas con burós: {currentPlan.disputes}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Cartas de disputa generadas por IA</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Seguimiento de progreso en tiempo real</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Soporte por email y chat</span>
                  </li>
                  {currentPlan.extras && (
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Consultas telefónicas ilimitadas</span>
                    </li>
                  )}
                </ul>
              </div>
            </section>

            {/* Payment Schedule */}
            <section className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Calendario de Pagos
              </h3>
              <div className="bg-sky-500/10 rounded-xl p-6 border border-sky-500/30">
                <p className="text-sky-400 mb-4">
                  Su tarjeta será cargada <strong>mensualmente</strong> en la fecha de renovación:
                </p>
                <ul className="space-y-2 text-sky-300">
                  <li>• Primer cargo: Después de completar el período de 3 días de cancelación</li>
                  <li>• Cargos subsiguientes: Mismo día de cada mes</li>
                  <li>• Puede cancelar en cualquier momento antes de la fecha de renovación</li>
                </ul>
              </div>
            </section>

            {/* Legal Acknowledgments */}
            <section className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Reconocimientos Legales Requeridos
              </h3>
              <div className="space-y-4">
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  acknowledged.fees ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'
                }`}>
                  <input
                    type="checkbox"
                    checked={acknowledged.fees}
                    onChange={() => handleAcknowledge('fees')}
                    className="w-5 h-5 rounded border-slate-600/50 text-emerald-400 focus:ring-green-500 mt-0.5"
                  />
                  <span className="text-slate-300">
                    Entiendo que el costo total del servicio es <strong>${currentPlan.price}/mes</strong> y 
                    no hay cargos adicionales ocultos.
                  </span>
                </label>

                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  acknowledged.noAdvanceFees ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'
                }`}>
                  <input
                    type="checkbox"
                    checked={acknowledged.noAdvanceFees}
                    onChange={() => handleAcknowledge('noAdvanceFees')}
                    className="w-5 h-5 rounded border-slate-600/50 text-emerald-400 focus:ring-green-500 mt-0.5"
                  />
                  <span className="text-slate-300">
                    Entiendo que bajo la Ley CROA, no se me cobrará hasta que los servicios hayan sido 
                    completamente prestados o se haya cumplido el período de espera de 3 días.
                  </span>
                </label>

                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  acknowledged.cancellation ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'
                }`}>
                  <input
                    type="checkbox"
                    checked={acknowledged.cancellation}
                    onChange={() => handleAcknowledge('cancellation')}
                    className="w-5 h-5 rounded border-slate-600/50 text-emerald-400 focus:ring-green-500 mt-0.5"
                  />
                  <span className="text-slate-300">
                    Entiendo que puedo cancelar mi suscripción en cualquier momento y que tengo 
                    3 días hábiles para cancelar sin cargo alguno después de firmar el contrato.
                  </span>
                </label>

                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  acknowledged.noGuarantee ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'
                }`}>
                  <input
                    type="checkbox"
                    checked={acknowledged.noGuarantee}
                    onChange={() => handleAcknowledge('noGuarantee')}
                    className="w-5 h-5 rounded border-slate-600/50 text-emerald-400 focus:ring-green-500 mt-0.5"
                  />
                  <span className="text-slate-300">
                    Entiendo que el pago de estas tarifas <strong>NO garantiza</strong> ningún resultado 
                    específico en mi reporte de crédito o puntaje.
                  </span>
                </label>
              </div>
            </section>

            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/30">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-4 text-slate-300 bg-slate-700/50 rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleContinue}
                disabled={!allAcknowledged || loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Continuar al Pago
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
