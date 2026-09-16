import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, RedirectIfAuthenticated } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { ChangePassword } from './components/ChangePassword';
import { CreateTicket } from './components/CreateTicket';
import { MyTickets } from './components/MyTickets';
import { TicketDetail } from './components/TicketDetail';

function RequesterWorkspace() {
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    setActiveTab('detail');
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--zen-neutral-light)' }}>
      <Navbar currentView={activeTab} setCurrentView={setActiveTab} />

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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/change-password"
            element={
              <RequireAuth>
                <ChangePassword />
              </RequireAuth>
            }
          />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <RequesterWorkspace />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
