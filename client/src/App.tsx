import React, { useState } from 'react';
import { DevRequesterProvider, useDevRequester } from './context/DevRequesterContext';
import { Navbar } from './components/Navbar';
import { DevRequesterModal } from './components/DevRequesterModal';

function MainContent() {
  const { currentRequester, setIsModalOpen } = useDevRequester();
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'detail' | 'lab1'>('create');

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--zen-neutral-light)' }}>
      <Navbar currentView={activeTab} setCurrentView={setActiveTab} />
      <DevRequesterModal />

      <main className="container py-4 flex-grow-1">
        {/* Development Requester Banner */}
        <div className="card border-0 shadow-sm mb-4 bg-white" style={{ borderRadius: '0.75rem' }}>
          <div className="card-body p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <span className="badge badge-zen px-2.5 py-1.5 mb-2">Simulated Requester Context</span>
              <h4 className="fw-bold mb-1 text-dark">
                {currentRequester ? currentRequester.name : 'Loading requester...'}
              </h4>
              <p className="text-muted small mb-0">
                Department: <strong>{currentRequester?.department}</strong> | Email: <code>{currentRequester?.email}</code>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-zen-outline btn-sm d-flex align-items-center gap-2 align-self-start align-self-md-center"
              onClick={() => setIsModalOpen(true)}
            >
              <span>🔄</span> Switch Simulated User
            </button>
          </div>
        </div>

        {/* Placeholder for subsequent Issue screens */}
        <div className="card border-0 shadow-sm p-4 text-center bg-white" style={{ borderRadius: '0.75rem' }}>
          <h5 className="fw-bold text-zen-primary mb-2">✅ Requester Context Active</h5>
          <p className="text-muted mb-3" style={{ maxWidth: 540, margin: '0 auto' }}>
            The development requester session is now initialized for <strong>{currentRequester?.name}</strong>.
            Upcoming issues will mount the <strong>Create Ticket</strong>, <strong>My Tickets</strong>, and <strong>Ticket Detail</strong> modules here.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2">
              API Context: Ready
            </span>
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2">
              Prisma Database: Connected
            </span>
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-muted border-top bg-white small">
        TokTickIT IT Helpdesk MVP — CPE 334 Software Engineering
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <DevRequesterProvider>
      <MainContent />
    </DevRequesterProvider>
  );
}
