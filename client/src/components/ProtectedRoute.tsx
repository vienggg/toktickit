import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Role } from '../context/AuthContext';

/**
 * Gate for any route that requires a logged-in session (AC-15: direct
 * access to a protected route while logged out redirects to /login). Also
 * enforces the mandatory Change Password flow (AC-02): a user with
 * mustChangePassword=true is redirected there regardless of what they
 * tried to open, until it is cleared.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <span className="spinner-border text-success" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

/** Gate for a route restricted to specific roles; a signed-in user of the wrong role is bounced to their own default screen rather than shown a blank page. */
export const RequireRole: React.FC<{ roles: Role[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user) return null; // RequireAuth above this in the tree handles the redirect
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

/** Redirects an already-authenticated user away from /login. */
export const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user && !user.mustChangePassword) {
    return <Navigate to="/" replace />;
  }
  if (user && user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
};
