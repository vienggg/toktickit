import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, parseApiError } from '../api';
import { useDebouncedValue, useCategoryOptions, usePaginatedFetch, formatDate } from '../hooks/usePaginatedFetch';

export interface StaffQueueTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  categoryId: number;
  category: { id: number; name: string };
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  itPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  ownerId: number | null;
  ownerName: string | null;
  requesterId: number;
  requesterName: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface StaffMember {
  id: number;
  name: string;
}

const DEFAULT_PAGINATION: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

const STATUS_OPTIONS = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_BADGE: Record<string, string> = {
  NEW: 'status-open',
  OPEN: 'status-open',
  IN_PROGRESS: 'status-progress',
  WAITING_FOR_REQUESTER: 'status-waiting',
  RESOLVED: 'status-resolved',
  CLOSED: 'status-closed',
  REOPENED: 'status-reopened',
  CANCELLED: 'status-cancelled',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'status-closed';
  return (
    <span className={`badge zen-badge-${cls}`} data-testid="status-badge">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  const variant =
    priority === 'URGENT' ? 'bg-danger' : priority === 'HIGH' ? 'bg-warning text-dark' : priority === 'MEDIUM' ? 'bg-info text-dark' : 'bg-secondary';
  return (
    <span className={`badge ${variant}`} title={label} data-testid="priority-badge">
      {priority}
    </span>
  );
}

function OwnerPill({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="badge" style={{ backgroundColor: 'var(--color-border-subtle, #E2E8F0)', color: '#475569' }}>
        Unassigned
      </span>
    );
  }
  return <span>{name}</span>;
}

// The read-only TicketDetailModal built as I-6's stopgap ("Open" action)
// was removed here once I-7 (Issue #56) shipped the real, editable Staff
// Ticket Detail screen at /staff/tickets/:id — see handleOpen below. The
// modal is no longer reachable from this screen's default behavior; a
// caller that still wants a custom, non-navigating "Open" action can pass
// onOpenTicket and render its own UI from the ticket id it receives.

interface QueuePage {
  tickets: StaffQueueTicket[];
  pagination: PaginationMeta;
}

