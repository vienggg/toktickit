import React, { useState } from 'react';
import { DevRequesterProvider } from './context/DevRequesterContext';
import { Navbar } from './components/Navbar';
import { DevRequesterModal } from './components/DevRequesterModal';
import { CreateTicket } from './components/CreateTicket';

function MainContent() {
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'detail' | 'lab1'>('create');

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--zen-neutral-light)' }}>
      <Navbar currentView={activeTab} setCurrentView={setActiveTab} />
      <DevRequesterModal />

      <main className="container py-4 flex-grow-1">
        {activeTab === 'create' && <CreateTicket />}
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
