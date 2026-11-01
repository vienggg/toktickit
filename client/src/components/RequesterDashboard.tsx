import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { DashboardError, DashboardSkeleton, ListCard, MetricCard, formatWhen, type Metric } from './DashboardParts';
import { TicketStatusBadge } from './TicketStatusBadge';

// Lab 4 (I-5): Requester dashboard. Spec: ui-spec §4, api-spec §3. It summarises only the
// signed-in Requester's own tickets (the backend enforces that) and links to My Tickets for
// everything else, so it deliberately has no search, filters or pagination.

interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  status: string;
  updatedAt: string;
  resolvedAt?: string;
  href: string;
}

interface RequesterDashboardData {
  metrics: { openTickets: Metric; waitingForRequester: Metric; resolved: Metric; closed: Metric };
  recentlyUpdated: TicketRow[];
  recentlyResolved: TicketRow[];
}

function Rows({ rows, emptyText, timeKey }: { rows: TicketRow[]; emptyText: React.ReactNode; timeKey: 'updatedAt' | 'resolvedAt' }) {
  if (rows.length === 0) return <p className="text-muted small mb-0">{emptyText}</p>;
  return (
    <ul className="list-unstyled mb-0">
      {rows.map((t) => (
        <li key={t.id} className="border-top py-2">
          <Link to={t.href} className="d-flex flex-wrap align-items-center gap-2 text-decoration-none text-dark">
            <span className="font-monospace small fw-bold">{t.ticketNumber}</span>
            <span className="text-truncate flex-grow-1" style={{ minWidth: 0 }} title={t.summary}>
              {t.summary}
            </span>
            <TicketStatusBadge status={t.status} />
            <span className="text-muted small">{formatWhen(t[timeKey] ?? t.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const RequesterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/dashboard/requester', { signal });
      if (res.status === 403) {
        setForbidden(true);
        setError('This dashboard is only for Requesters.');
        return;
      }
      if (!res.ok) throw new Error('load failed');
      setData(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('The dashboard could not be loaded. Your tickets are not affected.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div data-testid="requester-dashboard">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h4 fw-bold text-dark mb-0">Welcome back{user ? `, ${user.name}` : ''}!</h1>
          <p className="text-muted small mb-0">Here's the latest on your requests.</p>
        </div>
        <button type="button" className="btn btn-sm btn-zen-outline" onClick={() => load()} disabled={isLoading}>
          ⟳ Refresh
        </button>
      </div>

      {isLoading && !data && <DashboardSkeleton label="Loading your dashboard…" />}
      {error && <DashboardError message={error} onRetry={() => load()} forbidden={forbidden} />}

      {data && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3">
              <MetricCard label="My Open Tickets" metric={data.metrics.openTickets} emptyHint="No open tickets" testId="card-open" />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard
                label="Waiting for You"
                metric={data.metrics.waitingForRequester}
                emptyHint="Nothing waiting for you"
                attention="Needs your reply"
                testId="card-waiting"
              />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard label="Resolved" metric={data.metrics.resolved} emptyHint="Nothing resolved yet" testId="card-resolved" />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard label="Closed" metric={data.metrics.closed} emptyHint="No closed tickets" testId="card-closed" />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <ListCard title="Recently Updated" headingId="rd-updated" viewAll={{ to: '/tickets', label: 'View all' }}>
                <Rows
                  rows={data.recentlyUpdated}
                  timeKey="updatedAt"
                  emptyText={
                    <>
                      Nothing here yet. <Link to="/tickets/new">Create a ticket</Link>
                    </>
                  }
                />
              </ListCard>
              <ListCard title="Recently Resolved" headingId="rd-resolved">
                <Rows rows={data.recentlyResolved} timeKey="resolvedAt" emptyText="Nothing here yet." />
              </ListCard>
            </div>
            <div className="col-lg-4">
              <ListCard title="Quick Actions" headingId="rd-quick">
                <div className="d-grid gap-2">
                  <Link className="btn btn-zen-primary" to="/tickets/new">
                    ➕ Create Ticket
                    <span className="d-block small fw-normal">Submit a new request</span>
                  </Link>
                  <Link className="btn btn-zen-outline" to="/tickets">
                    📋 View My Tickets
                    <span className="d-block small fw-normal">Track existing requests</span>
                  </Link>
                </div>
              </ListCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
