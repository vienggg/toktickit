import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

// Lab 4 (I-4): append-only Ticket status history timeline (BR-24, ui-spec §6.5).
// Staff also see the reason typed with a change; Requesters never receive it
// (the server omits it), and showReasons={false} keeps the UI consistent with that.

interface HistoryEntry {
  id: number;
  fromStatus: string;
  toStatus: string;
  changedBy: { id: number; name: string };
  createdAt: string;
  reason?: string | null;
}

const BADGE_CLASS: Record<string, string> = {
  NEW: 'open',
  OPEN: 'open',
  IN_PROGRESS: 'progress',
  WAITING_FOR_REQUESTER: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  CANCELLED: 'cancelled',
};

function label(status: string): string {
  const text = status.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Pill({ status }: { status: string }) {
  return <span className={`badge zen-badge-status-${BADGE_CLASS[status] ?? 'unknown'}`}>{label(status)}</span>;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const StatusHistory: React.FC<{ ticketId: number; showReasons: boolean; refreshKey?: number }> = ({ ticketId, showReasons, refreshKey = 0 }) => {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await apiFetch(`/api/tickets/${ticketId}/history`, { signal: controller.signal });
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
        setLoadError(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [ticketId, refreshKey]);

  return (
    <div className="mt-4 pt-4 border-top" data-testid="status-history">
      <h6 className="fw-bold text-dark mb-3">🕑 Status History</h6>
      {isLoading && (
        <div aria-busy="true" className="text-muted small">
          Loading history…
        </div>
      )}
      {!isLoading && loadError && (
        <div className="alert alert-danger small py-2" role="alert">
          Could not load the status history.
        </div>
      )}
      {!isLoading && !loadError && items.length === 0 && <p className="text-muted small mb-0">History is recorded from Lab 4 onward.</p>}
      {!isLoading && !loadError && items.length > 0 && (
        <ol className="list-unstyled d-flex flex-column gap-2 mb-0" aria-label="Status history">
          {items.map((h) => (
            <li key={h.id} className="p-2 rounded border bg-white">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="text-muted small">{formatDateTime(h.createdAt)}</span>
                <Pill status={h.fromStatus} />
                <span aria-label="changed to">→</span>
                <Pill status={h.toStatus} />
                <span className="small ms-auto">{h.changedBy.name}</span>
              </div>
              {showReasons && h.reason && <div className="small mt-1" style={{ overflowWrap: 'anywhere' }}>{h.reason}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
