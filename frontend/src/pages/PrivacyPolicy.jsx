/**
 * Privacy Policy Page
 * Legal privacy policy for TriExpert Credit Repair
 */

import { Shield, Lock, Eye, Database, Mail, Globe } from 'lucide-react';

export default function PrivacyPolicy() {
  const lastUpdated = "5 de Febrero, 2026";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Política de Privacidad</h1>
          <p className="text-slate-300">Última actualización: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Lock className="w-6 h-6 text-indigo-400" />
              Introducción
            </h2>
            <p className="text-slate-300 leading-relaxed">
              TriExpert Credit Repair ("nosotros", "nuestro" o "la empresa") se compromete a proteger su privacidad. 
              Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos su información 
              personal cuando utiliza nuestros servicios de reparación de crédito.
            </p>
          </section>

          {/* Information Collection */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Database className="w-6 h-6 text-indigo-400" />
              Información que Recopilamos
            </h2>
            <div className="space-y-4">
              <div className="bg-slate-700/30 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Información Personal</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Nombre completo y dirección</li>
                  <li>Número de Seguro Social (SSN)</li>
                  <li>Fecha de nacimiento</li>
                  <li>Correo electrónico y número de teléfono</li>
                  <li>Información de empleo e ingresos</li>
                </ul>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Información Financiera</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Reportes de crédito de las tres burós principales</li>
                  <li>Información de cuentas bancarias (a través de Plaid)</li>
                  <li>Historial de pagos y suscripciones</li>
                  <li>Detalles de disputas y elementos negativos</li>
                </ul>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Información Técnica</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Dirección IP y tipo de navegador</li>
                  <li>Dispositivo y sistema operativo</li>
                  <li>Cookies y tecnologías similares</li>
                  <li>Registro de actividad en la plataforma</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Use of Information */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Eye className="w-6 h-6 text-indigo-400" />
              Uso de su Información
            </h2>
            <p className="text-slate-300 mb-4">Utilizamos su información para:</p>
            <ul className="list-disc list-inside text-slate-300 space-y-2">
              <li>Proporcionar y mejorar nuestros servicios de reparación de crédito</li>
              <li>Verificar su identidad y prevenir fraude</li>
              <li>Comunicarnos con usted sobre su cuenta y servicios</li>
              <li>Preparar y enviar cartas de disputa a las burós de crédito</li>
              <li>Analizar su informe de crédito usando inteligencia artificial</li>
              <li>Procesar pagos y mantener registros de facturación</li>
              <li>Cumplir con obligaciones legales y regulatorias</li>
            </ul>
          </section>

          {/* Data Protection */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-indigo-400" />
              Protección de Datos
            </h2>
            <p className="text-slate-300 mb-4">
              Implementamos medidas de seguridad técnicas y organizativas para proteger su información:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <h4 className="font-semibold text-emerald-400 mb-2">🔐 Encriptación</h4>
                <p className="text-emerald-300 text-sm">Todos los datos se transmiten usando SSL/TLS y se almacenan encriptados</p>
              </div>
              <div className="bg-sky-500/10 rounded-xl p-4 border border-sky-500/20">
                <h4 className="font-semibold text-sky-400 mb-2">🛡️ Autenticación</h4>
                <p className="text-sky-300 text-sm">Autenticación segura con Auth0 y verificación de dos factores</p>
              </div>
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                <h4 className="font-semibold text-purple-400 mb-2">🏦 PCI Compliance</h4>
                <p className="text-purple-700 text-sm">Procesamiento de pagos compatible con PCI DSS a través de Stripe</p>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <h4 className="font-semibold text-amber-400 mb-2">📊 Auditorías</h4>
                <p className="text-amber-700 text-sm">Monitoreo continuo y auditorías regulares de seguridad</p>
              </div>
            </div>
          </section>

          {/* Third Party Services */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Globe className="w-6 h-6 text-indigo-400" />
              Servicios de Terceros
            </h2>
            <p className="text-slate-300 mb-4">
              Trabajamos con proveedores de servicios de confianza:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2">
              <li><strong>Plaid:</strong> Verificación bancaria y de ingresos</li>
              <li><strong>Stripe:</strong> Procesamiento seguro de pagos</li>
              <li><strong>Auth0:</strong> Autenticación y gestión de identidad</li>
              <li><strong>OpenAI:</strong> Análisis inteligente de reportes de crédito</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Sus Derechos</h2>
            <p className="text-slate-300 mb-4">Usted tiene derecho a:</p>
            <ul className="list-disc list-inside text-slate-300 space-y-2">
              <li>Acceder a su información personal</li>
              <li>Corregir información inexacta</li>
              <li>Solicitar la eliminación de sus datos</li>
              <li>Oponerse al procesamiento de sus datos</li>
              <li>Retirar su consentimiento en cualquier momento</li>
              <li>Recibir una copia de sus datos en formato portátil</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Mail className="w-6 h-6 text-indigo-400" />
              Contacto
            </h2>
            <p className="text-slate-300 mb-4">
              Para ejercer sus derechos o hacer preguntas sobre esta política, contáctenos:
            </p>
            <div className="bg-indigo-500/15 rounded-xl p-6 border border-indigo-500/30">
              <p className="text-indigo-400"><strong>Email:</strong> privacy@triexpertservice.com</p>
              <p className="text-indigo-400"><strong>Teléfono:</strong> (813) 369-3340</p>
              <p className="text-indigo-400"><strong>Dirección:</strong> 2800 E 113th Ave, Tampa, FL 33617</p>
            </div>
          </section>

          {/* Updates */}
          <section className="border-t border-slate-700/50 pt-8">
            <p className="text-slate-400 text-sm">
              Nos reservamos el derecho de actualizar esta Política de Privacidad periódicamente. 
              Los cambios serán publicados en esta página con una nueva fecha de "última actualización". 
              Le recomendamos revisar esta política regularmente.
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a 
            href="/dashboard" 
            className="text-indigo-400 hover:text-indigo-400 font-medium transition-colors"
          >
            ← Volver al Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
