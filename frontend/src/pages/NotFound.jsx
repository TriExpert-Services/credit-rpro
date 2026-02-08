/**
 * 404 Not Found Page
 * Displayed when a route doesn't exist
 */

import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* 404 Illustration */}
        <div className="relative mb-8">
          <div className="text-[150px] font-bold text-indigo-100 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/25">
              <Search className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Página no encontrada
        </h1>
        <p className="text-slate-300 mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida. 
          Por favor verifica la URL o regresa al inicio.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
          >
            <Home className="w-5 h-5" />
            Ir al Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 text-slate-300 rounded-xl font-semibold border border-slate-700/50 hover:bg-slate-700/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver Atrás
          </button>
        </div>

        {/* Help Link */}
        <div className="mt-8 pt-8 border-t border-slate-700/50">
          <p className="text-slate-400 text-sm mb-3">¿Necesitas ayuda?</p>
          <Link 
            to="/support"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-400 font-medium transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Visitar Centro de Ayuda
          </Link>
        </div>
      </div>
    </div>
  );
}
