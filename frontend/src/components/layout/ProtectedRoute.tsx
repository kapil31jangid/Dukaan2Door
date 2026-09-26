import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { Spinner } from '../ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" label="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    // If authenticated user has wrong role, route to their designated home
    if (role === 'retailer') {
      return <Navigate to="/retailer" replace />;
    } else if (role === 'delivery_partner') {
      return <Navigate to="/delivery" replace />;
    } else if (role === 'customer') {
      return <Navigate to="/customer/home" replace />;
    } else {
      // Unknown role
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
          <div className="max-w-md p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-sm text-slate-600 mb-6">
              Your account ({user.email}) has the role <span className="font-semibold text-slate-800">{user.role}</span> which is not authorized for this dashboard.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('d2d_access_token');
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900"
            >
              Log in with Merchant / Delivery Account
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
