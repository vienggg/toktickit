import React, { useState, useEffect, useCallback } from "react";
import { useDevRequester } from "../context/DevRequesterContext";
import { Ticket, Category, RelatedSystem, Priority } from "../types";

interface MyTicketsProps {
  onSelectTicket?: (ticketId: number) => void;
  onCreateNewTicket?: () => void;
}

export const MyTickets: React.FC<MyTicketsProps> = ({ onSelectTicket, onCreateNewTicket }) => {
  const { selectedRequester } = useDevRequester();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  // Filter & Search State
  const [search, setSearch] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");

  // Sort & Pagination State
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(5);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load Categories & Systems for filter dropdowns
  useEffect(() => {
    async function loadFiltersData() {
      try {
        const [catRes, sysRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/systems")
        ]);
        if (catRes.ok && sysRes.ok) {
          setCategories(await catRes.json());
          setSystems(await sysRes.json());
        }
      } catch {
        // Handled silently
      }
    }
    loadFiltersData();
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!selectedRequester) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        requesterId: String(selectedRequester.id),
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder
      });

      if (search.trim()) params.append("search", search.trim());
      if (categoryId !== "ALL") params.append("categoryId", categoryId);
      if (relatedSystemId !== "ALL") params.append("relatedSystemId", relatedSystemId);
      if (priority !== "ALL") params.append("priority", priority);
      if (status !== "ALL") params.append("status", status);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tickets (Status ${res.status})`);
      }
      const json = await res.json();
      setTickets(json.data || []);
      setTotalCount(json.pagination?.totalCount || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to connect to ticket service.");
    } finally {
      setLoading(false);
    }
  }, [selectedRequester, search, categoryId, relatedSystemId, priority, status, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleClearFilters = () => {
    setSearch("");
    setCategoryId("ALL");
    setRelatedSystemId("ALL");
    setPriority("ALL");
    setStatus("ALL");
    setPage(1);
  };

  const hasActiveFilters = search.trim() !== "" || categoryId !== "ALL" || relatedSystemId !== "ALL" || priority !== "ALL" || status !== "ALL";

  return (
    <div className="my-tickets-container" data-testid="my-tickets-container">
      {/* Search & Filter Bar */}
      <div className="filter-bar-card" data-testid="filter-bar">
        <div className="filter-grid">
          {/* Search Input */}
          <div className="filter-group search-group">
            <label htmlFor="search-tickets" className="filter-label">Search</label>
            <input
              id="search-tickets"
              data-testid="search-input"
              type="text"
              className="form-control"
              placeholder="Search by summary, description, ticket #"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <label htmlFor="category-filter" className="filter-label">Category</label>
            <select
              id="category-filter"
              data-testid="category-filter"
              className="form-control"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="filter-group">
            <label htmlFor="priority-filter" className="filter-label">Priority</label>
            <select
              id="priority-filter"
              data-testid="priority-filter"
              className="form-control"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-group">
            <label htmlFor="status-filter" className="filter-label">Status</label>
            <select
              id="status-filter"
              data-testid="status-filter"
              className="form-control"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
            </select>
          </div>
        </div>

        <div className="filter-actions-row">
          <div className="results-count-badge">
            Showing <strong>{tickets.length}</strong> of <strong>{totalCount}</strong> tickets
          </div>
          {hasActiveFilters && (
            <button
              className="btn-zen-secondary btn-sm"
              onClick={handleClearFilters}
              data-testid="clear-filters-btn"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="loading-state card-surface" data-testid="loading-tickets">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading tickets for {selectedRequester?.name}...</p>
        </div>
      ) : error ? (
        <div className="error-state card-surface" data-testid="error-tickets">
          <p className="error-msg">⚠️ {error}</p>
          <button className="btn-zen-secondary btn-sm mt-2" onClick={fetchTickets}>
            Retry
          </button>
        </div>
      ) : tickets.length === 0 ? (
        hasActiveFilters ? (
          /* No-Results Filter State */
          <div className="empty-state-card" data-testid="no-results-state">
            <div className="empty-icon" aria-hidden="true">🔍</div>
            <h3>No Matching Tickets Found</h3>
            <p className="empty-subtitle">
              No tickets match your active filter criteria. Try modifying your search or clearing filters.
            </p>
            <button className="btn-zen-secondary mt-3" onClick={handleClearFilters} data-testid="no-results-clear-btn">
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Empty State (0 Tickets) */
          <div className="empty-state-card" data-testid="empty-tickets-state">
            <div className="empty-icon" aria-hidden="true">📋</div>
            <h3>No Tickets Created Yet</h3>
            <p className="empty-subtitle">
              You have not submitted any IT support requests under this account.
            </p>
            {onCreateNewTicket && (
              <button className="btn-zen-primary mt-3" onClick={onCreateNewTicket} data-testid="empty-create-ticket-btn">
                Create Your First Ticket
              </button>
            )}
          </div>
        )
      ) : (
        /* Ticket Data Table (Desktop) & Card List (Mobile) */
        <div className="table-responsive-wrapper card-surface" data-testid="tickets-table-wrapper">
          <table className="zen-table" data-testid="tickets-table">
            <thead>
              <tr>
                <th
                  className="sortable-th"
                  onClick={() => {
                    if (sortBy === "ticketNumber") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    else { setSortBy("ticketNumber"); setSortOrder("desc"); }
                  }}
                  data-testid="sort-ticket-number"
                >
                  Ticket Number {sortBy === "ticketNumber" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="sortable-th"
                  onClick={() => {
                    if (sortBy === "createdAt") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    else { setSortBy("createdAt"); setSortOrder("desc"); }
                  }}
                  data-testid="sort-date"
                >
                  Date Created {sortBy === "createdAt" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th>Summary</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Files</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="ticket-row"
                  data-testid={`ticket-row-${t.id}`}
                  onClick={() => onSelectTicket && onSelectTicket(t.id)}
                >
                  <td className="ticket-no-cell">
                    <strong>{t.ticketNumber}</strong>
                  </td>
                  <td className="date-cell">
                    {new Date(t.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="summary-cell">
                    <span className="summary-text" title={t.summary}>{t.summary}</span>
                  </td>
                  <td>
                    <span className="category-tag">{t.category?.name || "-"}</span>
                  </td>
                  <td>
                    <span className={`priority-pill ${t.requestedPriority.toLowerCase()}`}>
                      {t.requestedPriority}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge new">{t.currentStatus}</span>
                  </td>
                  <td className="attachments-count-cell">
                    {t._count?.attachments ? (
                      <span className="attachment-badge">📎 {t._count.attachments}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-view-ticket"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicket) onSelectTicket(t.id);
                      }}
                      data-testid={`view-ticket-${t.id}`}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="pagination-bar" data-testid="pagination-bar">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="prev-page-btn"
            >
              &laquo; Previous
            </button>
            <span className="page-indicator" data-testid="page-indicator">
              Page {page} of {totalPages}
            </span>
            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="next-page-btn"
            >
              Next &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
