import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, Shield, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const features = [
    { icon: Shield, text: 'Análisis de crédito con IA' },
    { icon: TrendingUp, text: 'Mejora tu puntaje' },
    { icon: CheckCircle, text: 'Cartas de disputa automáticas' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d4a6f] to-[#1e3a5f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-indigo-400/10 rounded-full blur-2xl"></div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Features */}
        <div className="hidden lg:block text-white space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Powered by AI</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Repara tu crédito con
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> inteligencia artificial</span>
            </h1>
            <p className="text-blue-200 text-lg">
              La plataforma más avanzada para análisis y reparación de crédito en español.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <feature.icon size={24} />
                </div>
                <span className="text-lg font-medium">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[1,2,3,4].map(i => (
                <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#1e3a5f] bg-gradient-to-br ${
                  i === 1 ? 'from-blue-400 to-blue-600' :
                  i === 2 ? 'from-purple-400 to-purple-600' :
                  i === 3 ? 'from-indigo-400 to-indigo-600' :
                  'from-cyan-400 to-cyan-600'
                }`}></div>
              ))}
            </div>
            <div>
              <p className="font-semibold">+1,000 clientes satisfechos</p>
              <p className="text-blue-200 text-sm">Mejora promedio de 85 puntos</p>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <img 
                src="/assets/logo.png" 
                alt="TriExpert Credit Repair" 
                className="h-40 w-auto mx-auto mb-4"
              />
              <h2 className="text-2xl font-bold text-gray-900">
                Bienvenido de vuelta
              </h2>
              <p className="text-gray-500 mt-1">Ingresa a tu cuenta para continuar</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-gray-600">Recordarme</span>
                </label>
                <a href="#" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Ingresando...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">¿Nuevo en TriExpert?</span>
                </div>
              </div>

              <Link 
                to="/register" 
                className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-indigo-300 hover:bg-indigo-50 transition-all"
              >
                Crear cuenta gratis
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white/70 text-sm">
              Demo: admin@creditrepair.com / Admin123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
