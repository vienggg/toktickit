import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { ActionStatusBadge, type ActionStatus } from './ActionsTaken';
import { DashboardError, DashboardSkeleton, ListCard, MetricCard, formatWhen, type Metric } from './DashboardParts';
import { TicketStatusBadge } from './TicketStatusBadge';

// Lab 4 (I-5): IT Staff / Administrator dashboard. Spec: ui-spec §5, api-spec §3.
// Every number comes from the backend; this component only lays it out and links it.

interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  status: string;
  updatedAt: string;
  href: string;
  itPriority?: string;
  requesterSignalledResolved?: boolean;
}

interface StaffDashboardData {
  metrics: {
    unassigned: Metric;
    myOwnedTickets: Metric;
    myOpenActions: Metric;
    pendingFollowUps: Metric;
    waitingForRequester: Metric;
  };
  byStatus: Array<{ status: string; count: number; href: string }>;
  byItPriority: Array<{ priority: string; count: number; href: string }>;
  attention: TicketRow[];
  myOpenActionsList: Array<{ actionId: number; ticketNumber: string; description: string; status: ActionStatus; actionAt: string; href: string }>;
  recentlyUpdated: TicketRow[];
  userCounts?: { byRole: Record<string, number>; active: number; inactive: number; href: string };
}

const ROLE_LABELS: Record<string, string> = { REQUESTER: 'Requesters', IT_STAFF: 'IT Staff', ADMINISTRATOR: 'Administrators' };

function Chip({ to, label, count }: { to: string; label: string; count: number }) {
  return (
    <Link
      to={to}
      className={`btn btn-sm border ${count === 0 ? 'text-muted bg-light' : 'bg-white text-dark fw-semibold'}`}
      aria-label={`${label}: ${count}`}
    >
      {label} <span className="badge bg-secondary ms-1">{count}</span>
    </Link>
  );
}

function TicketList({ rows, emptyText }: { rows: TicketRow[]; emptyText: string }) {
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
            {t.itPriority && <span className="badge bg-dark">{t.itPriority}</span>}
            {t.requesterSignalledResolved && <span className="badge zen-chip-followup">Requester says resolved</span>}
            <TicketStatusBadge status={t.status} />
            <span className="text-muted small">{formatWhen(t.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const myActionsRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/dashboard/staff', { signal });
      if (res.status === 403) {
        setForbidden(true);
        setError('You do not have access to this dashboard.');
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

  // "My Open Actions" is an on-page list, so its card scrolls to it and moves focus there.
  const focusMyActions = () => {
    const el = document.getElementById('my-actions') ?? myActionsRef.current;
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus();
  };

  return (
    <div data-testid="staff-dashboard">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h4 fw-bold text-dark mb-0">Welcome back{user ? `, ${user.name}` : ''}!</h1>
          <p className="text-muted small mb-0">Here's what's happening with your queue today.</p>
        </div>
        <button type="button" className="btn btn-sm btn-zen-outline" onClick={() => load()} disabled={isLoading}>
          ⟳ Refresh
        </button>
      </div>

      {isLoading && !data && <DashboardSkeleton label="Loading the dashboard…" />}
      {error && <DashboardError message={error} onRetry={() => load()} forbidden={forbidden} />}

      {data && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-4 col-xl">
              <MetricCard label="Unassigned" metric={data.metrics.unassigned} emptyHint="Every active ticket has an owner" testId="card-unassigned" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <MetricCard label="My Owned Tickets" metric={data.metrics.myOwnedTickets} emptyHint="You own no active tickets" testId="card-owned" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <MetricCard
                label="My Open Actions"
                metric={data.metrics.myOpenActions}
                emptyHint="No open actions assigned to you"
                testId="card-actions"
                onAnchorClick={focusMyActions}
              />
            </div>
            <div className="col-6 col-md-6 col-xl">
              <MetricCard label="Pending Follow-ups" metric={data.metrics.pendingFollowUps} emptyHint="No follow-ups pending" testId="card-followups" />
            </div>
            <div className="col-6 col-md-6 col-xl">
              <MetricCard label="Waiting for Requester" metric={data.metrics.waitingForRequester} emptyHint="No tickets waiting" testId="card-waiting" />
            </div>
          </div>

          <div className="p-3 rounded border bg-white mb-3">
            <h2 className="h6 fw-bold text-dark">By Status</h2>
            <div className="d-flex flex-wrap gap-2 mb-3" data-testid="by-status">
              {data.byStatus.map((s) => (
                <Chip key={s.status} to={s.href} label={s.status.replace(/_/g, ' ')} count={s.count} />
              ))}
            </div>
            <h2 className="h6 fw-bold text-dark">Active tickets by IT Priority</h2>
            <div className="d-flex flex-wrap gap-2" data-testid="by-priority">
              {data.byItPriority.map((p) => (
                <Chip key={p.priority} to={p.href} label={p.priority} count={p.count} />
              ))}
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <ListCard title="Needs Attention" headingId="sd-attention">
                <TicketList rows={data.attention} emptyText="Nothing needs attention right now." />
              </ListCard>
              <ListCard title="Recently Updated" headingId="sd-updated" viewAll={{ to: '/staff/queue', label: 'Open the queue' }}>
                <TicketList rows={data.recentlyUpdated} emptyText="No tickets yet." />
              </ListCard>
            </div>
            <div className="col-lg-5">
              <section
                id="my-actions"
                ref={myActionsRef}
                tabIndex={-1}
                aria-labelledby="sd-my-actions"
                className="p-3 rounded border bg-white mb-3"
                data-testid="my-actions"
              >
                <h2 className="h6 fw-bold text-dark" id="sd-my-actions">
                  My Open Actions
                </h2>
                {data.myOpenActionsList.length === 0 ? (
                  <p className="text-muted small mb-0">No open actions assigned to you.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {data.myOpenActionsList.map((a) => (
                      <li key={a.actionId} className="border-top py-2">
                        <Link to={a.href} className="text-decoration-none text-dark d-block">
                          <span className="d-flex flex-wrap align-items-center gap-2">
                            <span className="font-monospace small fw-bold">{a.ticketNumber}</span>
                            <ActionStatusBadge status={a.status} />
                            <span className="text-muted small ms-auto">{formatWhen(a.actionAt)}</span>
                          </span>
                          <span className="d-block small" style={{ overflowWrap: 'anywhere' }}>
                            {a.description}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {data.userCounts && (
                <ListCard title="Users" headingId="sd-users" viewAll={{ to: data.userCounts.href, label: 'Manage users' }}>
                  <ul className="list-unstyled small mb-0" data-testid="user-counts">
                    {Object.entries(data.userCounts.byRole).map(([role, count]) => (
                      <li key={role}>
                        {ROLE_LABELS[role] ?? role}: <strong>{count}</strong>
                      </li>
                    ))}
                    <li className="mt-1">
                      Active: <strong>{data.userCounts.active}</strong> · Inactive: <strong>{data.userCounts.inactive}</strong>
                    </li>
                  </ul>
                </ListCard>
              )}

              <ListCard title="Quick Actions" headingId="sd-quick">
                <div className="d-grid gap-2">
                  <Link className="btn btn-zen-primary" to="/staff/queue">
                    📋 Ticket Queue
                  </Link>
                  <Link className="btn btn-zen-outline" to="/staff/queue?ownerId=unassigned&status=ACTIVE">
                    🙋 Unassigned Tickets
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
