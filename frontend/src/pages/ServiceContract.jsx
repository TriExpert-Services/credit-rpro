/**
 * Service Contract Page
 * CROA-Compliant Service Agreement
 * Must be signed BEFORE any services are provided
 */

import { useState, useRef } from 'react';
import { useAuth } from '../context/Auth0Context';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  FileText, CheckCircle, AlertTriangle, Pen, Calendar,
  DollarSign, Clock, Shield, Scale, Loader2
} from 'lucide-react';

export default function ServiceContract() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Read, 2: Acknowledge, 3: Sign
  const [acknowledgments, setAcknowledgments] = useState({
    readContract: false,
    understandRights: false,
    understandCancellation: false,
    understandNoGuarantee: false,
    understandFees: false,
    agreeTerms: false
  });
  const [signature, setSignature] = useState('');
  const signatureRef = useRef(null);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('es-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const contractEffectiveDate = today.toISOString().split('T')[0];

  const allAcknowledged = Object.values(acknowledgments).every(v => v);

  const handleAcknowledgmentChange = (key) => {
    setAcknowledgments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSign = async () => {
    if (!signature.trim()) {
      setError('Por favor ingrese su firma (nombre completo)');
      return;
    }

    if (signature.trim().toLowerCase() !== `${user?.firstName} ${user?.lastName}`.toLowerCase()) {
      setError('La firma debe coincidir con su nombre completo registrado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/compliance/sign-contract', {
        contractType: 'service_agreement',
        signature: signature.trim(),
        acknowledgments,
        signedAt: today.toISOString(),
        effectiveDate: contractEffectiveDate
      });

      // Redirect to dashboard after successful signing
      navigate('/dashboard', { 
        state: { message: '¡Contrato firmado exitosamente! Ya puede comenzar a usar nuestros servicios.' }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Error al firmar el contrato. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            CONTRATO DE SERVICIOS DE REPARACIÓN DE CRÉDITO
          </h1>
          <p className="text-gray-600">Por favor lea cuidadosamente antes de firmar</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-16 mb-8 text-sm text-gray-600">
          <span>Leer Contrato</span>
          <span>Reconocimientos</span>
          <span>Firmar</span>
        </div>

        {/* Contract Content */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Step 1: Read Contract */}
          {step === 1 && (
            <div className="p-8">
              <div className="prose max-w-none">
                {/* Contract Header */}
                <div className="text-center border-b-2 border-gray-300 pb-6 mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    ACUERDO DE SERVICIOS DE REPARACIÓN DE CRÉDITO
                  </h2>
                  <p className="text-gray-600">
                    Entre TriExpert Credit Repair ("La Compañía") y {user?.firstName} {user?.lastName} ("El Cliente")
                  </p>
                  <p className="text-gray-500 text-sm mt-2">Fecha: {formattedDate}</p>
                </div>

                {/* Section 1: Services */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
                    DESCRIPCIÓN DE SERVICIOS
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-gray-700 mb-4">La Compañía se compromete a proporcionar los siguientes servicios:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                      <li>Análisis completo de sus reportes de crédito de Equifax, Experian y TransUnion</li>
                      <li>Identificación de elementos negativos, inexactos o no verificables</li>
                      <li>Preparación y envío de cartas de disputa a las agencias de crédito</li>
                      <li>Seguimiento del progreso de las disputas</li>
                      <li>Educación y orientación sobre mejores prácticas de crédito</li>
                      <li>Acceso a la plataforma en línea para monitoreo de su caso</li>
                    </ul>
                  </div>
                </section>

                {/* Section 2: Fees */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
                    TARIFAS Y PAGOS
                  </h3>
                  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-1">Plan Mensual</p>
                        <p className="text-2xl font-bold text-gray-900">$99.99/mes</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-1">Cargo por Configuración</p>
                        <p className="text-2xl font-bold text-gray-900">$0.00</p>
                      </div>
                    </div>
                    <p className="text-green-800 text-sm">
                      <strong>IMPORTANTE:</strong> De conformidad con la Ley CROA, NO se cobrarán tarifas 
                      hasta que los servicios hayan sido completamente prestados.
                    </p>
                  </div>
                </section>

                {/* Section 3: Duration */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
                    DURACIÓN DEL CONTRATO
                  </h3>
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <p className="text-blue-800">
                      Este contrato es de mes a mes y puede ser cancelado por cualquiera de las partes 
                      con 30 días de aviso previo. El proceso típico de reparación de crédito toma 
                      de 3 a 6 meses, aunque los resultados pueden variar.
                    </p>
                  </div>
                </section>

                {/* Section 4: No Guarantees */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
                    AUSENCIA DE GARANTÍAS
                  </h3>
                  <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                    <p className="text-red-800 font-semibold mb-4">
                      LA COMPAÑÍA NO GARANTIZA NINGÚN RESULTADO ESPECÍFICO, INCLUYENDO:
                    </p>
                    <ul className="list-disc list-inside text-red-700 space-y-2">
                      <li>Un aumento específico en su puntaje de crédito</li>
                      <li>La eliminación de elementos negativos de su reporte</li>
                      <li>Un plazo específico para obtener resultados</li>
                      <li>La aprobación de crédito, préstamos u otros productos financieros</li>
                    </ul>
                    <p className="text-red-700 mt-4 text-sm">
                      Los resultados dependen de múltiples factores, incluyendo la exactitud de la 
                      información disputada y la respuesta de las agencias de crédito y acreedores.
                    </p>
                  </div>
                </section>

                {/* Section 5: Consumer Rights */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">5</span>
                    DERECHOS DEL CONSUMIDOR
                  </h3>
                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                    <p className="text-purple-800 mb-4">
                      Bajo la Ley de Organizaciones de Reparación de Crédito (CROA), usted tiene derecho a:
                    </p>
                    <ul className="list-disc list-inside text-purple-700 space-y-2">
                      <li><strong>Cancelar este contrato dentro de 3 días hábiles</strong> sin cargo alguno</li>
                      <li>Disputar información directamente con las agencias de crédito sin costo</li>
                      <li>Obtener un reporte de crédito gratuito anualmente de cada agencia</li>
                      <li>Demandar a organizaciones que violen la CROA</li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Cancellation */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-sm font-bold">6</span>
                    DERECHO A CANCELAR
                  </h3>
                  <div className="bg-amber-50 rounded-xl p-6 border-2 border-amber-300">
                    <p className="text-amber-900 font-bold text-lg mb-4">
                      AVISO DE CANCELACIÓN DE 3 DÍAS
                    </p>
                    <p className="text-amber-800 mb-4">
                      Usted puede CANCELAR este contrato sin ningún cargo ni penalidad dentro de los 
                      TRES (3) DÍAS HÁBILES siguientes a la fecha de firma.
                    </p>
                    <p className="text-amber-800 mb-4">
                      Para cancelar, envíe una notificación escrita a:
                    </p>
                    <div className="bg-white rounded-lg p-4 text-amber-900">
                      <p>TriExpert Credit Repair</p>
                      <p>2800 E 113th Ave, Tampa, FL 33617</p>
                      <p>Teléfono: (813) 369-3340</p>
                      <p>Email: cancellations@triexpertservice.com</p>
                      <p>O use el formulario de cancelación en: /cancellation-form</p>
                    </div>
                  </div>
                </section>

                {/* Section 7: State Disclosures */}
                <section className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm font-bold">7</span>
                    DIVULGACIONES ESTATALES ADICIONALES
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-gray-700 mb-4 text-sm">
                      <strong>California:</strong> Los residentes de California tienen derechos adicionales 
                      bajo la California Consumer Privacy Act (CCPA) y el California Credit Services Act.
                    </p>
                    <p className="text-gray-700 mb-4 text-sm">
                      <strong>Texas:</strong> Bajo el Texas Finance Code, usted tiene derecho a cancelar 
                      este contrato en cualquier momento con aviso por escrito.
                    </p>
                    <p className="text-gray-700 mb-4 text-sm">
                      <strong>New York:</strong> Los residentes de NY están protegidos bajo la NY General 
                      Business Law Article 29-H.
                    </p>
                    <p className="text-gray-700 text-sm">
                      <strong>Florida:</strong> Estamos registrados como organización de reparación de crédito 
                      según lo requiere la ley de Florida.
                    </p>
                  </div>
                </section>
              </div>

              <div className="flex justify-end mt-8 pt-6 border-t">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  He Leído el Contrato
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Acknowledgments */}
          {step === 2 && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Shield className="w-8 h-8 text-indigo-600" />
                Reconocimientos Requeridos
              </h2>
              <p className="text-gray-600 mb-8">
                Por favor confirme que ha leído y entendido cada uno de los siguientes puntos:
              </p>

              <div className="space-y-4">
                {[
                  { key: 'readContract', label: 'He leído el contrato completo de servicios de reparación de crédito' },
                  { key: 'understandRights', label: 'Entiendo mis derechos bajo la Ley CROA y la Ley FCRA' },
                  { key: 'understandCancellation', label: 'Entiendo que puedo cancelar dentro de 3 días hábiles sin cargo' },
                  { key: 'understandNoGuarantee', label: 'Entiendo que NO hay garantía de resultados específicos' },
                  { key: 'understandFees', label: 'Entiendo las tarifas y el calendario de pagos' },
                  { key: 'agreeTerms', label: 'Acepto los términos y condiciones de este contrato' }
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      acknowledgments[item.key]
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={acknowledgments[item.key]}
                      onChange={() => handleAcknowledgmentChange(item.key)}
                      className="w-6 h-6 rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5"
                    />
                    <span className={`font-medium ${acknowledgments[item.key] ? 'text-green-800' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between mt-8 pt-6 border-t">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium"
                >
                  ← Volver al Contrato
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!allAcknowledged}
                  className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar a Firma
                  <Pen className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Signature */}
          {step === 3 && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Pen className="w-8 h-8 text-indigo-600" />
                Firma Digital
              </h2>

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-6 mb-8">
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Nombre del Cliente</p>
                    <p className="text-lg font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Fecha de Firma</p>
                    <p className="text-lg font-semibold text-gray-900">{formattedDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="text-lg font-semibold text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Fecha Efectiva del Contrato</p>
                    <p className="text-lg font-semibold text-gray-900">{contractEffectiveDate}</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escriba su nombre completo como firma electrónica:
                </label>
                <input
                  ref={signatureRef}
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`${user?.firstName} ${user?.lastName}`}
                  className="w-full px-4 py-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-serif italic"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Al escribir su nombre arriba, usted acepta que esto constituye su firma electrónica legal.
                </p>
              </div>

              <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 mb-8">
                <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Recordatorio Legal
                </h3>
                <p className="text-amber-800 text-sm">
                  Al firmar este contrato, usted confirma que ha recibido y leído la Divulgación de 
                  Derechos del Consumidor requerida por la Ley CROA. Tiene 3 días hábiles para 
                  cancelar este contrato sin penalidad.
                </p>
              </div>

              <div className="flex justify-between pt-6 border-t">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleSign}
                  disabled={loading || !signature.trim()}
                  className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Firmando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Firmar Contrato
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
