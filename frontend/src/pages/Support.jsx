/**
 * Support/Help Page
 * FAQ and support contact for TriExpert Credit Repair
 */

import { useState } from 'react';
import { 
  HelpCircle, MessageCircle, Mail, Phone, Clock, ChevronDown, 
  ChevronUp, FileText, CreditCard, Shield, AlertCircle, Zap,
  ExternalLink
} from 'lucide-react';

export default function Support() {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      category: 'General',
      icon: HelpCircle,
      questions: [
        {
          q: '¿Qué es la reparación de crédito?',
          a: 'La reparación de crédito es el proceso de identificar y disputar información inexacta, obsoleta o incompleta en sus reportes de crédito. Esto puede ayudar a mejorar su puntaje crediticio.'
        },
        {
          q: '¿Cuánto tiempo toma ver resultados?',
          a: 'Generalmente, los clientes comienzan a ver resultados dentro de 30-45 días después de que se envían las primeras disputas. Sin embargo, el proceso completo puede tomar de 3 a 6 meses dependiendo de la cantidad de elementos a disputar.'
        },
        {
          q: '¿Es legal la reparación de crédito?',
          a: 'Sí, la reparación de crédito es 100% legal. La Ley de Informes de Crédito Justos (FCRA) le da el derecho de disputar cualquier información inexacta en su reporte de crédito.'
        }
      ]
    },
    {
      category: 'Cuenta y Pagos',
      icon: CreditCard,
      questions: [
        {
          q: '¿Cómo cancelo mi suscripción?',
          a: 'Puede cancelar su suscripción en cualquier momento desde la sección de Perfil > Suscripción. Mantendrá acceso hasta el final del período facturado.'
        },
        {
          q: '¿Ofrecen reembolsos?',
          a: 'Ofrecemos una garantía de satisfacción de 30 días para nuevos clientes. Si no está satisfecho, puede solicitar un reembolso completo dentro de los primeros 30 días.'
        },
        {
          q: '¿Qué métodos de pago aceptan?',
          a: 'Aceptamos todas las tarjetas de crédito y débito principales (Visa, MasterCard, American Express, Discover) a través de Stripe, nuestro procesador de pagos seguro.'
        }
      ]
    },
    {
      category: 'Disputas',
      icon: FileText,
      questions: [
        {
          q: '¿Cómo funcionan las cartas de disputa generadas por IA?',
          a: 'Nuestra IA analiza sus reportes de crédito y genera cartas de disputa personalizadas basadas en las leyes aplicables y las mejores prácticas. Cada carta está diseñada para maximizar las probabilidades de éxito.'
        },
        {
          q: '¿Puedo disputar cualquier elemento negativo?',
          a: 'Puede disputar cualquier información que crea que es inexacta, incompleta o que no puede ser verificada. No podemos eliminar información que sea precisa y verificable.'
        },
        {
          q: '¿Qué pasa si la disputa es rechazada?',
          a: 'Si una disputa es rechazada, podemos preparar una carta de seguimiento con argumentos adicionales o evidencia. También puede agregar una declaración personal a su reporte de crédito.'
        }
      ]
    },
    {
      category: 'Seguridad',
      icon: Shield,
      questions: [
        {
          q: '¿Es seguro proporcionar mi información?',
          a: 'Sí, utilizamos encriptación de nivel bancario (SSL/TLS) y cumplimos con los estándares PCI DSS para proteger su información. Sus datos nunca son compartidos con terceros no autorizados.'
        },
        {
          q: '¿Por qué necesitan mi número de Seguro Social?',
          a: 'El SSN es necesario para verificar su identidad y obtener sus reportes de crédito de las tres burós principales. Esta información se almacena de forma segura y encriptada.'
        },
        {
          q: '¿Qué es la verificación bancaria con Plaid?',
          a: 'Plaid es un servicio seguro que nos permite verificar su identidad conectando con su banco. Esto añade una capa adicional de verificación y puede ser usado para análisis de ingresos.'
        }
      ]
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Centro de Ayuda</h1>
          <p className="text-slate-300 text-lg">¿Cómo podemos ayudarte hoy?</p>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-500/20 text-sky-400 rounded-xl mb-4">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2">Chat en Vivo</h3>
            <p className="text-slate-300 text-sm mb-4">Respuestas instantáneas de nuestro equipo</p>
            <button 
              onClick={() => window.Tawk_API && window.Tawk_API.toggle()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Iniciar Chat
            </button>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2">Email</h3>
            <p className="text-slate-300 text-sm mb-4">support@triexpertservice.com</p>
            <a href="mailto:support@triexpertservice.com" className="block w-full py-2 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors">
              Enviar Email
            </a>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl mb-4">
              <Phone className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2">Teléfono</h3>
            <p className="text-slate-300 text-sm mb-4">(813) 369-3340</p>
            <a href="tel:+18133693340" className="block w-full py-2 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
              Llamar Ahora
            </a>
          </div>
        </div>

        {/* Hours */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-12 text-white">
          <div className="flex items-center gap-4">
            <Clock className="w-8 h-8" />
            <div>
              <h3 className="font-semibold text-lg">Horario de Atención</h3>
              <p className="text-indigo-100">Lunes a Viernes: 9:00 AM - 6:00 PM EST | Sábados: 10:00 AM - 2:00 PM EST</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Preguntas Frecuentes</h2>
          
          {faqs.map((category, catIndex) => (
            <div key={catIndex} className="mb-8 last:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <category.icon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">{category.category}</h3>
              </div>
              
              <div className="space-y-3">
                {category.questions.map((faq, faqIndex) => {
                  const index = `${catIndex}-${faqIndex}`;
                  const isOpen = openFaq === index;
                  
                  return (
                    <div 
                      key={faqIndex}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        isOpen ? 'border-indigo-500/30 bg-indigo-500/15' : 'border-slate-700/50 hover:border-slate-600/50'
                      }`}
                    >
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <span className={`font-medium ${isOpen ? 'text-indigo-400' : 'text-white'}`}>
                          {faq.q}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        )}
                      </button>
                      
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <p className="text-slate-300 leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <a href="/privacy-policy" className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow flex items-center gap-4">
            <Shield className="w-10 h-10 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white">Política de Privacidad</h3>
              <p className="text-slate-300 text-sm">Cómo protegemos su información</p>
            </div>
            <ExternalLink className="w-5 h-5 text-slate-500 ml-auto" />
          </a>
          
          <a href="/terms" className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow flex items-center gap-4">
            <FileText className="w-10 h-10 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white">Términos de Servicio</h3>
              <p className="text-slate-300 text-sm">Nuestros términos y condiciones</p>
            </div>
            <ExternalLink className="w-5 h-5 text-slate-500 ml-auto" />
          </a>
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
