import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RequireAuth, RequireRole, RedirectIfAuthenticated } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { ChangePassword } from './components/ChangePassword';
import { CreateTicket } from './components/CreateTicket';
import { MyTickets } from './components/MyTickets';
import { TicketDetail } from './components/TicketDetail';
import { StaffTicketQueue } from './components/StaffTicketQueue';
import { StaffTicketDetail } from './components/StaffTicketDetail';
import { UserManagement } from './components/UserManagement';
import { RequesterDashboard } from './components/RequesterDashboard';
import { StaffDashboard } from './components/StaffDashboard';

// Lab 4 (D-16, ui-spec §2): the Requester area is URL-based so dashboard drill-down links
// (/tickets?status=ACTIVE) can be opened, bookmarked and tested.
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--zen-neutral-light)' }}>
      <Navbar />
      <main className="container py-4 flex-grow-1">{children}</main>
      <footer className="py-3 text-center text-muted border-top bg-white small">TokTickIT IT Helpdesk — CPE 334</footer>
    </div>
  );
}

// Dashboard drill-down values -> what the My Tickets status filter understands.
const REQUESTER_STATUS_FILTER: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  WAITING_FOR_REQUESTER: 'WAITING_FOR_REQUESTER',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

function MyTicketsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('status') ?? '';
  return (
    <PageShell>
      <MyTickets
        key={wanted}
        initialStatus={REQUESTER_STATUS_FILTER[wanted]}
        onSelectTicket={(id) => navigate(`/tickets/${id}`)}
        onNavigateToCreate={() => navigate('/tickets/new')}
      />
    </PageShell>
  );
}

function CreateTicketPage() {
  return (
    <PageShell>
      <CreateTicket />
    </PageShell>
  );
}

function TicketDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const ticketId = id ? parseInt(id, 10) : NaN;
  return (
    <PageShell>
      {Number.isFinite(ticketId) ? (
        <TicketDetail ticketId={ticketId} onBack={() => navigate('/tickets')} />
      ) : (
        <div className="alert alert-danger" role="alert">
          That ticket could not be found.
        </div>
      )}
    </PageShell>
  );
}

// /dashboard is the landing page for every role (D-17).
function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <PageShell>{user.role === 'REQUESTER' ? <RequesterDashboard /> : <StaffDashboard />}</PageShell>;
}

function RoleHome() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to="/dashboard" replace />;
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
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <RequireAuth>
                <RequireRole roles={['REQUESTER']}>
                  <MyTicketsPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequireAuth>
                <RequireRole roles={['REQUESTER']}>
                  <CreateTicketPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequireAuth>
                <RequireRole roles={['REQUESTER']}>
                  <TicketDetailPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/staff/queue"
            element={
              <RequireAuth>
                <RequireRole roles={['IT_STAFF', 'ADMINISTRATOR']}>
                  <StaffTicketQueue />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/staff/tickets/:id"
            element={
              <RequireAuth>
                <RequireRole roles={['IT_STAFF', 'ADMINISTRATOR']}>
                  <StaffTicketDetail />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireRole roles={['ADMINISTRATOR']}>
                  <UserManagement />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="*" element={<RequireAuth><RoleHome /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
