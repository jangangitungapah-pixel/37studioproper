import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import OneSignalPermissionWidget from './components/notifications/OneSignalPermissionWidget.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import {
  initOneSignal,
  isOneSignalBrowserSupported,
} from './services/oneSignalService.js';

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ClientLandingPage = lazy(() => import('./pages/ClientLandingPage.jsx'));
const ClientLoginPage = lazy(() => import('./pages/ClientLoginPage.jsx'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage.jsx'));
const PwaLaunchPage = lazy(() => import('./pages/PwaLaunchPage.jsx'));
const GuardAttendancePage = lazy(() => import('./pages/guard/GuardAttendancePage.jsx'));

export default function App() {
  // Eagerly start the OneSignal SDK as soon as the app mounts — do not wait
  // for the permission widget to render. This primes the subscription pipeline
  // so push tokens are ready the moment the user logs in.
  useEffect(() => {
    if (isOneSignalBrowserSupported()) {
      initOneSignal().catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<ClientLandingPage />} />
            <Route path="/launch" element={<PwaLaunchPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/client/login" element={<ClientLoginPage />} />
            <Route path="/client/portal" element={<><OneSignalPermissionWidget /><ClientPortalPage /></>} />
            <Route path="/client" element={<ClientLandingPage />} />
            <Route path="/guard" element={<Navigate to="/guard/attendance" replace />} />
            <Route path="/guard/attendance" element={<GuardAttendancePage />} />
            <Route path="/admin/*" element={<><OneSignalPermissionWidget /><AdminPage /></>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

