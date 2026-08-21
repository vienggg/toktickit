import React, { useState } from 'react';
import { DevRequesterProvider } from './context/DevRequesterContext';
import { Navbar } from './components/Navbar';
import { DevRequesterModal } from './components/DevRequesterModal';
import { CreateTicket } from './components/CreateTicket';
import { MyTickets } from './components/MyTickets';

function MainContent() {
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'detail' | 'lab1'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    setActiveTab('detail');
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--zen-neutral-light)' }}>
      <Navbar currentView={activeTab} setCurrentView={setActiveTab} />
      <DevRequesterModal />

      <main className="container py-4 flex-grow-1">
        {activeTab === 'create' && (
          <CreateTicket />
        )}

        {activeTab === 'list' && (
          <MyTickets
            onSelectTicket={handleSelectTicket}
            onNavigateToCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'detail' && (
          <div className="card border-0 shadow-sm p-4 text-center bg-white" style={{ borderRadius: '0.75rem' }}>
            <h5 className="fw-bold text-zen-primary mb-2">🎫 Ticket Detail View</h5>
            <p className="text-muted mb-3">
              Selected Ticket ID: <strong>{selectedTicketId}</strong>.
              (Ticket detail, attachment lifecycle, and in-place edit mode will be mounted here in Issue #34).
            </p>
            <div>
              <button
                type="button"
                className="btn btn-zen-outline btn-sm"
                onClick={() => setActiveTab('list')}
              >
                ← Back to My Tickets
              </button>
            </div>
          </div>
        )}
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
