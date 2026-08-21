import React, { useState, useEffect, useCallback } from 'react';
import { useDevRequester } from '../context/DevRequesterContext';

export interface TicketSummaryItem {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'New' | 'In Progress' | 'Resolved' | 'Closed';
  categoryId: number;
  category: { id: number; name: string };
  relatedSystemId?: number | null;
  relatedSystem?: { id: number; name: string } | null;
  attachments?: { id: number; fileName: string }[];
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface MyTicketsProps {
  onSelectTicket?: (ticketId: number) => void;
  onNavigateToCreate?: () => void;
}

export const MyTickets: React.FC<MyTicketsProps> = ({ onSelectTicket, onNavigateToCreate }) => {
  const { currentRequester, setIsModalOpen } = useDevRequester();

  const [tickets, setTickets] = useState<TicketSummaryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('All');
  const [categoryId, setCategoryId] = useState<string>('All');
  const [priority, setPriority] = useState<string>('All');
  const [sort, setSort] = useState<string>('createdAt:desc');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Load Categories for dropdown
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data: CategoryOption[] = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!currentRequester) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        requesterId: String(currentRequester.id),
        page: String(page),
        limit: String(limit),
        sort,
      });

      if (search.trim()) params.append('search', search.trim());
      if (status !== 'All') params.append('status', status);
      if (categoryId !== 'All') params.append('categoryId', categoryId);
      if (priority !== 'All') params.append('priority', priority);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tickets (HTTP ${res.status})`);
      }

      const data = await res.json();
      setTickets(data.tickets || []);
      setPagination(data.pagination || {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [currentRequester, page, limit, search, status, categoryId, priority, sort]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleResetFilters = () => {
    setSearch('');
    setStatus('All');
    setCategoryId('All');
    setPriority('All');
    setSort('createdAt:desc');
    setPage(1);
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Urgent':
        return <span className="badge bg-danger">🔴 Urgent</span>;
      case 'High':
        return <span className="badge bg-warning text-dark">🟠 High</span>;
      case 'Medium':
        return <span className="badge bg-info text-dark">🟡 Medium</span>;
      default:
        return <span className="badge bg-secondary">🟢 Low</span>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'New':
        return <span className="badge bg-primary">New</span>;
      case 'In Progress':
        return <span className="badge bg-warning text-dark">In Progress</span>;
      case 'Resolved':
        return <span className="badge bg-success">Resolved</span>;
      case 'Closed':
        return <span className="badge bg-dark">Closed</span>;
      default:
        return <span className="badge bg-light text-dark border">{s}</span>;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="container py-2" style={{ maxWidth: 1100 }}>
      {/* Header Banner */}
      <div className="card border-0 shadow-sm mb-4 bg-white" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
        <div
          className="card-header border-0 px-4 py-3 text-white d-flex justify-content-between align-items-center"
          style={{ backgroundColor: 'var(--zen-primary)' }}
        >
          <div>
            <h4 className="mb-0 fw-bold">📋 My Support Tickets</h4>
            <small className="opacity-75">
              Viewing tickets for <strong>{currentRequester?.name}</strong> ({currentRequester?.department})
            </small>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-light text-zen-primary fw-semibold px-3"
            onClick={onNavigateToCreate}
          >
            ➕ New Ticket
          </button>
        </div>

        {/* Filter and Search Toolbar */}
        <div className="card-body p-4 border-bottom bg-light">
          <div className="row g-3">
            {/* Search Input */}
            <div className="col-12 col-md-5">
              <label htmlFor="ticket-search" className="form-label small fw-bold text-muted mb-1">
                SEARCH
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white">🔍</span>
                <input
                  type="text"
                  id="ticket-search"
                  className="form-control"
                  placeholder="Search by summary or TKT-YYYY..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                {search && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="filter-status" className="form-label small fw-bold text-muted mb-1">
                STATUS
              </label>
              <select
                id="filter-status"
                className="form-select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All Statuses</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="filter-category" className="form-label small fw-bold text-muted mb-1">
                CATEGORY
              </label>
              <select
                id="filter-category"
                className="form-select"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="filter-priority" className="form-label small fw-bold text-muted mb-1">
                PRIORITY
              </label>
              <select
                id="filter-priority"
                className="form-select"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">🔴 Urgent</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="col-6 col-md-1 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={handleResetFilters}
                title="Reset all search and filter options"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Sort & Pagination Limit Options */}
          <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top text-muted small">
            <div className="d-flex align-items-center gap-2">
              <span>Sort:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="priority:desc">Priority (High to Low)</option>
                <option value="priority:asc">Priority (Low to High)</option>
                <option value="updatedAt:desc">Recently Updated</option>
              </select>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span>Show:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets List Area */}
        <div className="card-body p-0">
          {isLoading && (
            <div className="text-center py-5">
              <div className="spinner-border text-zen-primary" role="status">
                <span className="visually-hidden">Loading tickets...</span>
              </div>
              <p className="text-muted small mt-2">Loading your support tickets...</p>
            </div>
          )}

          {error && (
            <div className="p-4">
              <div className="alert alert-danger mb-0" role="alert">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          {!isLoading && !error && tickets.length === 0 && (
            <div className="text-center py-5 px-3">
              <div className="fs-1 mb-2">📭</div>
              <h5 className="fw-bold text-dark">No Tickets Found</h5>
              <p className="text-muted small mb-3" style={{ maxWidth: 420, margin: '0 auto' }}>
                {search || status !== 'All' || categoryId !== 'All' || priority !== 'All'
                  ? 'No tickets match your active search or filter criteria. Try clearing some filters.'
                  : 'You have not submitted any IT support tickets yet.'}
              </p>
              {(search || status !== 'All' || categoryId !== 'All' || priority !== 'All') && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {!isLoading && !error && tickets.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small">
                  <tr>
                    <th scope="col" className="ps-4">TICKET #</th>
                    <th scope="col">SUMMARY</th>
                    <th scope="col">CATEGORY</th>
                    <th scope="col">SYSTEM</th>
                    <th scope="col">PRIORITY</th>
                    <th scope="col">STATUS</th>
                    <th scope="col">CREATED</th>
                    <th scope="col" className="text-end pe-4">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      style={{ cursor: onSelectTicket ? 'pointer' : 'default' }}
                      onClick={() => onSelectTicket && onSelectTicket(t.id)}
                    >
                      <td className="ps-4 font-monospace fw-semibold text-zen-primary">
                        {t.ticketNumber}
                      </td>
                      <td>
                        <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: 300 }}>
                          {t.summary}
                        </div>
                        {t.attachments && t.attachments.length > 0 && (
                          <small className="text-muted">
                            📎 {t.attachments.length} attachment{t.attachments.length > 1 ? 's' : ''}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{t.category?.name}</span>
                      </td>
                      <td>
                        <span className="small text-muted">{t.relatedSystem?.name || '—'}</span>
                      </td>
                      <td>{getPriorityBadge(t.priority)}</td>
                      <td>{getStatusBadge(t.status)}</td>
                      <td className="small text-muted">{formatDate(t.createdAt)}</td>
                      <td className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => onSelectTicket && onSelectTicket(t.id)}
                        >
                          View Detail →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {!isLoading && !error && pagination.totalItems > 0 && (
          <div className="card-footer bg-white px-4 py-3 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
            <div className="text-muted small">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>{' '}
              ({pagination.totalItems} total tickets)
            </div>

            <nav aria-label="Ticket pagination">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${!pagination.hasPrev ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                  >
                    « Prev
                  </button>
                </li>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pNum) => (
                  <li
                    key={pNum}
                    className={`page-item ${pNum === pagination.page ? 'active' : ''}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setPage(pNum)}
                      style={
                        pNum === pagination.page
                          ? { backgroundColor: 'var(--zen-primary)', borderColor: 'var(--zen-primary)' }
                          : {}
                      }
                    >
                      {pNum}
                    </button>
                  </li>
                ))}

                <li className={`page-item ${!pagination.hasNext ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasNext}
                  >
                    Next »
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};