export const StaffTicketQueue: React.FC<{ onOpenTicket?: (id: number) => void }> = ({ onOpenTicket }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const categories = useCategoryOptions();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();
    async function loadStaffMembers() {
      try {
        const res = await apiFetch('/api/staff/members', { signal: controller.signal });
        if (res.ok) setStaffMembers(await res.json());
      } catch {
        // Non-fatal — the Owner picker simply stays limited to All/Unassigned.
      }
    }
    loadStaffMembers();
    return () => controller.abort();
  }, []);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('All');
  const [itPriority, setItPriority] = useState('All');
  const [categoryId, setCategoryId] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All'); // 'All' | 'unassigned' | userId
  const [sort, setSort] = useState('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || status !== 'All' || itPriority !== 'All' || categoryId !== 'All' || ownerFilter !== 'All';

  const fetchQueuePage = useCallback(
    async (signal: AbortSignal): Promise<QueuePage> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        order,
      });
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (status !== 'All') params.append('status', status);
      if (itPriority !== 'All') params.append('itPriority', itPriority);
      if (categoryId !== 'All') params.append('categoryId', categoryId);
      if (ownerFilter !== 'All') params.append('ownerId', ownerFilter);

      const res = await apiFetch(`/api/staff/tickets?${params.toString()}`, { signal });
      if (!res.ok) {
        const message = await parseApiError(res, 'Unable to load the ticket queue right now.');
        throw new Error(message);
      }
      const data = await res.json();
      return { tickets: data.data || [], pagination: data.pagination || DEFAULT_PAGINATION };
    },
    [page, sort, order, debouncedSearch, status, itPriority, categoryId, ownerFilter]
  );

  const {
    data: { tickets, pagination },
    isLoading,
    error,
  } = usePaginatedFetch<QueuePage>(fetchQueuePage, { tickets: [], pagination: DEFAULT_PAGINATION });

  // Item 5 fix (review of PR #67): previously, if a stale `page` state
  // pointed past the data that now exists underneath it (e.g. ownership
  // churn dropped the current page's row count to zero between requests),
  // none of the empty/no-results/results blocks rendered and Prev/Next
  // only existed inside the results block — leaving a blank screen with
  // no way back except a full reload. Auto-clamp back to the last valid
  // page as soon as we learn it's out of range.
  React.useEffect(() => {
    if (!isLoading && !error && pagination.total > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [isLoading, error, pagination.total, pagination.totalPages, page]);

  const handleClearFilters = () => {
    setSearch('');
    setStatus('All');
    setItPriority('All');
    setCategoryId('All');
    setOwnerFilter('All');
    setPage(1);
  };

  const handleSortClick = (field: string) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  };

  // I-7 (Issue #56) now provides the real, editable Staff Ticket Detail
  // screen at /staff/tickets/:id, so "Open" navigates there by default
  // instead of the read-only modal that was I-6's stopgap (kept above,
  // still available, but no longer the default action). `onOpenTicket`
  // remains available as an optional override for a caller that wants
  // custom behavior instead of navigation.
  const handleOpen = (ticket: StaffQueueTicket) => {
    if (onOpenTicket) onOpenTicket(ticket.id);
    else navigate(`/staff/tickets/${ticket.id}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isEmptyQueue = !isLoading && !error && tickets.length === 0 && !hasActiveFilters && pagination.total === 0;
  const isNoResults = !isLoading && !error && tickets.length === 0 && hasActiveFilters;
  // Covers the item-5 stale-page case: filters are inactive, there ARE
  // rows on the server (pagination.total > 0), but this page's slice
  // came back empty — the auto-clamp effect above will move `page` back
  // into range; in the meantime, avoid rendering nothing at all.
  const isStaleEmptyPage = !isLoading && !error && tickets.length === 0 && !hasActiveFilters && pagination.total > 0;

  const showPagination = !isLoading && !error && pagination.total > 0;

  return (
    <div className="container-fluid py-3 px-3 px-lg-4" style={{ backgroundColor: 'var(--zen-neutral-light, #F5F7F6)', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0 fw-bold">🎫 IT Staff Ticket Queue</h4>
          <small className="text-muted">Signed in as {user?.name}</small>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label htmlFor="queue-search" className="form-label small fw-bold text-muted mb-1">
                SEARCH
              </label>
              <input
                id="queue-search"
                type="text"
                className="form-control"
                placeholder="Search ticket #, summary, description, requester..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="queue-status" className="form-label small fw-bold text-muted mb-1">
                STATUS
              </label>
              <select
                id="queue-status"
                className="form-select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="queue-priority" className="form-label small fw-bold text-muted mb-1">
                IT PRIORITY
              </label>
              <select
                id="queue-priority"
                className="form-select"
                value={itPriority}
                onChange={(e) => {
                  setItPriority(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="queue-category" className="form-label small fw-bold text-muted mb-1">
                CATEGORY
              </label>
              <select
                id="queue-category"
                className="form-select"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="queue-owner" className="form-label small fw-bold text-muted mb-1">
                OWNER
              </label>
              <select
                id="queue-owner"
                className="form-select"
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All</option>
                <option value="unassigned">Unassigned</option>
                {staffMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleClearFilters}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="placeholder-glow mb-2" data-testid="skeleton-row">
                <span className="placeholder col-12" style={{ height: '2rem', display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmptyQueue && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <p className="text-muted mb-0">No tickets in the queue yet.</p>
          </div>
        </div>
      )}

      {isNoResults && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <p className="text-muted mb-3">No tickets match your filters.</p>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearFilters}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {isStaleEmptyPage && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <p className="text-muted mb-0">This page no longer has any tickets. Returning to the last available page…</p>
          </div>
        </div>
      )}

      {!isLoading && !error && tickets.length > 0 && (
        <>
          {/* Desktop table (>=992px) */}
          <div className="d-none d-lg-block card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th role="button" onClick={() => handleSortClick('ticketNumber')}>
                      Ticket Number
                    </th>
                    <th role="button" onClick={() => handleSortClick('createdAt')}>
                      Created Date
                    </th>
                    <th>Summary</th>
                    <th>Category</th>
                    <th>Requested Priority</th>
                    <th role="button" onClick={() => handleSortClick('itPriority')}>
                      IT Priority
                    </th>
                    <th role="button" onClick={() => handleSortClick('status')}>
                      Status
                    </th>
                    <th>Owner</th>
                    <th role="button" onClick={() => handleSortClick('updatedAt')}>
                      Last Updated
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="font-monospace">{t.ticketNumber}</td>
                      <td className="small text-muted">{formatDate(t.createdAt)}</td>
                      <td className="text-truncate" style={{ maxWidth: 260 }}>
                        {t.summary}
                      </td>
                      <td>{t.category?.name}</td>
                      <td>
                        <PriorityBadge priority={t.requestedPriority} label="Requested" />
                      </td>
                      <td>
                        <PriorityBadge priority={t.itPriority} label="IT Priority" />
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>
                        <OwnerPill name={t.ownerName} />
                      </td>
                      <td className="small text-muted">{formatDate(t.updatedAt)}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleOpen(t)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tablet condensed table (768-991px) */}
          <div className="d-none d-md-block d-lg-none card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    {/* Item 6 fix (review of PR #67): the tablet table previously
                        rendered the same sortable data as the desktop table with
                        no sort control at all. Ticket Number and Status match
                        the desktop table's sortable columns and fit the
                        condensed width; the same handleSortClick handler is
                        reused so both layouts stay in sync on sort state. */}
                    <th role="button" onClick={() => handleSortClick('ticketNumber')}>
                      Ticket Number
                    </th>
                    <th>Summary</th>
                    <th role="button" onClick={() => handleSortClick('status')}>
                      Status
                    </th>
                    <th>IT Priority</th>
                    <th>Owner</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="font-monospace">{t.ticketNumber}</td>
                      <td className="text-truncate" style={{ maxWidth: 200 }}>
                        {t.summary}
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={t.itPriority} label="IT Priority" />
                      </td>
                      <td>
                        <OwnerPill name={t.ownerName} />
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleOpen(t)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards (<768px) */}
          <div className="d-md-none d-flex flex-column gap-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="card border-0 shadow-sm"
                role="button"
                onClick={() => handleOpen(t)}
                data-testid="ticket-card"
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="font-monospace fw-semibold">{t.ticketNumber}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mb-2">{t.summary}</div>
                  <div className="d-flex justify-content-between align-items-center">
                    <PriorityBadge priority={t.itPriority} label="IT Priority" />
                    <OwnerPill name={t.ownerName} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showPagination && (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mt-3">
          <div className="text-muted small">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </div>
          <nav aria-label="Staff queue pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(page - 1)} disabled={pagination.page <= 1}>
                  « Prev
                </button>
              </li>
              <li className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => setPage(page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next »
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

    </div>
  );
};
