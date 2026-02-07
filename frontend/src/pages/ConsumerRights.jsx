/**
 * Consumer Rights Disclosure Page
 * REQUIRED BY CROA - Credit Repair Organizations Act
 * 15 U.S.C. § 1679c - Must be provided BEFORE any contract is signed
 */

import { Shield, FileText, AlertTriangle, Phone, Scale, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ConsumerRights() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Official Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl mb-6 shadow-lg">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            DIVULGACIÓN DE DERECHOS DEL CONSUMIDOR
          </h1>
          <p className="text-lg text-red-600 font-semibold">
            REQUERIDO POR LEY FEDERAL - LEA ANTES DE FIRMAR CUALQUIER CONTRATO
          </p>
        </div>

        {/* Main Content - Must match CROA requirements exactly */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8 border-2 border-red-100">
          
          {/* Section 1: Your Rights */}
          <section className="border-b border-gray-200 pb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-7 h-7 text-blue-600" />
              SUS DERECHOS BAJO LA LEY FEDERAL
            </h2>
            
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200 mb-6">
              <p className="text-blue-900 font-medium mb-4">
                Usted ha sido contactado por TriExpert Credit Repair, una organización de reparación de crédito.
                Bajo la Ley de Organizaciones de Reparación de Crédito (Credit Repair Organizations Act), 
                usted tiene los siguientes derechos:
              </p>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Derecho a Cancelar</p>
                  <p className="text-gray-600">
                    Usted tiene derecho a cancelar su contrato con cualquier organización de reparación 
                    de crédito por CUALQUIER razón dentro de los <strong>3 días hábiles</strong> siguientes 
                    a la fecha en que firmó el contrato.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Disputas Gratuitas Directas</p>
                  <p className="text-gray-600">
                    Usted tiene derecho a disputar información inexacta o incompleta en su reporte 
                    de crédito <strong>directamente con las agencias de informes de crédito sin cargo alguno</strong>.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Derecho a Demandar</p>
                  <p className="text-gray-600">
                    Usted tiene derecho a demandar a una organización de reparación de crédito que 
                    viole la Ley de Organizaciones de Reparación de Crédito. Esta ley le permite 
                    recuperar daños y perjuicios.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Reporte de Crédito Gratuito</p>
                  <p className="text-gray-600">
                    Usted tiene derecho a obtener una copia de su archivo de crédito de una agencia 
                    de informes de crédito. Puede obtener un reporte gratuito anual de cada una de 
                    las tres principales agencias en <a href="https://www.annualcreditreport.com" 
                    target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    www.annualcreditreport.com</a>.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Section 2: Prohibitions */}
          <section className="border-b border-gray-200 pb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <XCircle className="w-7 h-7 text-red-600" />
              LO QUE LAS ORGANIZACIONES DE REPARACIÓN DE CRÉDITO NO PUEDEN HACER
            </h2>

            <div className="bg-red-50 rounded-xl p-6 border border-red-200">
              <p className="text-red-800 font-medium mb-4">
                Ninguna organización de reparación de crédito puede legalmente:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">
                    Hacer declaraciones falsas sobre sus servicios
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">
                    Cobrarle antes de que los servicios sean completamente prestados
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">
                    Realizar servicios hasta que hayan pasado 3 días hábiles después de que usted firmó el contrato
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">
                    Aconsejarle que altere su identidad para crear un nuevo archivo de crédito
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">
                    Aconsejarle que haga una declaración inexacta a una agencia de informes de crédito o acreedor
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Credit Bureaus Contact */}
          <section className="border-b border-gray-200 pb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Phone className="w-7 h-7 text-indigo-600" />
              INFORMACIÓN DE CONTACTO DE LAS AGENCIAS DE CRÉDITO
            </h2>

            <p className="text-gray-600 mb-6">
              Usted puede contactar directamente a las siguientes agencias de crédito para disputar 
              información inexacta o para obtener su reporte de crédito:
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-3">EQUIFAX</h4>
                <p className="text-sm text-gray-600 mb-1">P.O. Box 740241</p>
                <p className="text-sm text-gray-600 mb-1">Atlanta, GA 30374</p>
                <p className="text-sm text-gray-600 mb-1">1-800-685-1111</p>
                <p className="text-sm text-blue-600">www.equifax.com</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-3">EXPERIAN</h4>
                <p className="text-sm text-gray-600 mb-1">P.O. Box 4500</p>
                <p className="text-sm text-gray-600 mb-1">Allen, TX 75013</p>
                <p className="text-sm text-gray-600 mb-1">1-888-397-3742</p>
                <p className="text-sm text-blue-600">www.experian.com</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-3">TRANSUNION</h4>
                <p className="text-sm text-gray-600 mb-1">P.O. Box 1000</p>
                <p className="text-sm text-gray-600 mb-1">Chester, PA 19016</p>
                <p className="text-sm text-gray-600 mb-1">1-800-916-8800</p>
                <p className="text-sm text-blue-600">www.transunion.com</p>
              </div>
            </div>
          </section>

          {/* Section 4: FTC Contact */}
          <section className="border-b border-gray-200 pb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
              COMISIÓN FEDERAL DE COMERCIO (FTC)
            </h2>

            <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
              <p className="text-amber-900 mb-4">
                Si tiene algún problema con una organización de reparación de crédito, puede reportar 
                sus quejas a la Comisión Federal de Comercio (FTC):
              </p>
              <div className="space-y-2 text-amber-800">
                <p><strong>Federal Trade Commission</strong></p>
                <p>Consumer Response Center - CROA</p>
                <p>600 Pennsylvania Avenue, N.W.</p>
                <p>Washington, D.C. 20580</p>
                <p className="mt-2">
                  <strong>Teléfono:</strong> 1-877-382-4357
                </p>
                <p>
                  <strong>Sitio web:</strong>{' '}
                  <a href="https://www.ftc.gov" target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 underline">www.ftc.gov</a>
                </p>
                <p>
                  <strong>Reportar quejas:</strong>{' '}
                  <a href="https://reportfraud.ftc.gov" target="_blank" rel="noopener noreferrer"
                     className="text-blue-600 underline">reportfraud.ftc.gov</a>
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Right to Cancel */}
          <section className="border-b border-gray-200 pb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Clock className="w-7 h-7 text-green-600" />
              SU DERECHO A CANCELAR (3 DÍAS HÁBILES)
            </h2>

            <div className="bg-green-50 rounded-xl p-6 border border-green-200">
              <p className="text-green-900 mb-4 font-medium">
                Usted puede cancelar su contrato con TriExpert Credit Repair, sin cargo alguno, 
                dentro de los 3 días hábiles siguientes a la fecha en que firmó el contrato.
              </p>
              <p className="text-green-800 mb-4">
                Para cancelar, puede:
              </p>
              <ul className="list-disc list-inside text-green-800 space-y-2 mb-4">
                <li>Enviar una notificación por escrito a: <strong>2800 E 113th Ave, Tampa, FL 33617</strong></li>
                <li>Llamar al: <strong>(813) 369-3340</strong></li>
                <li>Usar el formulario de cancelación proporcionado</li>
                <li>Enviar un email a: <strong>cancellations@triexpertservice.com</strong></li>
              </ul>
              <div className="mt-4 pt-4 border-t border-green-200">
                <Link 
                  to="/cancellation-form"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  Ver Formulario de Cancelación
                </Link>
              </div>
            </div>
          </section>

          {/* Section 6: Legal Reference */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Scale className="w-7 h-7 text-gray-600" />
              REFERENCIA LEGAL
            </h2>

            <div className="bg-gray-100 rounded-xl p-6 border border-gray-300">
              <p className="text-gray-700 text-sm mb-4">
                Esta divulgación se proporciona de conformidad con los requisitos de la 
                <strong> Ley de Organizaciones de Reparación de Crédito</strong> 
                (Credit Repair Organizations Act, CROA), 15 U.S.C. § 1679 et seq.
              </p>
              <p className="text-gray-700 text-sm mb-4">
                La violación de esta ley federal puede resultar en sanciones civiles y penales.
              </p>
              <p className="text-gray-700 text-sm">
                Usted tiene el derecho de consultar con un abogado antes de firmar cualquier 
                contrato con una organización de reparación de crédito.
              </p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mt-8 pt-8 border-t-2 border-gray-300">
            <div className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-300">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">
                RECONOCIMIENTO DEL CONSUMIDOR
              </h3>
              <p className="text-yellow-800 mb-4">
                Al continuar con los servicios de TriExpert Credit Repair, usted reconoce que:
              </p>
              <ul className="list-disc list-inside text-yellow-800 space-y-2">
                <li>Ha recibido una copia de esta Divulgación de Derechos del Consumidor</li>
                <li>Ha tenido la oportunidad de leer y entender sus derechos</li>
                <li>Entiende que puede cancelar dentro de 3 días hábiles sin penalidad</li>
                <li>Entiende que puede disputar información directamente con las burós de crédito sin costo</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Print Button */}
        <div className="text-center mt-8 space-y-4">
          <button 
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-900 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Imprimir Esta Página
          </button>
          <p className="text-gray-500 text-sm">
            Se recomienda guardar o imprimir una copia de este documento para sus registros.
          </p>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link 
            to="/dashboard" 
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            ← Volver al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
