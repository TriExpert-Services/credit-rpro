import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { AuthProvider, useAuth } from './context/Auth0Context';
import { AccessProvider, useAccess } from './context/AccessContext';

// Eagerly load Login (first page users see)
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';

// Lazy-loaded pages - split into separate chunks for better performance
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CreditItems = lazy(() => import('./pages/CreditItems'));
const AIDisputes = lazy(() => import('./pages/AIDisputes'));
const Disputes = lazy(() => import('./pages/Disputes'));
const Documents = lazy(() => import('./pages/Documents'));
const Profile = lazy(() => import('./pages/Profile'));
const CreditReportAnalysis = lazy(() => import('./pages/CreditReportAnalysis'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ClientOnboarding = lazy(() => import('./pages/ClientOnboarding'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Support = lazy(() => import('./pages/Support'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ConsumerRights = lazy(() => import('./pages/ConsumerRights'));
const CancellationForm = lazy(() => import('./pages/CancellationForm'));
const ServiceContract = lazy(() => import('./pages/ServiceContract'));
const FeeDisclosure = lazy(() => import('./pages/FeeDisclosure'));
const LegalOnboarding = lazy(() => import('./pages/LegalOnboarding'));
const AdminCompliance = lazy(() => import('./pages/AdminCompliance'));

// Auth0 Configuration
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-900">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 text-sm">Cargando...</p>
    </div>
  </div>
);

// Simple private route - only checks authentication
const SimplePrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Admin-only route - uses AccessContext
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAccess();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

// Dashboard router that uses AccessContext for accurate role detection
function DashboardRouter() {
  const { isAdmin, loading } = useAccess();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }
  
  return isAdmin ? <AdminDashboard /> : <ClientDashboard />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <AccessProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login />
          } />
          <Route path="/register" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Register />
          } />
          
          {/* Pricing page - accessible without full subscription */}
          <Route path="/pricing" element={
            <SimplePrivateRoute><Pricing /></SimplePrivateRoute>
          } />
          
          <Route path="/" element={<SimplePrivateRoute><Layout /></SimplePrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<DashboardRouter />} />
            <Route path="credit-items" element={<CreditItems />} />
            <Route path="ai-disputes" element={<AIDisputes />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="documents" element={<Documents />} />
            <Route path="profile" element={<Profile />} />
            <Route path="credit-report-analysis" element={<CreditReportAnalysis />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="onboarding" element={<ClientOnboarding />} />
            <Route path="payment-history" element={<PaymentHistory />} />
            <Route path="bank-accounts" element={<BankAccounts />} />
            <Route path="support" element={<Support />} />
            <Route path="admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="admin/compliance" element={<AdminRoute><AdminCompliance /></AdminRoute>} />
          </Route>

          {/* Public pages - accessible without layout */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/consumer-rights" element={<ConsumerRights />} />
          <Route path="/cancellation-form" element={<SimplePrivateRoute><CancellationForm /></SimplePrivateRoute>} />
          <Route path="/service-contract" element={<SimplePrivateRoute><ServiceContract /></SimplePrivateRoute>} />
          <Route path="/fee-disclosure" element={<SimplePrivateRoute><FeeDisclosure /></SimplePrivateRoute>} />
          <Route path="/legal-onboarding" element={<SimplePrivateRoute><LegalOnboarding /></SimplePrivateRoute>} />

          {/* 404 Page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AccessProvider>
  );
}

function App() {
  // Si Auth0 no está configurado, usar solo autenticación local
  const isAuth0Configured = auth0Domain && auth0ClientId && 
    auth0Domain !== 'tu-tenant.us.auth0.com' && 
    auth0ClientId !== 'tu_client_id_aqui';

  const AppContent = (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );

  // Si Auth0 está configurado, envolver con Auth0Provider
  if (isAuth0Configured) {
    return (
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: auth0Audience,
          scope: 'openid profile email',
        }}
        cacheLocation="localstorage"
        useRefreshTokens={true}
      >
        {AppContent}
      </Auth0Provider>
    );
  }

  // Sin Auth0, usar solo autenticación local
  return AppContent;
}

export default App;
