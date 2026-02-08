/**
 * Subscription Pricing Page
 * Premium redesign with monthly/annual toggle, comparison table, and animations
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Check, X, Crown, Star, Loader2, Shield, Zap,
  CreditCard, RefreshCw, AlertCircle, CheckCircle2,
  ChevronDown, Phone, Mail, MessageSquare, Brain,
  FileText, BarChart3, Clock, Users, TrendingUp, Lock
} from 'lucide-react';

// ─── Comparison features for the table ───────────────────────────────────
const comparisonFeatures = [
  { category: 'Análisis de Crédito', features: [
    { label: 'Análisis completo de reporte', esencial: true, profesional: true },
    { label: 'Seguimiento de progreso en tiempo real', esencial: true, profesional: true },
    { label: 'Análisis con Inteligencia Artificial', esencial: false, profesional: true },
    { label: 'Monitoreo de crédito incluido', esencial: false, profesional: true },
  ]},
  { category: 'Disputas', features: [
    { label: 'Cartas de disputa personalizadas', esencial: true, profesional: true },
    { label: 'Disputas por mes', esencial: '5', profesional: 'Ilimitadas' },
    { label: 'Cartas de cese y desista', esencial: false, profesional: true },
    { label: 'Estrategia personalizada IA', esencial: false, profesional: true },
  ]},
  { category: 'Soporte', features: [
    { label: 'Acceso al portal 24/7', esencial: true, profesional: true },
    { label: 'Soporte por email', esencial: true, profesional: true },
    { label: 'Soporte prioritario chat y teléfono', esencial: false, profesional: true },
    { label: 'Llamada mensual de seguimiento', esencial: false, profesional: true },
  ]},
  { category: 'Garantía', features: [
    { label: 'Garantía de devolución', esencial: '90 días', profesional: '90 días' },
    { label: 'Cancelación sin penalidad', esencial: true, profesional: true },
  ]},
];

// ─── FAQ data ────────────────────────────────────────────────────────────
const faqs = [
  {
    q: '¿Cómo funciona la garantía de 90 días?',
    a: 'Si después de 90 días de servicio activo no ve ninguna mejora en su reporte de crédito (eliminación de items negativos o aumento de puntaje), puede solicitar un reembolso completo. Sin preguntas.'
  },
  {
    q: '¿Puedo cancelar en cualquier momento?',
    a: 'Sí, puede cancelar su suscripción en cualquier momento desde su dashboard. No hay contratos a largo plazo ni cargos por cancelación. Su servicio continuará hasta el final del período de facturación.'
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos todas las tarjetas de crédito y débito principales (Visa, MasterCard, American Express, Discover). Los pagos son procesados de forma segura por Stripe con encriptación de grado bancario.'
  },
  {
    q: '¿Cuánto tiempo toma ver resultados?',
    a: 'Los resultados varían según cada caso, pero el 85% de nuestros clientes ven mejoras en sus reportes de crédito dentro de 30-45 días. Los items más complejos pueden tomar hasta 90 días.'
  },
  {
    q: '¿Puedo cambiar de plan después?',
    a: 'Sí, puede actualizar o degradar su plan en cualquier momento. Si actualiza, la diferencia se prorratea. Si degrada, el cambio se aplica al siguiente ciclo de facturación.'
  },
  {
    q: '¿Qué incluye el análisis con IA?',
    a: 'Nuestro sistema de Inteligencia Artificial analiza su reporte de crédito, identifica las mejores estrategias de disputa, genera cartas personalizadas y prioriza los items con mayor impacto en su puntaje.'
  },
];

// ─── Testimonials ────────────────────────────────────────────────────────
const testimonials = [
  { name: 'María G.', score: '+127 pts', text: 'En solo 2 meses eliminaron 4 items negativos de mi reporte. Increíble servicio.' },
  { name: 'Carlos R.', score: '+89 pts', text: 'El análisis con IA me dio una estrategia clara. Mi crédito subió de 520 a 609.' },
  { name: 'Ana P.', score: '+156 pts', text: 'Después de años con mal crédito, finalmente pude calificar para mi hipoteca.' },
];

export default function Pricing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [error, setError] = useState('');
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  const sessionStatus = searchParams.get('session_status');
  const fromOnboarding = searchParams.get('from') === 'onboarding';

  const annualDiscount = 17; // % discount for annual

  useEffect(() => {
    if (sessionStatus === 'success') {
      fetchCurrentSubscription();
      if (fromOnboarding) {
        setTimeout(() => navigate('/onboarding'), 3000);
      }
    }
  }, [sessionStatus, fromOnboarding]);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
    fetchAccessStatus();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/subscriptions/plans');
      const data = response.data;
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error al cargar los planes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/current');
      const data = response.data;
      if (data?.hasSubscription && data?.subscription) {
        setCurrentSubscription(data.subscription);
      } else {
        setCurrentSubscription(null);
      }
    } catch (err) {
      setCurrentSubscription(null);
    }
  };

  const fetchAccessStatus = async () => {
    try {
      const response = await api.get('/subscriptions/access-status');
      setAccessStatus(response.data);
    } catch (err) {
      console.error('Error fetching access status:', err);
    }
  };

  const handleCheckout = async (planId) => {
    if (!user) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setCheckoutLoading(planId);
    setError('');

    try {
      const response = await api.post('/subscriptions/checkout', {
        planId,
        billingCycle,
      });
      
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Error al crear la sesión de pago');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al procesar el pago';
      setError(errorMessage);
      if (err.response?.data?.redirectTo === '/onboarding') {
        setTimeout(() => navigate('/onboarding'), 2000);
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!currentSubscription) return;
    try {
      const response = await api.post('/subscriptions/portal');
      const portalUrl = response.data?.url || response.data?.portalUrl;
      if (portalUrl) {
        window.location.href = portalUrl;
      }
    } catch (err) {
      setError('Error al abrir el portal de suscripción');
    }
  };

  const getPrice = (plan) => {
    if (billingCycle === 'yearly') {
      const yearly = parseFloat(plan.price_yearly || plan.price_monthly * 12);
      return Math.round(yearly / 12);
    }
    return Math.round(parseFloat(plan.price_monthly));
  };

  const getTotalPrice = (plan) => {
    if (billingCycle === 'yearly') {
      return parseFloat(plan.price_yearly || plan.price_monthly * 12);
    }
    return parseFloat(plan.price_monthly);
  };

  const getSavings = (plan) => {
    const monthly = parseFloat(plan.price_monthly) * 12;
    const yearly = parseFloat(plan.price_yearly || monthly);
    return Math.round(monthly - yearly);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background decorations */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-3xl" />
      </div>

      {/* ─── Hero Section ─── */}
      <div className="relative overflow-hidden">

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-5 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
              <Shield className="h-4 w-4" />
              Garantía de Devolución de 90 Días — Sin Riesgos
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
              Repare Su Crédito con
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Expertos Profesionales</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Nuestro equipo ha ayudado a miles de clientes a mejorar su puntaje de crédito. 
              Elija el plan que mejor se adapte a sus necesidades.
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-10 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Pago seguro con Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" />
              <span>Protección de datos GLBA</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              <span>+85% de clientes ven resultados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* ─── Status Messages ─── */}
        {sessionStatus === 'success' && (
          <div className="mb-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex items-center gap-4 animate-in backdrop-blur-sm">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-emerald-300">¡Pago exitoso!</h3>
              <p className="text-emerald-400/80">
                Su suscripción ha sido activada.
                {fromOnboarding ? ' Será redirigido para completar su registro...' : ' Ya puede acceder a todos los servicios.'}
              </p>
            </div>
            <button
              onClick={() => navigate(fromOnboarding ? '/onboarding' : '/dashboard')}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
            >
              {fromOnboarding ? 'Continuar Registro' : 'Ir al Dashboard'}
            </button>
          </div>
        )}

        {fromOnboarding && sessionStatus !== 'success' && (
          <div className="mb-8 bg-sky-500/10 border border-sky-500/30 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="h-6 w-6 text-sky-400" />
              <h3 className="text-lg font-semibold text-sky-300">Seleccione su plan para continuar</h3>
            </div>
            <p className="text-sky-400/80">
              Para completar su registro, seleccione y pague un plan de servicio. Después del pago, será redirigido para finalizar.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
            <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <span className="text-rose-300">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!fromOnboarding && accessStatus && !accessStatus.isAdmin && !accessStatus.onboardingComplete && (
          <div className="mb-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="h-6 w-6 text-amber-400" />
              <h3 className="text-lg font-semibold text-amber-300">Complete su registro primero</h3>
            </div>
            <p className="text-amber-400/80 mb-4">Antes de suscribirse, debe completar el proceso de registro con su información personal.</p>
            <button onClick={() => navigate('/onboarding')} className="px-5 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium">
              Completar Registro
            </button>
          </div>
        )}

        {/* ─── Current Subscription ─── */}
        {currentSubscription && (
          <div className="mb-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Plan Actual: {currentSubscription.planName || currentSubscription.plan_name || 'N/A'}
                  </h3>
                  <p className="text-white/90 text-sm">
                    Estado: <span className="capitalize">{currentSubscription.status === 'active' ? 'Activa' : currentSubscription.status}</span>
                    {(currentSubscription.currentPeriodEnd || currentSubscription.current_period_end) && (
                      <> · Próxima renovación: {new Date(currentSubscription.currentPeriodEnd || currentSubscription.current_period_end).toLocaleDateString('es-ES')}</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleManageSubscription}
                className="px-5 py-2.5 bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-xl hover:bg-white/30 transition-all flex items-center gap-2 font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Gestionar Suscripción
              </button>
            </div>
          </div>
        )}

        {/* ─── Billing Toggle ─── */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative inline-flex items-center bg-slate-800/80 rounded-2xl p-1.5 shadow-lg border border-slate-700/50 backdrop-blur-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                billingCycle === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`relative z-10 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                billingCycle === 'yearly'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Anual
            </button>
          </div>
          {billingCycle === 'yearly' && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 rounded-full text-sm font-medium">
              <Zap className="h-3.5 w-3.5" />
              Ahorra hasta {annualDiscount}% con el plan anual
            </div>
          )}
        </div>

        {/* ─── Pricing Cards ─── */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
          {plans.map((plan, idx) => {
            const isPopular = plan.includes_ai_analysis;
            const isCurrentPlan = currentSubscription?.id === plan.id || 
              currentSubscription?.planName === plan.name ||
              currentSubscription?.plan_name === plan.name;
            const features = plan.features || [];
            const price = getPrice(plan);
            const savings = getSavings(plan);

            return (
              <div
                key={plan.id}
                className={`relative group transition-all duration-500 ${
                  isPopular ? 'md:-translate-y-4' : ''
                }`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/30 flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Más Popular
                    </div>
                  </div>
                )}

                {/* Card */}
                <div className={`relative h-full bg-slate-800/60 backdrop-blur-sm rounded-3xl overflow-hidden transition-all duration-300 ${
                  isPopular
                    ? 'shadow-xl shadow-indigo-500/15 ring-2 ring-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/25'
                    : 'shadow-lg shadow-black/20 hover:shadow-xl border border-slate-700/50'
                } ${isCurrentPlan ? 'ring-2 ring-emerald-500' : ''}`}>
                  
                  {/* Current plan indicator */}
                  {isCurrentPlan && (
                    <div className="bg-emerald-500 text-white text-center py-2 text-sm font-semibold">
                      ✓ Su Plan Actual
                    </div>
                  )}

                  <div className="p-8 lg:p-10">
                    {/* Plan header */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2.5 rounded-xl ${isPopular ? 'bg-indigo-500/20' : 'bg-slate-700/50'}`}>
                        {isPopular
                          ? <Crown className="h-6 w-6 text-indigo-400" />
                          : <Star className="h-6 w-6 text-slate-400" />
                        }
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        {isPopular && (
                          <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                            <Brain className="h-3 w-3" /> Incluye IA
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                    {/* Price */}
                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-extrabold text-white">${price}</span>
                        <span className="text-slate-400 font-medium">/mes</span>
                      </div>
                      {billingCycle === 'yearly' ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-slate-500">
                            Facturado ${Math.round(getTotalPrice(plan))}/año
                          </p>
                          {savings > 0 && (
                            <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5" />
                              Ahorra ${savings}/año
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">Facturado mensualmente</p>
                      )}
                    </div>

                    {/* CTA button */}
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading || isCurrentPlan || (!fromOnboarding && accessStatus && !accessStatus.isAdmin && !accessStatus.onboardingComplete)}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all duration-300 ${
                        isCurrentPlan
                          ? 'bg-emerald-500/15 text-emerald-300 border-2 border-emerald-500/30 cursor-default'
                          : isPopular
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5'
                          : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                    >
                      {checkoutLoading === plan.id ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Procesando...
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Plan Actual
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5" />
                          {fromOnboarding ? 'Seleccionar Plan' : 'Comenzar Ahora'}
                        </>
                      )}
                    </button>

                    {/* Guarantee note */}
                    <p className="text-center text-xs text-slate-500 mt-3 flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3" />
                      Garantía de 90 días · Cancele cuando quiera
                    </p>

                    {/* Divider */}
                    <div className="border-t border-slate-700/30 mt-8 pt-8">
                      <p className="text-sm font-semibold text-white mb-4">
                        {isPopular ? 'Todo del Plan Esencial, más:' : 'Incluye:'}
                      </p>
                      <ul className="space-y-3">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <div className={`mt-0.5 p-0.5 rounded-full ${isPopular ? 'bg-indigo-500/20' : 'bg-emerald-500/20'}`}>
                              <Check className={`h-3.5 w-3.5 ${isPopular ? 'text-indigo-400' : 'text-emerald-400'}`} />
                            </div>
                            <span className="text-sm text-slate-300 leading-tight">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Social Proof ─── */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white">Lo Que Dicen Nuestros Clientes</h2>
            <p className="text-slate-400 mt-2">Resultados reales de personas como usted</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-slate-700/50 hover:shadow-lg hover:border-slate-600/50 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-emerald-400 font-bold text-xs">{t.score}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 text-amber-400 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Comparison Table ─── */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white">Comparación Detallada de Planes</h2>
            <p className="text-slate-400 mt-2">Vea exactamente qué incluye cada plan</p>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-slate-700/50 border-b border-slate-600/50">
              <div className="p-6 font-semibold text-slate-300">Características</div>
              <div className="p-6 text-center border-l border-slate-600/50">
                <p className="font-bold text-white">Esencial</p>
                <p className="text-sm text-slate-400">${getPrice(plans[0] || { price_monthly: 79, price_yearly: 790 })}/mes</p>
              </div>
              <div className="p-6 text-center border-l border-slate-600/50 bg-indigo-500/10">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="font-bold text-white">Profesional</p>
                  <Brain className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-sm text-indigo-400 font-medium">${getPrice(plans[1] || { price_monthly: 129, price_yearly: 1290 })}/mes</p>
              </div>
            </div>

            {/* Table body */}
            {comparisonFeatures.map((group, gi) => (
              <div key={gi}>
                {/* Category header */}
                <div className="grid grid-cols-3 bg-slate-700/20 border-t border-slate-700/30">
                  <div className="px-6 py-3 col-span-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.category}</p>
                  </div>
                </div>
                {/* Features */}
                {group.features.map((f, fi) => (
                  <div key={fi} className="grid grid-cols-3 border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <div className="px-6 py-4 text-sm text-slate-300">{f.label}</div>
                    <div className="px-6 py-4 flex items-center justify-center border-l border-slate-700/30">
                      {f.esencial === true ? (
                        <div className="p-1 bg-emerald-500/20 rounded-full"><Check className="h-3.5 w-3.5 text-emerald-400" /></div>
                      ) : f.esencial === false ? (
                        <div className="p-1 bg-slate-700/50 rounded-full"><X className="h-3.5 w-3.5 text-slate-500" /></div>
                      ) : (
                        <span className="text-sm font-semibold text-slate-300">{f.esencial}</span>
                      )}
                    </div>
                    <div className="px-6 py-4 flex items-center justify-center border-l border-slate-700/30 bg-indigo-500/5">
                      {f.profesional === true ? (
                        <div className="p-1 bg-indigo-500/20 rounded-full"><Check className="h-3.5 w-3.5 text-indigo-400" /></div>
                      ) : f.profesional === false ? (
                        <div className="p-1 bg-slate-700/50 rounded-full"><X className="h-3.5 w-3.5 text-slate-500" /></div>
                      ) : (
                        <span className="text-sm font-bold text-indigo-300">{f.profesional}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* CTA row */}
            <div className="grid grid-cols-3 border-t-2 border-slate-600/50 bg-slate-700/30">
              <div className="p-6" />
              <div className="p-6 flex justify-center border-l border-slate-700/30">
                <button
                  onClick={() => plans[0] && handleCheckout(plans[0].id)}
                  disabled={checkoutLoading || (!fromOnboarding && accessStatus && !accessStatus.isAdmin && !accessStatus.onboardingComplete)}
                  className="px-6 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-semibold text-sm hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  Elegir Esencial
                </button>
              </div>
              <div className="p-6 flex justify-center border-l border-slate-700/30 bg-indigo-500/10">
                <button
                  onClick={() => plans[1] && handleCheckout(plans[1].id)}
                  disabled={checkoutLoading || (!fromOnboarding && accessStatus && !accessStatus.isAdmin && !accessStatus.onboardingComplete)}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:from-indigo-600 hover:to-purple-600 transition-colors shadow-md shadow-indigo-500/25 disabled:opacity-50"
                >
                  Elegir Profesional
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── FAQ Section ─── */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white">Preguntas Frecuentes</h2>
            <p className="text-slate-400 mt-2">Todo lo que necesita saber antes de empezar</p>
          </div>
          
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-600/50 transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-semibold text-white pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-500 flex-shrink-0 transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Final CTA ─── */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-10 lg:p-14 text-white shadow-2xl shadow-indigo-500/20">
            <h2 className="text-3xl font-bold mb-4">
              ¿Listo para Mejorar Su Crédito?
            </h2>
            <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
              Empiece hoy con nuestra garantía de 90 días. Si no ve resultados, le devolvemos su dinero.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-white text-indigo-700 rounded-2xl font-bold text-base hover:bg-indigo-500/20 transition-colors shadow-lg"
              >
                Ver Planes
              </button>
              <a
                href="mailto:support@triexpertservice.com"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl font-bold text-base hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="h-5 w-5" />
                Contactar Soporte
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
