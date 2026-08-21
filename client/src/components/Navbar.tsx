import React from 'react';
import { useDevRequester } from '../context/DevRequesterContext';

interface NavbarProps {
  currentView: 'create' | 'list' | 'detail' | 'lab1';
  setCurrentView: (view: 'create' | 'list' | 'detail' | 'lab1') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { currentRequester, setIsModalOpen } = useDevRequester();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark shadow-sm" style={{ backgroundColor: 'var(--zen-primary)' }}>
      <div className="container-fluid px-3 px-lg-4">
        <a
          className="navbar-brand d-flex align-items-center gap-2 fw-bold text-white fs-5"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setCurrentView('create');
          }}
        >
          <span
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '0.5rem',
              padding: '0.2rem 0.5rem',
              fontSize: '1rem',
            }}
          >
            🎫
          </span>
          TokTickIT <span className="badge bg-white text-zen-primary fs-6 fw-normal">Helpdesk</span>
        </a>

        <div className="d-flex align-items-center gap-3 ms-auto">
          {/* Simulated Requester Context Pill */}
          <div
            className="d-none d-md-flex align-items-center bg-white bg-opacity-10 px-3 py-1 rounded-pill text-white border border-white border-opacity-25"
            style={{ fontSize: '0.85rem' }}
          >
            <span className="me-2">👤</span>
            <span>
              Requester:{' '}
              <strong>
                {currentRequester ? `${currentRequester.name} (${currentRequester.department})` : 'Loading...'}
              </strong>
            </span>
          </div>

          {/* Change Requester Action Button */}
          <button
            type="button"
            className="btn btn-sm btn-light text-zen-primary fw-semibold px-3 d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setIsModalOpen(true)}
            style={{ borderRadius: '0.4rem' }}
          >
            <span>🔄</span>
            <span>Change Requester</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
