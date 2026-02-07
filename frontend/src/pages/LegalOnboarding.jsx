/**
 * Legal Onboarding Flow
 * Complete CROA-compliant onboarding process
 * Steps: 1. Rights → 2. Fee Disclosure → 3. Contract → 4. Complete
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Shield, DollarSign, FileText, CheckCircle, ArrowRight,
  ArrowLeft, Loader2, AlertTriangle, Scale, Phone, Mail
} from 'lucide-react';

// Step indicator component
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((step, index) => (
      <div key={index} className="flex items-center">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
          currentStep > index + 1 
            ? 'bg-green-500 border-green-500 text-white'
            : currentStep === index + 1
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white border-gray-300 text-gray-400'
        }`}>
          {currentStep > index + 1 ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <span className="text-sm font-bold">{index + 1}</span>
          )}
        </div>
        {index < steps.length - 1 && (
          <div className={`w-16 sm:w-24 h-1 mx-2 ${
            currentStep > index + 1 ? 'bg-green-500' : 'bg-gray-200'
          }`} />
        )}
      </div>
    ))}
  </div>
);

// Step 1: Consumer Rights
const RightsStep = ({ onNext, onAcknowledge }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    await onAcknowledge();
    setLoading(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Shield className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Sus Derechos del Consumidor</h2>
        <p className="text-gray-600">Requerido por la Ley CROA</p>
      </div>

      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
        <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5" />
          DECLARACIÓN DE DERECHOS DEL CONSUMIDOR
        </h3>
        <div className="space-y-4 text-amber-900 text-sm">
          <p>Bajo la Ley de Organizaciones de Reparación de Crédito (CROA), usted tiene derecho a:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Disputar información inexacta en su reporte de crédito directamente con los burós de crédito, <strong>sin costo alguno</strong>.</li>
            <li>Cancelar cualquier contrato con una organización de reparación de crédito dentro de <strong>3 días hábiles</strong> sin penalidad.</li>
            <li>Recibir una copia completa de su contrato antes de pagar cualquier tarifa.</li>
            <li>Conocer el costo total de los servicios antes de firmar cualquier contrato.</li>
            <li><strong>Demandar</strong> a una organización de reparación de crédito que viole la ley CROA.</li>
          </ul>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-3">Contacto de la FTC</h4>
        <p className="text-blue-800 text-sm">
          Federal Trade Commission<br />
          Consumer Response Center<br />
          600 Pennsylvania Avenue NW, Washington, DC 20580<br />
          <a href="https://www.ftc.gov" className="underline">www.ftc.gov</a>
        </p>
      </div>

      <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        acknowledged ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
      }`}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5"
        />
        <span className="text-gray-700">
          He leído y entiendo completamente mis derechos bajo la Ley de Organizaciones de Reparación de Crédito (CROA).
        </span>
      </label>

      <button
        onClick={handleContinue}
        disabled={!acknowledged || loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        Continuar
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// Step 2: Fee Disclosure
const FeeDisclosureStep = ({ onNext, onBack, selectedPlan, onAcknowledge }) => {
  const [acknowledged, setAcknowledged] = useState({
    fees: false,
    noAdvanceFees: false,
    noGuarantee: false
  });
  const [loading, setLoading] = useState(false);

  const plans = {
    basic: { name: 'Plan Básico', price: 49.99 },
    professional: { name: 'Plan Profesional', price: 99.99 },
    premium: { name: 'Plan Premium', price: 149.99 }
  };

  const plan = plans[selectedPlan] || plans.professional;
  const allAcknowledged = Object.values(acknowledged).every(v => v);

  const handleContinue = async () => {
    setLoading(true);
    await onAcknowledge(plan);
    setLoading(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <DollarSign className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Divulgación de Tarifas</h2>
        <p className="text-gray-600">Transparencia total antes del pago</p>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-indigo-200 text-sm">Plan Seleccionado</p>
            <h3 className="text-xl font-bold">{plan.name}</h3>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Precio Mensual</p>
            <p className="text-2xl font-bold">${plan.price}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 space-y-3">
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <span>Tarifa mensual de servicio</span>
          <span className="font-semibold">${plan.price}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <span>Cargo por configuración</span>
          <span className="font-semibold text-green-600">$0.00</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <span>Cargos ocultos</span>
          <span className="font-semibold text-green-600">NINGUNO</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="font-bold">TOTAL MENSUAL</span>
          <span className="text-xl font-bold text-indigo-600">${plan.price}</span>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { key: 'fees', text: `Entiendo que el costo total es $${plan.price}/mes sin cargos ocultos.` },
          { key: 'noAdvanceFees', text: 'Entiendo que no se me cobrará hasta después del período de cancelación de 3 días.' },
          { key: 'noGuarantee', text: 'Entiendo que el pago NO garantiza ningún resultado específico en mi crédito.' }
        ].map(({ key, text }) => (
          <label key={key} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            acknowledged[key] ? 'border-green-300 bg-green-50' : 'border-gray-200'
          }`}>
            <input
              type="checkbox"
              checked={acknowledged[key]}
              onChange={() => setAcknowledged(prev => ({ ...prev, [key]: !prev[key] }))}
              className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5"
            />
            <span className="text-gray-700">{text}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Atrás
        </button>
        <button
          onClick={handleContinue}
          disabled={!allAcknowledged || loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Continuar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Step 3: Contract Signing
const ContractStep = ({ onNext, onBack, user, onSign }) => {
  const [signature, setSignature] = useState('');
  const [acknowledged, setAcknowledged] = useState({
    readContract: false,
    understandTerms: false,
    cancelPolicy: false,
    accurateInfo: false
  });
  const [loading, setLoading] = useState(false);

  const expectedSignature = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const allAcknowledged = Object.values(acknowledged).every(v => v);
  const signatureValid = signature.toLowerCase() === expectedSignature.toLowerCase();

  const handleSign = async () => {
    setLoading(true);
    await onSign(signature, acknowledged);
    setLoading(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <FileText className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Contrato de Servicio</h2>
        <p className="text-gray-600">Firma digital requerida</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 max-h-64 overflow-y-auto text-sm text-gray-700">
        <h4 className="font-bold mb-3">CONTRATO DE SERVICIOS DE REPARACIÓN DE CRÉDITO</h4>
        <p className="mb-3">Este contrato establece los términos bajo los cuales Credit Repair Pro ("Compañía") proporcionará servicios de reparación de crédito al Cliente.</p>
        
        <h5 className="font-semibold mt-4 mb-2">1. Servicios</h5>
        <p>La Compañía se compromete a revisar reportes de crédito, identificar elementos negativos disputables, y enviar cartas de disputa a los burós de crédito en nombre del Cliente.</p>
        
        <h5 className="font-semibold mt-4 mb-2">2. Sin Garantías</h5>
        <p>La Compañía NO puede garantizar ningún resultado específico. La eliminación de elementos negativos depende de múltiples factores fuera de nuestro control.</p>
        
        <h5 className="font-semibold mt-4 mb-2">3. Derecho de Cancelación</h5>
        <p className="font-bold text-amber-700">USTED TIENE 3 DÍAS HÁBILES PARA CANCELAR SIN CARGO después de firmar este contrato.</p>
        
        <h5 className="font-semibold mt-4 mb-2">4. Tarifas</h5>
        <p>Las tarifas han sido divulgadas por separado y están sujetas al período de 3 días antes de cobro.</p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'readContract', text: 'He leído completamente el contrato de servicio.' },
          { key: 'understandTerms', text: 'Entiendo que NO hay garantía de resultados específicos.' },
          { key: 'cancelPolicy', text: 'Entiendo mi derecho a cancelar en 3 días hábiles sin cargo.' },
          { key: 'accurateInfo', text: 'Toda la información que he proporcionado es verdadera y precisa.' }
        ].map(({ key, text }) => (
          <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            acknowledged[key] ? 'border-green-300 bg-green-50' : 'border-gray-200'
          }`}>
            <input
              type="checkbox"
              checked={acknowledged[key]}
              onChange={() => setAcknowledged(prev => ({ ...prev, [key]: !prev[key] }))}
              className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5"
            />
            <span className="text-gray-700 text-sm">{text}</span>
          </label>
        ))}
      </div>

      <div className="bg-indigo-50 rounded-xl p-6 border-2 border-indigo-200">
        <label className="block text-sm font-semibold text-indigo-900 mb-2">
          Firma Digital - Escriba su nombre completo: "{expectedSignature}"
        </label>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={expectedSignature}
          className={`w-full px-4 py-3 border-2 rounded-xl text-lg font-serif italic ${
            signature && (signatureValid ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50')
          }`}
        />
        {signature && !signatureValid && (
          <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            La firma debe coincidir exactamente con: {expectedSignature}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Atrás
        </button>
        <button
          onClick={handleSign}
          disabled={!allAcknowledged || !signatureValid || loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Firmar Contrato
          <CheckCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Step 4: Completion
const CompletionStep = ({ contractData, onFinish }) => {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900">¡Registro Completado!</h2>
      <p className="text-gray-600">
        Ha completado exitosamente el proceso de registro legal.
      </p>

      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-left">
        <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          IMPORTANTE - Período de Cancelación
        </h3>
        <p className="text-amber-900">
          Tiene hasta el <strong>{new Date(contractData.cancellationDeadline).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</strong> para cancelar sin cargo alguno.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-left">
        <h3 className="font-semibold text-green-900 mb-3">Lo que sigue:</h3>
        <ul className="space-y-2 text-green-800">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Recibirá un email de confirmación
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Acceso completo al dashboard
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Puede empezar a cargar documentos
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Nuestro equipo revisará su caso
          </li>
        </ul>
      </div>

      <button
        onClick={onFinish}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
      >
        Ir al Dashboard
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// Main Component
export default function LegalOnboarding() {
  const { user, getToken } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [complianceStatus, setComplianceStatus] = useState(null);
  const [contractData, setContractData] = useState(null);
  const selectedPlan = 'professional'; // Could come from URL params or context

  const steps = ['Derechos', 'Tarifas', 'Contrato', 'Completado'];

  useEffect(() => {
    checkComplianceStatus();
  }, []);

  const checkComplianceStatus = async () => {
    try {
      const response = await api.get('/compliance/status');
      const status = response.data?.data || response.data;
      setComplianceStatus(status);
      
      // If already compliant, redirect to dashboard
      if (status.isCompliant) {
        navigate('/dashboard');
      }
    } catch (err) {
      console.log('No compliance status yet');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeRights = async () => {
    try {
      await api.post('/compliance/acknowledge-rights', {
        acknowledgedAt: new Date().toISOString(),
        rightsVersion: '1.0',
        acknowledgments: { croa: true, fcra: true }
      });
    } catch (err) {
      setError('Error al procesar. Por favor intente nuevamente.');
    }
  };

  const handleAcknowledgeFees = async (plan) => {
    try {
      await api.post('/compliance/acknowledge-fees', {
        planType: selectedPlan,
        totalAmount: plan.price,
        currency: 'USD',
        paymentSchedule: 'monthly',
        acknowledgments: { fees: true, noAdvanceFees: true, noGuarantee: true },
        acknowledgedAt: new Date().toISOString()
      });
    } catch (err) {
      setError('Error al procesar. Por favor intente nuevamente.');
    }
  };

  const handleSignContract = async (signature, acknowledgments) => {
    try {
      const signedAt = new Date().toISOString();
      const response = await api.post('/compliance/sign-contract', {
        contractType: 'service_agreement',
        signature,
        acknowledgments,
        signedAt,
        effectiveDate: signedAt
      });
      
      setContractData(response.data?.data || response.data);
    } catch (err) {
      setError('Error al firmar contrato. Por favor intente nuevamente.');
    }
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Proceso de Registro Legal</h1>
          <p className="text-gray-600">Complete estos pasos para activar su cuenta</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {currentStep === 1 && (
            <RightsStep 
              onNext={() => setCurrentStep(2)} 
              onAcknowledge={handleAcknowledgeRights}
            />
          )}
          {currentStep === 2 && (
            <FeeDisclosureStep 
              onNext={() => setCurrentStep(3)} 
              onBack={() => setCurrentStep(1)}
              selectedPlan={selectedPlan}
              onAcknowledge={handleAcknowledgeFees}
            />
          )}
          {currentStep === 3 && (
            <ContractStep 
              onNext={() => setCurrentStep(4)} 
              onBack={() => setCurrentStep(2)}
              user={user}
              onSign={handleSignContract}
            />
          )}
          {currentStep === 4 && (
            <CompletionStep 
              contractData={contractData}
              onFinish={handleFinish}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            ¿Preguntas? Contáctenos:
          </p>
          <div className="flex items-center justify-center gap-6 mt-2 text-sm text-gray-600">
            <a href="tel:+18133693340" className="flex items-center gap-1 hover:text-indigo-600">
              <Phone className="w-4 h-4" />
              (813) 369-3340
            </a>
            <a href="mailto:support@triexpertservice.com" className="flex items-center gap-1 hover:text-indigo-600">
              <Mail className="w-4 h-4" />
              support@triexpertservice.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
