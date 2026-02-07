/**
 * Subscription Pricing Page
 * Displays available plans and allows subscription checkout
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Check, X, Crown, Star, Rocket, Loader2, Shield, 
  CreditCard, RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react';

const planIcons = {
  basic: Star,
  professional: Crown,
  premium: Rocket
};

export default function Pricing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [error, setError] = useState('');
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);

  // Check for success/cancel from Stripe checkout
  const sessionStatus = searchParams.get('session_status');
  const sessionId = searchParams.get('session_id');
  const fromOnboarding = searchParams.get('from') === 'onboarding';

  useEffect(() => {
    if (sessionStatus === 'success') {
      // Payment successful, refresh data
      fetchCurrentSubscription();
      
      // If coming from onboarding, redirect back after brief delay
      if (fromOnboarding) {
        setTimeout(() => {
          navigate('/onboarding');
        }, 3000);
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
      setPlans(response.data.data);
    } catch (err) {
      setError('Error al cargar los planes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/current');
      setCurrentSubscription(response.data.data);
    } catch (err) {
      // No subscription
    }
  };

  const fetchAccessStatus = async () => {
    try {
      const response = await api.get('/subscriptions/access-status');
      setAccessStatus(response.data.data);
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
      const response = await api.post('/subscriptions/checkout', { planId });
      
      if (response.data.data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = response.data.data.checkoutUrl;
      } else {
        setError('Error al crear la sesión de pago');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al procesar el pago';
      setError(errorMessage);
      
      // If onboarding not complete, redirect
      if (err.response?.data?.redirectTo === '/onboarding') {
        setTimeout(() => navigate('/onboarding'), 2000);
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await api.post('/subscriptions/portal');
      if (response.data.data.portalUrl) {
        window.location.href = response.data.data.portalUrl;
      }
    } catch (err) {
      setError('Error al abrir el portal de suscripción');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Planes de Reparación de Crédito
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Mejore su puntaje de crédito con nuestro servicio profesional. 
            <span className="text-primary-600 font-semibold"> Garantía de devolución de 90 días </span>
            si no ve resultados.
          </p>
        </div>

        {/* Success Message */}
        {sessionStatus === 'success' && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">¡Pago exitoso!</h3>
              <p className="text-green-600">
                Su suscripción ha sido activada. 
                {fromOnboarding 
                  ? ' Será redirigido para completar su registro...' 
                  : ' Ya puede acceder a todos los servicios.'}
              </p>
            </div>
            <button
              onClick={() => navigate(fromOnboarding ? '/onboarding' : '/dashboard')}
              className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {fromOnboarding ? 'Continuar Registro' : 'Ir al Dashboard'}
            </button>
          </div>
        )}

        {/* From Onboarding Message */}
        {fromOnboarding && sessionStatus !== 'success' && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="h-6 w-6 text-blue-500" />
              <h3 className="text-lg font-semibold text-blue-800">Seleccione su plan para continuar</h3>
            </div>
            <p className="text-blue-700">
              Para completar su registro, debe seleccionar y pagar un plan de servicio. 
              Después del pago, será redirigido para finalizar su registro.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Access Status Warning - Only show if NOT from onboarding */}
        {!fromOnboarding && accessStatus && !accessStatus.onboardingComplete && (
          <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <h3 className="text-lg font-semibold text-yellow-800">Complete su registro primero</h3>
            </div>
            <p className="text-yellow-700 mb-4">
              Antes de suscribirse, debe completar el proceso de registro con su información personal.
            </p>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              Completar Registro
            </button>
          </div>
        )}

        {/* Current Subscription */}
        {currentSubscription && (
          <div className="mb-8 bg-primary-50 border border-primary-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-800">
                  Plan Actual: {currentSubscription.plan_name}
                </h3>
                <p className="text-primary-600">
                  Estado: <span className="capitalize">{currentSubscription.status}</span>
                  {currentSubscription.current_period_end && (
                    <> • Próxima renovación: {new Date(currentSubscription.current_period_end).toLocaleDateString('es-ES')}</>
                  )}
                </p>
              </div>
              <button
                onClick={handleManageSubscription}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Gestionar Suscripción
              </button>
            </div>
          </div>
        )}

        {/* Guarantee Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">Garantía de Devolución de 90 Días</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.includes_ai_analysis ? Crown : Star;
            const isPopular = plan.includes_ai_analysis; // Professional plan is popular
            const isCurrentPlan = currentSubscription?.plan_id === plan.id;
            const features = plan.features || [];

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                  isPopular ? 'ring-2 ring-primary-500 scale-105' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-primary-500 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    Más Popular
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 bg-green-500 text-white px-4 py-1 text-sm font-semibold rounded-br-lg">
                    Plan Actual
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${isPopular ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <Icon className={`h-6 w-6 ${isPopular ? 'text-primary-600' : 'text-gray-600'}`} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">
                      ${parseFloat(plan.price_monthly).toFixed(0)}
                    </span>
                    <span className="text-gray-500">/mes</span>
                  </div>

                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  <ul className="space-y-3 mb-8">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={checkoutLoading || isCurrentPlan || (!fromOnboarding && !accessStatus?.onboardingComplete)}
                    className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      isCurrentPlan
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : isPopular
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                        Suscribirse
                      </>
                    )}
                  </button>
                </div>

                {/* Guarantee Footer */}
                <div className="bg-gray-50 px-8 py-4 border-t">
                  <p className="text-sm text-gray-500 text-center">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Garantía de 90 días incluida
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Preguntas Frecuentes
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                ¿Cómo funciona la garantía de 90 días?
              </h3>
              <p className="text-gray-600">
                Si después de 90 días de servicio activo no ve ninguna mejora en su reporte de crédito 
                (eliminación de items negativos o aumento de puntaje), puede solicitar un reembolso completo.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                ¿Puedo cancelar en cualquier momento?
              </h3>
              <p className="text-gray-600">
                Sí, puede cancelar su suscripción en cualquier momento. No hay contratos a largo plazo 
                ni cargos por cancelación.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                ¿Qué métodos de pago aceptan?
              </h3>
              <p className="text-gray-600">
                Aceptamos todas las tarjetas de crédito y débito principales (Visa, MasterCard, American Express, 
                Discover). Los pagos son procesados de forma segura por Stripe.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                ¿Cuánto tiempo toma ver resultados?
              </h3>
              <p className="text-gray-600">
                Los resultados varían según cada caso, pero típicamente los clientes comienzan a ver 
                mejoras en sus reportes de crédito dentro de 30-45 días después de iniciar el servicio.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            ¿Tiene preguntas? Estamos aquí para ayudar.
          </p>
          <a
            href="mailto:support@triexpertservice.com"
            className="text-primary-600 hover:text-primary-700 font-semibold"
          >
            support@triexpertservice.com
          </a>
        </div>
      </div>
    </div>
  );
}
