import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DateTimeProvider } from './context/DateTimeContext';
import { InvestmentProvider, useInvestments } from './context/InvestmentContext';
import { Sidebar } from './components/Sidebar';
import { TopUtilityBar } from './components/TopUtilityBar';
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
import { RealEstateDashboardPage } from './pages/RealEstateDashboardPage';
import { RealEstateDetailsPage } from './pages/RealEstateDetailsPage';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { RealizedFundsDashboardPage } from './pages/RealizedFundsDashboardPage';
import { AddRealizedFundPage } from './pages/AddRealizedFundPage';

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
  const { isAuthenticated } = useInvestments();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('familyvault_sidebar_collapsed') === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('familyvault_sidebar_collapsed', next ? 'true' : 'false');
      return next;
    });
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warn' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  if (!isAuthenticated) {
    return (
      <div className="app-shell auth-only">
        <Routes>
          <Route path="/login" element={<LoginPage onShowToast={showToast} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app-shell with-sidebar ${
        isSidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'
      }`}
    >
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onShowToast={showToast}
      />

      <div className="app-main-viewport">
        <TopUtilityBar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />

        <main className="app-page-wrapper">
          <Routes>
            <Route path="/login" element={<Navigate to="/home" replace />} />

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
              <FdDashboardPage onShowToast={showToast} />
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
              <PostOfficeDashboardPage onShowToast={showToast} />
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
              <BullionsDashboardPage onShowToast={showToast} />
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

        {/* Real Estate Routes */}
        <Route
          path="/real-estate"
          element={
            <ProtectedRoute>
              <RealEstateDashboardPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/real-estate/:id"
          element={
            <ProtectedRoute>
              <RealEstateDetailsPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-property"
          element={
            <ProtectedRoute>
              <AddPropertyPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        {/* Realized Funds Routes */}
        <Route
          path="/realized-funds"
          element={
            <ProtectedRoute>
              <RealizedFundsDashboardPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-realized-fund"
          element={
            <ProtectedRoute>
              <AddRealizedFundPage onShowToast={showToast} />
            </ProtectedRoute>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </main>
  </div>

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
    <DateTimeProvider>
      <InvestmentProvider>
        <Router>
          <AppContent />
        </Router>
      </InvestmentProvider>
    </DateTimeProvider>
  );
}

export default App;
