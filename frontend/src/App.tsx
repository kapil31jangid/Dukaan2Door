import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Page
import { LoginPage } from './pages/auth/LoginPage';

// Retailer Pages
import { RetailerDashboard } from './pages/retailer/RetailerDashboard';
import { RetailerOrdersPage } from './pages/retailer/RetailerOrdersPage';
import { RetailerInventoryPage } from './pages/retailer/RetailerInventoryPage';
import { RetailerStorePage } from './pages/retailer/RetailerStorePage';

// Delivery Partner Pages
import { DeliveryDashboard } from './pages/delivery/DeliveryDashboard';
import { DeliveryHistoryPage } from './pages/delivery/DeliveryHistoryPage';

const RootRedirect: React.FC = () => {
  const { user, role, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'retailer') {
    return <Navigate to="/retailer" replace />;
  }

  if (role === 'delivery_partner') {
    return <Navigate to="/delivery" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Retailer Dashboard Routes */}
          <Route
            path="/retailer"
            element={
              <ProtectedRoute allowedRoles={['retailer']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RetailerDashboard />} />
            <Route path="orders" element={<RetailerOrdersPage />} />
            <Route path="inventory" element={<RetailerInventoryPage />} />
            <Route path="store" element={<RetailerStorePage />} />
          </Route>

          {/* Delivery Partner Dashboard Routes */}
          <Route
            path="/delivery"
            element={
              <ProtectedRoute allowedRoles={['delivery_partner']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DeliveryDashboard />} />
            <Route path="history" element={<DeliveryHistoryPage />} />
          </Route>

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
