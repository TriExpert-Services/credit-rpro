/**
 * Cancellation Form Page
 * REQUIRED BY CROA - 3-Day Right to Cancel
 * This form must be provided to all customers
 */

import { useState } from 'react';
import { useAuth } from '../context/Auth0Context';
import { FileText, Send, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function CancellationForm() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');

  const today = new Date();
  const formattedDate = today.toLocaleDateString('es-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/contracts/cancel', {
        reason,
        submittedAt: today.toISOString()
      });
      setSubmitted(true);
    } catch (err) {
      setError('Error al enviar la solicitud. Por favor intente nuevamente o contacte soporte.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Solicitud de Cancelación Recibida
            </h1>
            <p className="text-gray-600 mb-6">
              Su solicitud de cancelación ha sido recibida y será procesada dentro de las próximas 24 horas.
              Recibirá un email de confirmación en <strong>{user?.email}</strong>.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Si tiene alguna pregunta, contacte a nuestro equipo de soporte.
            </p>
            <Link 
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mb-6 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AVISO DE CANCELACIÓN
          </h1>
          <p className="text-gray-600">
            Formulario de Derecho a Cancelar (3 Días Hábiles) - CROA
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border-2 border-gray-200">
          {/* Legal Notice */}
          <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">AVISO IMPORTANTE</h3>
                <p className="text-amber-800 text-sm">
                  Usted puede cancelar este contrato sin ningún cargo o penalidad dentro de los 
                  <strong> TRES (3) DÍAS HÁBILES</strong> siguientes a la fecha en que firmó el 
                  contrato o recibió este formulario de cancelación, lo que ocurra después.
                </p>
              </div>
            </div>
          </div>

          {/* Printable Form Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 mb-8 print:border-solid">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center border-b pb-4">
              FORMULARIO DE CANCELACIÓN
            </h2>

            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Fecha:</strong> {formattedDate}
              </p>
              
              <p>
                <strong>Para:</strong> TriExpert Credit Repair
              </p>

              <p>
                <strong>De:</strong> {user?.firstName} {user?.lastName}
              </p>

              <p>
                <strong>Email:</strong> {user?.email}
              </p>

              <div className="my-6 py-4 border-t border-b border-gray-200">
                <p className="mb-4">
                  Por medio de la presente, notifico que deseo CANCELAR mi contrato de servicios 
                  de reparación de crédito con TriExpert Credit Repair.
                </p>
                <p>
                  Entiendo que tengo derecho a cancelar este contrato dentro de los tres (3) días 
                  hábiles siguientes a la firma del mismo, de conformidad con la Ley de 
                  Organizaciones de Reparación de Crédito (CROA).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Razón de cancelación (opcional):
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Por favor indique el motivo de su cancelación..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Firma del Consumidor:
                    </label>
                    <div className="h-20 border-b-2 border-gray-400 flex items-end justify-center pb-2">
                      <span className="text-gray-400 italic print:hidden">
                        (Firma digital al enviar)
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha:
                    </label>
                    <div className="h-20 border-b-2 border-gray-400 flex items-end justify-center pb-2">
                      <span className="text-gray-700">{formattedDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submission Options */}
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-900">
              Opciones para Enviar su Cancelación:
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-900 mb-2">📧 Por Email</h4>
                <p className="text-sm text-gray-600">
                  cancellations@triexpertservice.com
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-900 mb-2">📬 Por Correo</h4>
                <p className="text-sm text-gray-600">
                  TriExpert Credit Repair<br />
                  2800 E 113th Ave<br />
                  Tampa, FL 33617
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-800 rounded-xl p-4 border border-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar Solicitud de Cancelación
                  </>
                )}
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Imprimir Formulario
              </button>
            </div>
          </div>

          {/* Legal Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Este formulario se proporciona de conformidad con la Ley de Organizaciones de 
              Reparación de Crédito (CROA), 15 U.S.C. § 1679e. Guarde una copia de este 
              formulario para sus registros.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link 
            to="/consumer-rights" 
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            ← Ver Derechos del Consumidor
          </Link>
        </div>
      </div>
    </div>
  );
}
