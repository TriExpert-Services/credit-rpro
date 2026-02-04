import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Phone, UserPlus, Shield, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await register(formData);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const benefits = [
    'Análisis de crédito con IA avanzada',
    'Cartas de disputa personalizadas',
    'Seguimiento en tiempo real',
    'Soporte en español 24/7'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d4a6f] to-[#1e3a5f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-400/10 rounded-full blur-2xl"></div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Benefits */}
        <div className="hidden lg:block text-white space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Comienza Gratis</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Tu camino hacia un
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> mejor crédito</span>
              <br />comienza aquí
            </h1>
            <p className="text-blue-200 text-lg">
              Únete a miles de personas que ya mejoraron su puntaje con nuestra plataforma.
            </p>
          </div>

          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle size={20} className="text-emerald-400" />
                </div>
                <span className="font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl">
                <Shield size={28} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Garantía de Satisfacción</h3>
                <p className="text-blue-200 text-sm">Si no ves mejoras en 90 días, te devolvemos tu dinero</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Register Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <img 
                src="/assets/logo.png" 
                alt="TriExpert Credit Repair" 
                className="h-36 w-auto mx-auto mb-3"
              />
              <h2 className="text-2xl font-bold text-gray-900">
                Crear Cuenta
              </h2>
              <p className="text-gray-500 mt-1">Comienza tu viaje hacia un mejor crédito</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
              <div className={`w-12 h-1 rounded ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
                          placeholder="Juan"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Apellido</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
                        placeholder="Pérez"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.firstName || !formData.lastName}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
                  >
                    <span>Continuar</span>
                    <ArrowRight size={20} />
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Shield size={12} />
                      Mínimo 6 caracteres con letras y números
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" required />
                    <span className="text-xs text-gray-600">
                      Acepto los <a href="#" className="text-indigo-600 hover:underline">Términos de Servicio</a> y la <a href="#" className="text-indigo-600 hover:underline">Política de Privacidad</a>
                    </span>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-4 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creando...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={20} />
                          <span>Crear Cuenta</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">¿Ya tienes cuenta?</span>
                </div>
              </div>

              <Link 
                to="/login" 
                className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-indigo-300 hover:bg-indigo-50 transition-all"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
