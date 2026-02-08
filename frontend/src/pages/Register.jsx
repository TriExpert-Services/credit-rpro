import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import { Mail, Lock, User, Phone, UserPlus, Shield, CheckCircle, ArrowRight, Sparkles, Fingerprint, Eye, EyeOff } from 'lucide-react';

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
  const [auth0Loading, setAuth0Loading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const { register, registerWithAuth0 } = useAuth();
  const navigate = useNavigate();

  // Check if Auth0 is configured
  const isAuth0Configured = import.meta.env.VITE_AUTH0_DOMAIN && 
    import.meta.env.VITE_AUTH0_DOMAIN !== 'tu-tenant.us.auth0.com';

  const handleAuth0Register = async () => {
    setAuth0Loading(true);
    setError('');
    try {
      await registerWithAuth0();
    } catch (err) {
      setError('Error al registrarse con Auth0');
      setAuth0Loading(false);
    }
  };

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
              <div key={index} className="flex items-center gap-3 bg-slate-800/50/10 backdrop-blur-sm rounded-xl p-4">
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
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <img 
                src="/assets/logo.png" 
                alt="TriExpert Credit Repair" 
                className="h-36 w-auto mx-auto mb-3"
              />
              <h2 className="text-2xl font-bold text-white">
                Crear Cuenta
              </h2>
              <p className="text-slate-400 mt-1">Comienza tu viaje hacia un mejor crédito</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>1</div>
              <div className={`w-12 h-1 rounded ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</div>
            </div>

            <div role="alert" aria-live="polite">
              {error && (
                <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-firstName" className="block text-sm font-semibold text-slate-300 mb-2">Nombre</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                        <input
                          id="reg-firstName"
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-700/30 hover:bg-slate-800/50 transition-all"
                          placeholder="Juan"
                          autoComplete="given-name"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-lastName" className="block text-sm font-semibold text-slate-300 mb-2">Apellido</label>
                      <input
                        id="reg-lastName"
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-700/30 hover:bg-slate-800/50 transition-all"
                        placeholder="Pérez"
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-sm font-semibold text-slate-300 mb-2">Teléfono</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                      <input
                        id="reg-phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-700/30 hover:bg-slate-800/50 transition-all"
                        placeholder="(555) 123-4567"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.firstName || !formData.lastName}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
                  >
                    <span>Continuar</span>
                    <ArrowRight size={20} />
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                      <input
                        id="reg-email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-700/30 hover:bg-slate-800/50 transition-all"
                        placeholder="tu@email.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-300 mb-2">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-700/30 hover:bg-slate-800/50 transition-all"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Shield size={12} aria-hidden="true" />
                      Mínimo 6 caracteres con letras y números
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-xl">
                    <input id="reg-terms" type="checkbox" className="w-4 h-4 mt-0.5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500" required />
                    <label htmlFor="reg-terms" className="text-xs text-slate-300">
                      Acepto los <a href="#" className="text-indigo-400 hover:underline">Términos de Servicio</a> y la <a href="#" className="text-indigo-400 hover:underline">Política de Privacidad</a>
                    </label>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-4 border-2 border-slate-700/50 rounded-xl font-semibold text-slate-300 hover:bg-slate-700/30 transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
              {/* Auth0 MFA Registration */}
              {isAuth0Configured && (
                <>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/50"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-slate-800/50 text-slate-400">o regístrate con</span>
                    </div>
                  </div>

                  <button
                    onClick={handleAuth0Register}
                    disabled={auth0Loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 mb-4"
                  >
                    {auth0Loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint size={22} />
                        <span>Registrarse con MFA Seguro</span>
                        <span className="px-2 py-0.5 bg-slate-800/50/20 rounded-full text-xs">Auth0</span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-center text-xs text-slate-400 mb-4">
                    🔐 Autenticación multifactor para mayor seguridad
                  </p>
                </>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-800/50 text-slate-400">¿Ya tienes cuenta?</span>
                </div>
              </div>

              <Link 
                to="/login" 
                className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 border-2 border-slate-700/50 rounded-xl text-slate-300 font-semibold hover:border-indigo-300 hover:bg-indigo-500/20 transition-all"
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
