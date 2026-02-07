import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import { Mail, Lock, LogIn, Shield, TrendingUp, CheckCircle, Sparkles, Fingerprint, ArrowRight, Star, Zap, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [auth0Loading, setAuth0Loading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithAuth0 } = useAuth();
  const navigate = useNavigate();

  // Check if Auth0 is configured
  const isAuth0Configured = import.meta.env.VITE_AUTH0_DOMAIN && 
    import.meta.env.VITE_AUTH0_DOMAIN !== 'tu-tenant.us.auth0.com';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password, requires2FA ? totpCode : null);
    
    if (result.success) {
      navigate('/dashboard');
    } else if (result.requires2FA) {
      setRequires2FA(true);
      setTotpCode('');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleAuth0Login = async () => {
    setAuth0Loading(true);
    setError('');
    try {
      await loginWithAuth0();
      // Auth0 redirects, so we don't need to navigate here
    } catch (err) {
      setError('Error al iniciar sesión con Auth0');
      setAuth0Loading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTotpCode('');
    setError('');
  };

  const features = [
    { icon: Shield, text: 'Análisis de crédito con IA', color: 'from-blue-500 to-cyan-400' },
    { icon: TrendingUp, text: 'Mejora tu puntaje crediticio', color: 'from-emerald-500 to-green-400' },
    { icon: CheckCircle, text: 'Cartas de disputa automáticas', color: 'from-violet-500 to-purple-400' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"></div>
      
      {/* Animated orbs */}
      <div className="absolute top-0 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float" style={{animationDelay: '-2s'}}></div>
      <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{animationDelay: '-4s'}}></div>
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-float" style={{animationDelay: '-6s'}}></div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDBoMzB2MzBIMHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-40"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left side - Features */}
          <div className="hidden lg:block text-white space-y-10 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30 mb-6 backdrop-blur-sm">
                <Sparkles className="text-amber-400 w-4 h-4" />
                <span className="text-amber-300 font-semibold text-sm">Powered by AI</span>
                <Zap className="text-amber-400 w-4 h-4" />
              </div>
              <h1 className="text-5xl font-extrabold mb-6 leading-tight">
                Repara tu crédito con
                <span className="block mt-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient" style={{backgroundSize: '200% 200%'}}> inteligencia artificial</span>
              </h1>
              <p className="text-slate-300 text-xl leading-relaxed">
                La plataforma más avanzada para análisis y reparación de crédito en español.
              </p>
            </div>

            <div className="space-y-4">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="group flex items-center gap-5 p-5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:-translate-x-2 cursor-default"
                  style={{animationDelay: `${index * 150}ms`}}
                >
                  <div className={`p-4 bg-gradient-to-br ${feature.color} rounded-2xl shadow-lg shadow-${feature.color.split('-')[1]}-500/30 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon size={26} className="text-white" />
                  </div>
                  <span className="text-lg font-semibold text-slate-100">{feature.text}</span>
                  <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-slate-400" size={20} />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1,2,3,4,5].map(i => (
                  <div 
                    key={i} 
                    className={`w-12 h-12 rounded-xl border-2 border-slate-900 shadow-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm ${
                      i === 1 ? 'from-blue-500 to-blue-600' :
                      i === 2 ? 'from-purple-500 to-purple-600' :
                      i === 3 ? 'from-pink-500 to-pink-600' :
                      i === 4 ? 'from-emerald-500 to-emerald-600' :
                      'from-amber-500 to-amber-600'
                    }`}
                  ></div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="font-bold text-lg text-white">+1,000 clientes satisfechos</p>
                <p className="text-slate-400 text-sm">Mejora promedio de 85 puntos</p>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 animate-fade-in" style={{animationDelay: '200ms'}}>
            <div className="relative">
              {/* Glowing border effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] blur opacity-30 animate-pulse-glow"></div>
              
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-10 border border-white/50">
                <div className="text-center mb-10">
                  <div className="relative inline-block mb-6">
                    <div className="absolute -inset-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20"></div>
                    <img 
                      src="/assets/logo.png" 
                      alt="TriExpert Credit Repair" 
                      className="relative h-32 w-auto"
                    />
                  </div>
                  <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent">
                    Bienvenido de vuelta
                  </h2>
                  <p className="text-slate-500 mt-2 font-medium">Ingresa a tu cuenta para continuar</p>
                </div>

                <div role="alert" aria-live="polite">
                  {error && (
                    <div className="mb-8 p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-2xl text-rose-600 text-sm flex items-center gap-3 animate-scale-in">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse"></div>
                      </div>
                      <span className="font-medium">{error}</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {!requires2FA ? (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="login-email" className="block text-sm font-bold text-slate-700">
                          Correo Electrónico
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors duration-300">
                            <Mail className="text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" size={18} aria-hidden="true" />
                          </div>
                          <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-16 pr-5 py-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-slate-50 hover:bg-white text-slate-900 font-medium placeholder-slate-400"
                            placeholder="tu@email.com"
                            autoComplete="email"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="login-password" className="block text-sm font-bold text-slate-700">
                          Contraseña
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors duration-300">
                            <Lock className="text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" size={18} aria-hidden="true" />
                          </div>
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-16 pr-14 py-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-slate-50 hover:bg-white text-slate-900 font-medium placeholder-slate-400"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <label htmlFor="remember-me" className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative">
                            <input id="remember-me" type="checkbox" className="peer sr-only" />
                            <div className="w-5 h-5 rounded-lg border-2 border-slate-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-500 transition-all duration-300"></div>
                            <CheckCircle className="absolute inset-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300" aria-hidden="true" />
                          </div>
                          <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Recordarme</span>
                        </label>
                        <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline transition-all">
                          ¿Olvidaste tu contraseña?
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4">
                          <KeyRound className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Verificación en dos pasos</h3>
                        <p className="text-slate-500 mt-2">Ingresa el código de 6 dígitos de tu app autenticadora</p>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="login-totp" className="block text-sm font-bold text-slate-700 text-center">
                          Código de verificación
                        </label>
                        <input
                          id="login-totp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          aria-label="Código de verificación de 6 dígitos"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full py-5 text-center text-3xl tracking-[0.5em] font-mono border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-slate-50 hover:bg-white text-slate-900"
                          placeholder="000000"
                          maxLength={6}
                          autoFocus
                          required
                        />
                        <p className="text-sm text-slate-500 text-center mt-2">
                          También puedes usar un código de respaldo
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleBack}
                        className="w-full py-3 text-slate-600 font-medium hover:text-slate-900 transition-colors"
                      >
                        ← Volver al inicio de sesión
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full overflow-hidden py-4 px-8 rounded-2xl font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 transition-transform duration-500 group-hover:scale-105"></div>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    <span className="relative flex items-center justify-center gap-3">
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Ingresando...</span>
                        </>
                      ) : (
                        <>
                          <LogIn size={20} />
                          <span>Iniciar Sesión</span>
                          <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                        </>
                      )}
                    </span>
                  </button>
                </form>

                {/* Auth0 MFA Login */}
                {isAuth0Configured && (
                  <>
                    <div className="mt-8">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t-2 border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-white text-slate-500 font-medium">o continúa con</span>
                        </div>
                      </div>

                      <button
                        onClick={handleAuth0Login}
                        disabled={auth0Loading}
                        className="group mt-6 w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 disabled:opacity-50 hover:-translate-y-0.5"
                      >
                        {auth0Loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Conectando...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint size={22} />
                            <span>Iniciar con MFA Seguro</span>
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">Auth0</span>
                          </>
                        )}
                      </button>
                      
                      <p className="mt-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        Autenticación multifactor para mayor seguridad
                      </p>
                    </div>
                  </>
                )}

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-slate-500 font-medium">¿Nuevo en TriExpert?</span>
                </div>
              </div>

              <Link 
                to="/register" 
                className="group mt-6 w-full flex items-center justify-center gap-3 py-4 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-300"
              >
                <Sparkles className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                Crear cuenta gratis
                <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </Link>
            </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
