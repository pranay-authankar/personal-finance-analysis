import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { InvestmentProvider, useInvestments } from './context/InvestmentContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { FamilySelectPage } from './pages/FamilySelectPage';
import { HomePage } from './pages/HomePage';
import { FdDashboardPage } from './pages/FdDashboardPage';
import { FdDetailsPage } from './pages/FdDetailsPage';
import { AddFdPage } from './pages/AddFdPage';
import { PostOfficeDashboardPage } from './pages/PostOfficeDashboardPage';
import { PostOfficeDetailsPage } from './pages/PostOfficeDetailsPage';
import { AddPostOfficePage } from './pages/AddPostOfficePage';
import { BullionsDashboardPage } from './pages/BullionsDashboardPage';
import { BullionDetailsPage } from './pages/BullionDetailsPage';
import { AddBullionPage } from './pages/AddBullionPage';

import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warn';
}

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useInvestments();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'info' | 'warn' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  return (
    <div className="app-shell">
      <Navbar onShowToast={showToast} />

      <Routes>
        <Route path="/login" element={<LoginPage onShowToast={showToast} />} />

        <Route
          path="/family-select"
          element={
            <ProtectedRoute>
              <FamilySelectPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Fixed Deposits Routes */}
        <Route
          path="/fds"
          element={
            <ProtectedRoute>
              <FdDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/fds/:id"
          element={
            <ProtectedRoute>
              <FdDetailsPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-fd"
          element={
            <ProtectedRoute>
              <AddFdPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        {/* Post Office Routes */}
        <Route
          path="/post-office"
          element={
            <ProtectedRoute>
              <PostOfficeDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/post-office/:id"
          element={
            <ProtectedRoute>
              <PostOfficeDetailsPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-post-office"
          element={
            <ProtectedRoute>
              <AddPostOfficePage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        {/* Bullions Routes */}
        <Route
          path="/bullions"
          element={
            <ProtectedRoute>
              <BullionsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bullions/:id"
          element={
            <ProtectedRoute>
              <BullionDetailsPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-bullion"
          element={
            <ProtectedRoute>
              <AddBullionPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>

      {/* Floating Toast Notification Hub */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function App() {
  return (
    <InvestmentProvider>
      <Router>
        <AppContent />
      </Router>
    </InvestmentProvider>
  );
}

export default App;
