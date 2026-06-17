import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ClientLandingPage = lazy(() => import('./pages/ClientLandingPage.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/client" element={<ClientLandingPage />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
