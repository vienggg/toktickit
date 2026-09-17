import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, parseApiError } from '../api';

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
  requesterEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CategoryOption {
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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export const StaffTicketQueue: React.FC<{ onOpenTicket?: (id: number) => void }> = ({ onOpenTicket }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<StaffQueueTicket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [itPriority, setItPriority] = useState('All');
  const [categoryId, setCategoryId] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All'); // 'All' | 'unassigned' | userId
  const [sort, setSort] = useState('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCategories() {
      try {
        const res = await apiFetch('/api/categories', { signal: controller.signal });
        if (res.ok) setCategories(await res.json());
      } catch {
        // Non-fatal — category filter simply stays empty.
      }
    }
    loadCategories();
    return () => controller.abort();
  }, []);

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || status !== 'All' || itPriority !== 'All' || categoryId !== 'All' || ownerFilter !== 'All';

  const fetchTickets = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
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
        setTickets(data.data || []);
        setPagination(data.pagination || DEFAULT_PAGINATION);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Unable to load the ticket queue right now.');
          setTickets([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [page, sort, order, debouncedSearch, status, itPriority, categoryId, ownerFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTickets(controller.signal);
    return () => controller.abort();
  }, [fetchTickets]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
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

  const handleOpen = (id: number) => {
    if (onOpenTicket) onOpenTicket(id);
    else navigate(`/staff/tickets/${id}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isEmptyQueue = !isLoading && !error && tickets.length === 0 && !hasActiveFilters && pagination.total === 0;
  const isNoResults = !isLoading && !error && tickets.length === 0 && hasActiveFilters;

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
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleOpen(t.id)}>
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
                    <th>Ticket Number</th>
                    <th>Summary</th>
                    <th>Status</th>
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
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleOpen(t.id)}>
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
                onClick={() => handleOpen(t.id)}
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

          {/* Pagination */}
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
        </>
      )}
    </div>
  );
};
