import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import { LayoutDashboard, FileText, AlertCircle, Upload, User, LogOut, Menu, X, Zap, BarChart3, ChevronDown, Bell, Settings, ClipboardCheck, AlertTriangle, CreditCard, Receipt, DollarSign, Building2, Shield, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  // Check onboarding status for clients
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!isAdmin && user) {
        try {
          const response = await api.get('/onboarding/status');
          setOnboardingStatus(response.data);
        } catch (err) {
          // If error, assume onboarding needed
          setOnboardingStatus({ completed: false, status: 'not_started' });
        }
      }
    };
    checkOnboarding();
  }, [user, isAdmin]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Análisis IA', href: '/credit-report-analysis', icon: BarChart3 },
    { name: 'Reportes Bureau', href: '/bureau-reports', icon: Building2 },
    { name: 'Credit Items', href: '/credit-items', icon: AlertCircle },
    { name: 'AI Dispute Letters', href: '/ai-disputes', icon: Zap },
    { name: 'Disputes', href: '/disputes', icon: FileText },
    { name: 'Documents', href: '/documents', icon: Upload },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const isActive = (path) => location.pathname === path;

  const getInitials = () => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="blob-primary w-96 h-96 -top-48 -left-48 animate-float"></div>
        <div className="blob-secondary w-80 h-80 top-1/3 -right-40 animate-float" style={{animationDelay: '-2s'}}></div>
        <div className="blob-tertiary w-72 h-72 -bottom-36 left-1/3 animate-float" style={{animationDelay: '-4s'}}></div>
      </div>
      
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                <img 
                  src="/assets/logo.png" 
                  alt="TriExpert Credit Repair" 
                  className="relative h-16 w-auto"
                />
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group relative flex items-center space-x-2 px-4 py-3 rounded-2xl transition-all duration-300 ${
                      active
                        ? 'text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl animate-gradient" style={{backgroundSize: '200% 200%'}}></div>
                    )}
                    {!active && (
                      <div className="absolute inset-0 bg-slate-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                    <Icon size={18} className="relative z-10" />
                    <span className="relative z-10 text-sm font-semibold">{item.name}</span>
                    {active && (
                      <Sparkles size={12} className="relative z-10 text-white/80" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Link 
                to="/notifications"
                className="relative p-3 text-slate-400 hover:text-slate-100 glass rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse"></span>
              </Link>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-2 glass rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-50"></div>
                    <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
                      {getInitials()}
                    </div>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold text-slate-100">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-400 capitalize font-medium">{user?.role}</p>
                  </div>
                  <ChevronDown size={16} className={`hidden md:block text-slate-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl py-2 z-50 animate-scale-in border border-slate-700/50">
                      <div className="px-5 py-4 border-b border-slate-700/50">
                        <p className="text-sm font-bold text-slate-100">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                      </div>
                      <div className="p-2">
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                        >
                          <User size={18} className="text-indigo-400" />
                          Mi Perfil
                        </Link>
                        <Link
                          to="/payment-history"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                        >
                          <Receipt size={18} className="text-emerald-400" />
                          Historial de Pagos
                        </Link>
                        <Link
                          to="/bank-accounts"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                        >
                          <Building2 size={18} className="text-sky-400" />
                          Cuentas Bancarias
                        </Link>
                        <Link
                          to="/pricing"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                        >
                          <CreditCard size={18} className="text-violet-400" />
                          Planes y Precios
                        </Link>
                        {isAdmin && (
                          <>
                            <div className="my-2 border-t border-slate-700/50"></div>
                            <Link
                              to="/admin/settings"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                            >
                              <Settings size={18} className="text-amber-400" />
                              Configuración Sistema
                            </Link>
                            <Link
                              to="/admin/payments"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                            >
                              <DollarSign size={18} className="text-emerald-400" />
                              Gestión de Pagos
                            </Link>
                            <Link
                              to="/admin/compliance"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200 font-medium"
                            >
                              <Shield size={18} className="text-rose-400" />
                              Cumplimiento Legal
                            </Link>
                          </>
                        )}
                      </div>
                      <div className="p-2 border-t border-slate-700/50">
                        <button
                          onClick={() => { setUserMenuOpen(false); logout(); }}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200 w-full font-medium"
                        >
                          <LogOut size={18} />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-3 text-slate-400 glass rounded-xl transition-all duration-300 hover:shadow-lg"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/20 glass animate-fade-in">
            <nav className="px-4 py-4 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
                      active
                        ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-semibold">{item.name}</span>
                    {active && <Sparkles size={14} className="ml-auto text-white/80" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Onboarding Banner for incomplete profiles */}
        {!isAdmin && onboardingStatus && !onboardingStatus.completed && location.pathname !== '/onboarding' && (
          <div className="mb-8 relative overflow-hidden rounded-3xl shadow-2xl animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 animate-gradient" style={{backgroundSize: '200% 200%'}}></div>
            <div className="relative p-6 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 text-white">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Complete su Registro</h3>
                  <p className="text-white/90 text-sm mt-1">
                    Para iniciar su proceso de reparación de crédito, necesitamos información adicional.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="flex items-center gap-2 px-8 py-4 bg-white text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                <ClipboardCheck size={20} />
                Completar Ahora
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/20 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <img src="/assets/logo.png" alt="TriExpert" className="relative h-10 w-auto" />
              </div>
              <span className="text-sm text-slate-400 font-medium">© {new Date().getFullYear()} TriExpert Credit Repair</span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="text-sm text-slate-500">2800 E 113th Ave, Tampa, FL 33617</span>
              <span className="hidden md:inline text-slate-600">•</span>
              <a href="tel:+18133693340" className="text-sm text-slate-500 hover:text-indigo-400 transition-colors font-medium">(813) 369-3340</a>
            </div>
            <div className="flex items-center gap-4 md:gap-8 text-sm">
              <Link to="/consumer-rights" className="text-slate-500 hover:text-indigo-400 transition-all duration-300 font-medium hover:-translate-y-0.5">Derechos</Link>
              <Link to="/privacy-policy" className="text-slate-500 hover:text-indigo-400 transition-all duration-300 font-medium hover:-translate-y-0.5">Privacidad</Link>
              <Link to="/terms" className="text-slate-500 hover:text-indigo-400 transition-all duration-300 font-medium hover:-translate-y-0.5">Términos</Link>
              <Link to="/support" className="text-slate-500 hover:text-indigo-400 transition-all duration-300 font-medium hover:-translate-y-0.5">Soporte</Link>
              <button 
                onClick={() => window.Tawk_API && window.Tawk_API.toggle()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <Sparkles size={14} />
                Chat
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
