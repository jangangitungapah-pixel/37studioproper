import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isAdminAuthenticated } from './auth/adminAuth.js';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

function LoginRoute() {
  return isAdminAuthenticated() ? <Navigate to="/admin/schedule" replace /> : <LoginPage />;
}

function AdminRoute() {
  return isAdminAuthenticated() ? <AdminPage /> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAdminAuthenticated() ? '/admin/schedule' : '/login'} replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/admin/*" element={<AdminRoute />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
