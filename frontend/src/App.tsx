import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
const named = <T extends React.ComponentType<any>>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) => lazy(async () => ({ default: (await loader())[exportName] as T }));

const AppLayout = named(() => import('./components/layout/AppLayout'), 'AppLayout');
const CustomerLayout = named(() => import('./components/customer/CustomerLayout'), 'CustomerLayout');
const LoginPage = named(() => import('./pages/auth/LoginPage'), 'LoginPage');
const RoleLoginPage = named(() => import('./pages/auth/RoleLoginPage'), 'RoleLoginPage');
const RegisterPage = named(() => import('./pages/auth/RegisterPage'), 'RegisterPage');
const PublicHomePage = named(() => import('./pages/public/PublicHomePage'), 'PublicHomePage');
const RetailerHomePage = named(() => import('./pages/retailer/RetailerHomePage'), 'RetailerHomePage');
const RetailerOrdersPage = named(() => import('./pages/retailer/RetailerOrdersPage'), 'RetailerOrdersPage');
const RetailerStorePage = named(() => import('./pages/retailer/RetailerStorePage'), 'RetailerStorePage');
const RetailerMenuPage = named(() => import('./pages/retailer/RetailerMenuPage'), 'RetailerMenuPage');
const RetailerStoreOverviewPage = named(() => import('./pages/retailer/RetailerStoreOverviewPage'), 'RetailerStoreOverviewPage');
const RetailerBusinessSettingsPage = named(() => import('./pages/retailer/RetailerBusinessSettingsPage'), 'RetailerBusinessSettingsPage');
const RetailerPerformancePage = named(() => import('./pages/retailer/RetailerPerformancePage'), 'RetailerPerformancePage');
const RetailerHelpPage = named(() => import('./pages/retailer/RetailerHelpPage'), 'RetailerHelpPage');
const RetailerInventoryPage = named(() => import('./pages/retailer/RetailerInventoryPage'), 'RetailerInventoryPage');
const CurrentDeliveryPage = named(() => import('./pages/delivery/CurrentDeliveryPage'), 'CurrentDeliveryPage');
const DeliveryHomePage = named(() => import('./pages/delivery/DeliveryHomePage'), 'DeliveryHomePage');
const DeliveryHistoryPage = named(() => import('./pages/delivery/DeliveryHistoryPage'), 'DeliveryHistoryPage');
const AvailableOrdersPage = named(() => import('./pages/delivery/AvailableOrdersPage'), 'AvailableOrdersPage');
const DeliveryEarningsPage = named(() => import('./pages/delivery/DeliveryEarningsPage'), 'DeliveryEarningsPage');
const DeliveryProfilePage = named(() => import('./pages/delivery/DeliveryProfilePage'), 'DeliveryProfilePage');
const HomePage = named(() => import('./pages/customer/HomePage'), 'HomePage');
const LocationPage = named(() => import('./pages/customer/LocationPage'), 'LocationPage');
const StorePage = named(() => import('./pages/customer/StorePage'), 'StorePage');
const ProductListingPage = named(() => import('./pages/customer/ProductListingPage'), 'ProductListingPage');
const SearchPage = named(() => import('./pages/customer/SearchPage'), 'SearchPage');
const ProductDetailPage = named(() => import('./pages/customer/ProductDetailPage'), 'ProductDetailPage');
const CartPage = named(() => import('./pages/customer/CartPage'), 'CartPage');
const CheckoutPage = named(() => import('./pages/customer/CheckoutPage'), 'CheckoutPage');
const OrderHistoryPage = named(() => import('./pages/customer/OrderHistoryPage'), 'OrderHistoryPage');
const OrderDetailPage = named(() => import('./pages/customer/OrderDetailPage'), 'OrderDetailPage');
const OrderConfirmationPage = named(() => import('./pages/customer/OrderConfirmationPage'), 'OrderConfirmationPage');
const OrderStatusPage = named(() => import('./pages/customer/OrderStatusPage'), 'OrderStatusPage');
const LiveTrackingPage = named(() => import('./pages/customer/LiveTrackingPage'), 'LiveTrackingPage');
const ProfilePage = named(() => import('./pages/customer/ProfilePage'), 'ProfilePage');
const HelpSupportPage = named(() => import('./pages/customer/HelpSupportPage'), 'HelpSupportPage');
const NotificationsPage = named(() => import('./pages/customer/NotificationsPage'), 'NotificationsPage');

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-live="polite">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
    <span className="sr-only">Loading page</span>
  </div>
);

const RootRedirect: React.FC = () => {
  const { user, role, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <PublicHomePage />;
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
          <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public / Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/customer" element={<RoleLoginPage role="customer" />} />
            <Route path="/login/retailer" element={<RoleLoginPage role="retailer" />} />
            <Route path="/login/delivery" element={<RoleLoginPage role="delivery_partner" />} />
            <Route path="/login/delivery_partner" element={<Navigate to="/login/delivery" replace />} />
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
              <Route path="inventory" element={<RetailerInventoryPage />} />
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
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
