/**
 * Terms of Service Page
 * Legal terms for TriExpert Credit Repair
 */

import { FileText, AlertTriangle, CreditCard, Scale, Clock, XCircle, CheckCircle } from 'lucide-react';

export default function TermsOfService() {
  const lastUpdated = "5 de Febrero, 2026";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Términos de Servicio</h1>
          <p className="text-gray-600">Última actualización: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
          {/* Agreement */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-indigo-600" />
              Acuerdo de Términos
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Al acceder y utilizar los servicios de TriExpert Credit Repair, usted acepta cumplir 
              con estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos, 
              no debe usar nuestros servicios.
            </p>
          </section>

          {/* Services Description */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-indigo-600" />
              Descripción de Servicios
            </h2>
            <p className="text-gray-600 mb-4">TriExpert Credit Repair proporciona:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Análisis de Crédito</h4>
                <p className="text-gray-600 text-sm">Revisión detallada de sus reportes de crédito de las tres burós principales usando IA avanzada.</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Generación de Disputas</h4>
                <p className="text-gray-600 text-sm">Creación automática de cartas de disputa personalizadas para elementos negativos.</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Seguimiento de Progreso</h4>
                <p className="text-gray-600 text-sm">Monitoreo continuo de sus disputas y mejoras en su puntaje crediticio.</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Verificación de Identidad</h4>
                <p className="text-gray-600 text-sm">Integración con Plaid para verificación bancaria segura.</p>
              </div>
            </div>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Responsabilidades del Usuario
            </h2>
            <p className="text-gray-600 mb-4">Al usar nuestros servicios, usted se compromete a:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Proporcionar información veraz, precisa y completa</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Mantener la confidencialidad de sus credenciales de acceso</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Notificarnos inmediatamente de cualquier uso no autorizado</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">No utilizar el servicio para actividades ilegales o fraudulentas</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Ser mayor de 18 años o tener consentimiento parental</span>
              </li>
            </ul>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-indigo-600" />
              Términos de Pago
            </h2>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-2">Suscripciones</h4>
                <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
                  <li>Las suscripciones se facturan mensualmente de forma automática</li>
                  <li>Los precios pueden cambiar con 30 días de aviso previo</li>
                  <li>Los cargos no son reembolsables excepto donde la ley lo requiera</li>
                </ul>
              </div>
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                <h4 className="font-semibold text-amber-900 mb-2">Cancelación</h4>
                <ul className="list-disc list-inside text-amber-800 space-y-1 text-sm">
                  <li>Puede cancelar su suscripción en cualquier momento</li>
                  <li>Mantendrá acceso hasta el final del período facturado</li>
                  <li>Los datos se conservarán por 30 días después de la cancelación</li>
                </ul>
              </div>
            </div>
          </section>

          {/* No Guarantees */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Sin Garantías de Resultados
            </h2>
            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
              <p className="text-red-800 mb-4">
                <strong>IMPORTANTE:</strong> TriExpert Credit Repair NO garantiza:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">Un aumento específico en su puntaje de crédito</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">La eliminación de elementos negativos legítimos</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">Un plazo específico para ver resultados</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">Aprobación de préstamos o líneas de crédito</span>
                </li>
              </ul>
              <p className="text-red-700 text-sm mt-4">
                Los resultados varían según las circunstancias individuales de cada cliente y la exactitud 
                de la información en sus reportes de crédito.
              </p>
            </div>
          </section>

          {/* CROA Compliance */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-indigo-600" />
              Cumplimiento con CROA
            </h2>
            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
              <p className="text-indigo-900 mb-4">
                De acuerdo con la Credit Repair Organizations Act (CROA), usted tiene derecho a:
              </p>
              <ul className="list-disc list-inside text-indigo-800 space-y-1">
                <li>Cancelar cualquier contrato dentro de los 3 días hábiles siguientes a la firma</li>
                <li>Disputar información inexacta directamente con las burós de crédito sin costo</li>
                <li>Recibir una copia de sus derechos por escrito antes de firmar cualquier contrato</li>
                <li>Demandar a una organización de reparación de crédito que viole la CROA</li>
              </ul>
            </div>
          </section>

          {/* Service Period */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-600" />
              Período del Servicio
            </h2>
            <p className="text-gray-600">
              El proceso de reparación de crédito típicamente toma de 3 a 6 meses para ver resultados 
              significativos, aunque esto puede variar. Nos reservamos el derecho de modificar o 
              discontinuar el servicio con aviso previo de 30 días.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Limitación de Responsabilidad</h2>
            <p className="text-gray-600">
              TriExpert Credit Repair no será responsable por daños indirectos, incidentales, especiales, 
              consecuentes o punitivos resultantes del uso de nuestros servicios. Nuestra responsabilidad 
              máxima está limitada al monto pagado por usted en los últimos 12 meses.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Resolución de Disputas</h2>
            <p className="text-gray-600">
              Cualquier disputa relacionada con estos términos se resolverá primero mediante negociación 
              de buena fe. Si no se llega a una resolución, las partes acuerdan someterse a arbitraje 
              vinculante de acuerdo con las reglas de la American Arbitration Association.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ley Aplicable</h2>
            <p className="text-gray-600">
              Estos términos se regirán e interpretarán de acuerdo con las leyes del Estado de [Estado], 
              sin dar efecto a ningún principio de conflictos de leyes.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contacto</h2>
            <p className="text-gray-600 mb-4">
              Para preguntas sobre estos términos, contáctenos:
            </p>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-700"><strong>Email:</strong> legal@triexpertservice.com</p>
              <p className="text-gray-700"><strong>Teléfono:</strong> (813) 369-3340</p>
              <p className="text-gray-700"><strong>Dirección:</strong> 2800 E 113th Ave, Tampa, FL 33617</p>
            </div>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a 
            href="/dashboard" 
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            ← Volver al Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
