import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_BADGE_CLASS, ROLE_LABEL } from '../constants/roles';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentView?: 'create' | 'list' | 'detail';
  setCurrentView?: (view: 'create' | 'list' | 'detail') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isRequester = user?.role === 'REQUESTER';
  const isStaff = user?.role === 'IT_STAFF';
  const isAdministrator = user?.role === 'ADMINISTRATOR';
  const onStaffRoute = location.pathname.startsWith('/staff/');

  return (
    <nav aria-label="Main navigation" className="navbar navbar-dark shadow-sm" style={{ backgroundColor: 'var(--zen-primary)' }}>
      <div className="container-fluid px-3 px-lg-4 align-items-start">
        <div className="d-flex w-100 flex-wrap align-items-center gap-2">
          <a
            className="navbar-brand d-flex align-items-center gap-2 fw-bold text-white fs-5 mb-0"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              if (isRequester) setCurrentView?.('create');
              else navigate('/');
            }}
          >
            <span
              aria-hidden="true"
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '0.5rem',
                padding: '0.2rem 0.5rem',
                fontSize: '1rem',
              }}
            >
              🎫
            </span>
            <span>TokTickIT</span>
            <span className="badge bg-white text-zen-primary fs-6 fw-normal d-none d-sm-inline">Helpdesk</span>
          </a>

          <div className="d-flex align-items-center gap-2 ms-auto">
            {user && (
              <div
                className="d-flex align-items-center gap-1 bg-white bg-opacity-10 px-2 py-1 rounded-pill text-white border border-white border-opacity-25"
                style={{ fontSize: '0.8rem', minWidth: 0 }}
                data-testid="authenticated-user"
              >
                <span aria-hidden="true">👤</span>
                <span className="text-truncate" title={user.name} style={{ maxWidth: 'min(10rem, 30vw)' }}>
                  {user.name}
                </span>
                <span className={`badge fw-semibold ${ROLE_BADGE_CLASS[user.role]}`} data-testid="role-badge">
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-sm btn-light text-zen-primary fw-semibold px-2 px-sm-3 d-flex align-items-center gap-1 shadow-sm"
              onClick={handleLogout}
              style={{ borderRadius: '0.4rem' }}
            >
              <span aria-hidden="true">🚪</span>
              <span>Logout</span>
            </button>
          </div>

          <div className="d-flex w-100 align-items-center gap-2 flex-wrap">
            {isRequester && (
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm text-white ${
                    currentView === 'create' ? 'bg-white bg-opacity-25 fw-bold shadow-sm' : 'text-white-50 border-0'
                  }`}
                  onClick={() => setCurrentView?.('create')}
                  style={{ borderRadius: '0.5rem' }}
                >
                  ➕ Create Ticket
                </button>
                <button
                  type="button"
                  className={`btn btn-sm text-white ${
                    currentView === 'list' ? 'bg-white bg-opacity-25 fw-bold shadow-sm' : 'text-white-50 border-0'
                  }`}
                  onClick={() => setCurrentView?.('list')}
                  style={{ borderRadius: '0.5rem' }}
                >
                  📋 My Tickets
                </button>
              </div>
            )}
            {(isStaff || isAdministrator) && (
              <Link
                className={`btn btn-sm role-destination-link ${onStaffRoute ? 'bg-white bg-opacity-25 fw-bold text-white' : 'text-white-50 border-0'}`}
                to="/staff/queue"
                aria-current={onStaffRoute ? 'page' : undefined}
              >
                📋 Ticket Queue
              </Link>
            )}
            {isAdministrator && (
              <Link
                className={`btn btn-sm role-destination-link ${location.pathname === '/admin/users' ? 'bg-white bg-opacity-25 fw-bold text-white' : 'text-white-50 border-0'}`}
                to="/admin/users"
                aria-current={location.pathname === '/admin/users' ? 'page' : undefined}
              >
                🛡️ User Management
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
