import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CreditItems from './pages/CreditItems';
import Disputes from './pages/Disputes';
import Documents from './pages/Documents';
import Profile from './pages/Profile';
import Layout from './components/Layout';

const PrivateRoute = ({ children, requireAdmin }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" /> : <Login />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/dashboard" /> : <Register />
      } />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={
          isAdmin ? <AdminDashboard /> : <ClientDashboard />
        } />
        <Route path="credit-items" element={<CreditItems />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="documents" element={<Documents />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
