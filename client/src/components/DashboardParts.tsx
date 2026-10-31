import React from 'react';
import { Link } from 'react-router-dom';

// Lab 4 (ui-spec §3): shared dashboard pieces. A metric card is one link with a label,
// a value and a "View all" cue; its accessible name carries the number, so a screen
// reader hears "Unassigned: 4. View list".

export interface Metric {
  count: number;
  href: string;
}

export const MetricCard: React.FC<{
  label: string;
  metric: Metric;
  emptyHint?: string;
  attention?: string;
  testId?: string;
  onAnchorClick?: () => void;
}> = ({ label, metric, emptyHint, attention, testId, onAnchorClick }) => {
  const isAnchor = metric.href.startsWith('#');
  const body = (
    <>
      <span className="text-uppercase small fw-bold text-muted d-block mb-1">{label}</span>
      <span className="d-block fw-bold text-dark" style={{ fontSize: '2rem', lineHeight: 1.1 }}>
        {metric.count}
      </span>
      {metric.count === 0 && emptyHint && <span className="d-block small text-muted mt-1">{emptyHint}</span>}
      {metric.count > 0 && attention && <span className="d-block small fw-semibold mt-1 zen-attention-text">{attention}</span>}
      <span className="d-block small text-zen-primary fw-semibold mt-2" aria-hidden="true">
        View all →
      </span>
    </>
  );
  const common = {
    className: 'd-block h-100 p-3 rounded border bg-white text-decoration-none metric-card',
    'aria-label': `${label}: ${metric.count}. View list`,
    'data-testid': testId ?? 'metric-card',
    style: { minHeight: 44 },
  } as const;
  return isAnchor ? (
    <a
      {...common}
      href={metric.href}
      onClick={(e) => {
        if (onAnchorClick) {
          e.preventDefault();
          onAnchorClick();
        }
      }}
    >
      {body}
    </a>
  ) : (
    <Link {...common} to={metric.href}>
      {body}
    </Link>
  );
};

export function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const DashboardSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div aria-busy="true" className="py-4 text-center" data-testid="dashboard-loading">
    <div className="spinner-border text-zen-primary" role="status">
      <span className="visually-hidden">{label}</span>
    </div>
    <p className="text-muted small mt-2 mb-0">{label}</p>
  </div>
);

export const DashboardError: React.FC<{ message: string; onRetry: () => void; forbidden?: boolean }> = ({ message, onRetry, forbidden }) => (
  <div className="alert alert-danger" role="alert" data-testid="dashboard-error">
    <strong>{forbidden ? 'No access.' : 'Something went wrong.'}</strong> {message}{' '}
    {forbidden ? (
      <Link to="/">Back to your home page</Link>
    ) : (
      <button type="button" className="btn btn-sm btn-outline-danger ms-1" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const ListCard: React.FC<{ title: string; viewAll?: { to: string; label: string }; children: React.ReactNode; id?: string; headingId?: string }> = ({
  title,
  viewAll,
  children,
  id,
  headingId,
}) => (
  <section className="p-3 rounded border bg-white mb-3" id={id} aria-labelledby={headingId} tabIndex={id ? -1 : undefined}>
    <div className="d-flex justify-content-between align-items-center mb-2">
      <h2 className="h6 fw-bold text-dark mb-0" id={headingId}>
        {title}
      </h2>
      {viewAll && (
        <Link to={viewAll.to} className="small fw-semibold">
          {viewAll.label}
        </Link>
      )}
    </div>
    {children}
  </section>
);
