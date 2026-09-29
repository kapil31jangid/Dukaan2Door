import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Retailer Pages
import { RetailerHomePage } from './pages/retailer/RetailerHomePage';
import { RetailerOrdersPage } from './pages/retailer/RetailerOrdersPage';
import { RetailerStorePage } from './pages/retailer/RetailerStorePage';
import { RetailerMenuPage } from './pages/retailer/RetailerMenuPage';
import { RetailerStoreOverviewPage } from './pages/retailer/RetailerStoreOverviewPage';
import { RetailerBusinessSettingsPage } from './pages/retailer/RetailerBusinessSettingsPage';
import { RetailerPerformancePage } from './pages/retailer/RetailerPerformancePage';
import { RetailerHelpPage } from './pages/retailer/RetailerHelpPage';

// Delivery Partner Pages
import { DeliveryDashboard } from './pages/delivery/DeliveryDashboard';
import { CurrentDeliveryPage } from './pages/delivery/CurrentDeliveryPage';
import { DeliveryHomePage } from './pages/delivery/DeliveryHomePage';
import { DeliveryHistoryPage } from './pages/delivery/DeliveryHistoryPage';
import { AvailableOrdersPage } from './pages/delivery/AvailableOrdersPage';
import { DeliveryEarningsPage } from './pages/delivery/DeliveryEarningsPage';
import { DeliveryProfilePage } from './pages/delivery/DeliveryProfilePage';

// Customer Layout & Pages
import { CustomerLayout } from './components/customer/CustomerLayout';
import { HomePage } from './pages/customer/HomePage';
import { LocationPage } from './pages/customer/LocationPage';
import { StorePage } from './pages/customer/StorePage';
import { ProductListingPage } from './pages/customer/ProductListingPage';
import { SearchPage } from './pages/customer/SearchPage';
import { ProductDetailPage } from './pages/customer/ProductDetailPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { OrderHistoryPage } from './pages/customer/OrderHistoryPage';
import { OrderDetailPage } from './pages/customer/OrderDetailPage';
import { OrderConfirmationPage } from './pages/customer/OrderConfirmationPage';
import { OrderStatusPage } from './pages/customer/OrderStatusPage';
import { LiveTrackingPage } from './pages/customer/LiveTrackingPage';
import { ProfilePage } from './pages/customer/ProfilePage';
import { HelpSupportPage } from './pages/customer/HelpSupportPage';
import { NotificationsPage } from './pages/customer/NotificationsPage';

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

  if (role === 'customer') {
    return <Navigate to="/customer/home" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Public / Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
              <Route index element={<RetailerHomePage />} />
              <Route path="orders" element={<RetailerOrdersPage />} />
              <Route path="inventory" element={<RetailerMenuPage />} />
              <Route path="menu" element={<RetailerMenuPage />} />
              <Route path="store" element={<RetailerStoreOverviewPage />} />
              <Route path="store/edit" element={<RetailerStorePage />} />
              <Route path="settings" element={<RetailerBusinessSettingsPage />} />
              <Route path="performance" element={<RetailerPerformancePage />} />
              <Route path="help" element={<RetailerHelpPage />} />
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
              <Route index element={<DeliveryHomePage />} />
              <Route path="orders" element={<AvailableOrdersPage />} />
              <Route path="current" element={<CurrentDeliveryPage />} />
              <Route path="earnings" element={<DeliveryEarningsPage />} />
              <Route path="history" element={<DeliveryHistoryPage />} />
              <Route path="profile" element={<DeliveryProfilePage />} />
            </Route>

            {/* Customer Routes */}
            <Route
              path="/customer"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="location" element={<LocationPage />} />
              <Route path="store" element={<StorePage />} />
              <Route path="products" element={<ProductListingPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders" element={<OrderHistoryPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="orders/:id/confirmation" element={<OrderConfirmationPage />} />
              <Route path="orders/:id/status" element={<OrderStatusPage />} />
              <Route path="orders/:id/tracking" element={<LiveTrackingPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="help" element={<HelpSupportPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Fallback Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
