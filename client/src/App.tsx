import React, { useState } from 'react';
import { DevRequesterProvider } from './context/DevRequesterContext';
import { Navbar } from './components/Navbar';
import { DevRequesterModal } from './components/DevRequesterModal';
import { CreateTicket } from './components/CreateTicket';
import { MyTickets } from './components/MyTickets';
import { TicketDetail } from './components/TicketDetail';

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
        {activeTab === 'create' && <CreateTicket />}

        {activeTab === 'list' && (
          <MyTickets
            onSelectTicket={handleSelectTicket}
            onNavigateToCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'detail' && selectedTicketId && (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => setActiveTab('list')}
          />
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
