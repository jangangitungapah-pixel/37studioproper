import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import OneSignalPermissionWidget from './components/notifications/OneSignalPermissionWidget.jsx';

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ClientLandingPage = lazy(() => import('./pages/ClientLandingPage.jsx'));
const ClientLoginPage = lazy(() => import('./pages/ClientLoginPage.jsx'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage.jsx'));
const PwaLaunchPage = lazy(() => import('./pages/PwaLaunchPage.jsx'));
const GuardAttendancePage = lazy(() => import('./pages/guard/GuardAttendancePage.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <OneSignalPermissionWidget />
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<ClientLandingPage />} />
          <Route path="/launch" element={<PwaLaunchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/client/login" element={<ClientLoginPage />} />
          <Route path="/client/portal" element={<ClientPortalPage />} />
          <Route path="/client" element={<ClientLandingPage />} />
          <Route path="/guard" element={<Navigate to="/guard/attendance" replace />} />
          <Route path="/guard/attendance" element={<GuardAttendancePage />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
