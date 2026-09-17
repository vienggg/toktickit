import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, parseApiError } from '../api';
import { useAuth } from '../context/AuthContext';

interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isRemoved: boolean;
  removedReason?: string | null;
  removedAt?: string | null;
  uploadedAt: string;
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Status =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

interface StaffTicketDetailData {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  categoryId: number;
  category: { id: number; name: string };
  relatedSystemId: number | null;
  relatedSystem: { id: number; name: string } | null;
  requestedPriority: Priority;
  itPriority: Priority;
  status: Status;
  // Server-computed (BR-19, §6.5) — the Status control reads this directly
  // instead of keeping its own copy of the transition matrix, the same
  // "server computes, client reads" pattern PR #66 established for
  // canSignalResolution on the Requester's TicketDetail screen.
  permittedStatusTransitions: Status[];
  ownerId: number | null;
  owner: { id: number; name: string } | null;
  requesterId: number;
  requester: { id: number; name: string; email: string; department: string };
  attachments: Attachment[];
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffMember {
  id: number;
  name: string;
}

interface CommentOrNote {
  id: number;
  ticketId: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
};

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function PriorityBadge({ priority }: { priority: string }) {
  const variant =
    priority === 'URGENT' ? 'bg-danger' : priority === 'HIGH' ? 'bg-warning text-dark' : priority === 'MEDIUM' ? 'bg-info text-dark' : 'bg-secondary';
  return (
    <span className={`badge ${variant}`} data-testid="priority-badge">
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="badge bg-primary" data-testid="status-badge">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export const StaffTicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ticketId = id ? parseInt(id, 10) : NaN;

  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ownership & Priority panel state
  const [ownerSelection, setOwnerSelection] = useState<string>('');
  const [isSavingOwner, setIsSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerSuccess, setOwnerSuccess] = useState<string | null>(null);

  const [itPrioritySelection, setItPrioritySelection] = useState<Priority>('MEDIUM');
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [prioritySuccess, setPrioritySuccess] = useState<string | null>(null);

  // Status control state
  const [statusSelection, setStatusSelection] = useState<string>('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  // Public Comments state
  const [comments, setComments] = useState<CommentOrNote[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Internal Notes state
  const [notes, setNotes] = useState<CommentOrNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchTicket = useCallback(
    async (signal?: AbortSignal) => {
      const res = await apiFetch(`/api/staff/tickets/${ticketId}`, { signal });
      if (!res.ok) {
        throw new Error(await parseApiError(res, `Ticket not found or error loading (HTTP ${res.status})`));
      }
      const data: StaffTicketDetailData = await res.json();
      setTicket(data);
      setOwnerSelection(data.ownerId ? String(data.ownerId) : '');
      setItPrioritySelection(data.itPriority);
      setStatusSelection('');
      return data;
    },
    [ticketId]
  );

  useEffect(() => {
    if (!Number.isFinite(ticketId)) {
      setLoadError('Invalid ticket ID.');
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await fetchTicket(controller.signal);

        const [membersRes, commentsRes, notesRes] = await Promise.all([
          apiFetch('/api/staff/members', { signal: controller.signal }),
          apiFetch(`/api/tickets/${ticketId}/comments`, { signal: controller.signal }),
          apiFetch(`/api/tickets/${ticketId}/internal-notes`, { signal: controller.signal }),
        ]);
        if (membersRes.ok) setStaffMembers(await membersRes.json());
        if (commentsRes.ok) setComments(await commentsRes.json());
        if (notesRes.ok) setNotes(await notesRes.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setLoadError(err.message || 'Failed to load ticket details.');
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [ticketId, fetchTicket]);

  // "Claim" sets the owner to the acting IT Staff/Administrator's own id
  // (BR-14). The acting user's id comes from AuthContext (the same
  // session the server itself trusts), not from the staff members list —
  // that list is only used to populate the reassign dropdown.
  const handleClaim = async () => {
    if (!user) return;
    await submitOwner(String(user.id));
  };

  const submitOwner = async (ownerIdValue: string) => {
    setOwnerError(null);
    setOwnerSuccess(null);
    setIsSavingOwner(true);
    try {
      const payload = { ownerId: ownerIdValue === '' ? null : parseInt(ownerIdValue, 10) };
      const res = await apiFetch(`/api/staff/tickets/${ticketId}/owner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Failed to update ticket owner.'));
      }
      const updated: StaffTicketDetailData = await res.json();
      setTicket(updated);
      setOwnerSelection(updated.ownerId ? String(updated.ownerId) : '');
      setOwnerSuccess('Owner updated.');
      setTimeout(() => setOwnerSuccess(null), 3000);
    } catch (err) {
      setOwnerError(err instanceof Error ? err.message : 'Failed to update ticket owner.');
    } finally {
      setIsSavingOwner(false);
    }
  };

  const handleReassignChange = (value: string) => {
    setOwnerSelection(value);
    submitOwner(value);
  };

  const handleSavePriority = async () => {
    setPriorityError(null);
    setPrioritySuccess(null);
    setIsSavingPriority(true);
    try {
      const res = await apiFetch(`/api/staff/tickets/${ticketId}/it-priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itPriority: itPrioritySelection }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Failed to update IT priority.'));
      }
      const updated: StaffTicketDetailData = await res.json();
      setTicket(updated);
      setPrioritySuccess('IT Priority updated.');
      setTimeout(() => setPrioritySuccess(null), 3000);
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Failed to update IT priority.');
    } finally {
      setIsSavingPriority(false);
    }
  };

  const handleApplyStatus = async () => {
    if (!statusSelection) return;
    setStatusError(null);
    setStatusSuccess(null);
    setIsSavingStatus(true);
    try {
      const res = await apiFetch(`/api/staff/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusSelection }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Failed to update ticket status.'));
      }
      const updated: StaffTicketDetailData = await res.json();
      setTicket(updated);
      setStatusSelection('');
      setStatusSuccess('Status updated.');
      setTimeout(() => setStatusSuccess(null), 3000);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update ticket status.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    const trimmed = newComment.trim();
    if (!trimmed) {
      setCommentError('Comment cannot be empty.');
      return;
    }
    if (trimmed.length > 2000) {
      setCommentError('Comment cannot exceed 2000 characters.');
      return;
    }
    setIsPostingComment(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Failed to post comment.'));
      }
      const created: CommentOrNote = await res.json();
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    const trimmed = newNote.trim();
    if (!trimmed) {
      setNoteError('Note cannot be empty.');
      return;
    }
    if (trimmed.length > 2000) {
      setNoteError('Note cannot exceed 2000 characters.');
      return;
    }
    setIsPostingNote(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/internal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Failed to post internal note.'));
      }
      const created: CommentOrNote = await res.json();
      setNotes((prev) => [...prev, created]);
      setNewNote('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to post internal note.');
    } finally {
      setIsPostingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 900 }}>
        <div className="spinner-border text-zen-primary" role="status">
          <span className="visually-hidden">Loading ticket...</span>
        </div>
        <p className="text-muted small mt-2">Loading ticket details...</p>
      </div>
    );
  }

  if (loadError || !ticket) {
    return (
      <div className="container py-4" style={{ maxWidth: 900 }}>
        <div className="alert alert-danger mb-3" role="alert">
          <strong>Error:</strong> {loadError || 'Ticket not found'}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/staff/queue')}>
          ← Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="container py-3" style={{ maxWidth: 960 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/staff/queue')}>
          ← Back to Queue
        </button>
      </div>

      <div className="card border-0 shadow-sm bg-white mb-4" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
        <div
          className="card-header border-0 px-4 py-3 text-white d-flex justify-content-between align-items-center"
          style={{ backgroundColor: 'var(--zen-primary)' }}
        >
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fs-5 font-monospace fw-bold">{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.requestedPriority} />
            </div>
            <small className="opacity-75">
              Created {formatDate(ticket.createdAt)} • Last updated {formatDate(ticket.updatedAt)}
            </small>
          </div>
        </div>

        <div className="card-body p-4">
          {/* Read-only Ticket information */}
          <div className="mb-4 p-3 rounded border bg-light">
            <label className="form-label text-muted small fw-bold mb-1">REQUESTER</label>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fw-semibold text-dark">{ticket.requester.name}</span>
              <span className="badge bg-secondary">{ticket.requester.department}</span>
              <span className="text-muted small ms-auto font-monospace">{ticket.requester.email}</span>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="p-3 rounded border border-light-subtle bg-light">
                <small className="text-muted d-block fw-bold mb-1">CATEGORY</small>
                <span className="fw-semibold text-dark">{ticket.category?.name}</span>
              </div>
            </div>
            <div className="col-md-6">
              <div className="p-3 rounded border border-light-subtle bg-light">
                <small className="text-muted d-block fw-bold mb-1">RELATED SYSTEM</small>
                <span className="fw-semibold text-dark">{ticket.relatedSystem?.name || 'None / General IT'}</span>
              </div>
            </div>
          </div>

          <h5 className="fw-bold text-dark mb-2">{ticket.summary}</h5>
          <div className="mb-4">
            <label className="form-label text-muted small fw-bold mb-1">DESCRIPTION</label>
            <div className="p-3 rounded border bg-light text-dark" style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
              {ticket.description}
            </div>
          </div>

          {/* Ownership & Priority panel */}
          <div className="mt-4 pt-4 border-top">
            <h6 className="fw-bold text-dark mb-3">🧑‍💻 Ownership &amp; Priority</h6>

            {ownerError && <div className="alert alert-danger small py-2 mb-3">{ownerError}</div>}
            {ownerSuccess && <div className="alert alert-success small py-2 mb-3">{ownerSuccess}</div>}

            <div className="row g-3 align-items-end mb-3">
              <div className="col-md-5">
                <label htmlFor="owner-select" className="form-label small fw-semibold text-dark">
                  Owner
                </label>
                <select
                  id="owner-select"
                  className="form-select"
                  value={ownerSelection}
                  onChange={(e) => handleReassignChange(e.target.value)}
                  disabled={isSavingOwner}
                >
                  <option value="">Unassigned</option>
                  {staffMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                {!ticket.ownerId && (
                  <button
                    type="button"
                    className="btn btn-zen-outline btn-sm"
                    onClick={handleClaim}
                    disabled={isSavingOwner}
                  >
                    {isSavingOwner ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" /> Claiming...
                      </>
                    ) : (
                      'Claim'
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label htmlFor="requested-priority" className="form-label small fw-semibold text-dark">
                  Requested Priority (read-only)
                </label>
                <div id="requested-priority">
                  <PriorityBadge priority={ticket.requestedPriority} />
                </div>
              </div>
              <div className="col-md-4">
                <label htmlFor="it-priority-select" className="form-label small fw-semibold text-dark">
                  IT Priority
                </label>
                <select
                  id="it-priority-select"
                  className="form-select"
                  value={itPrioritySelection}
                  onChange={(e) => setItPrioritySelection(e.target.value as Priority)}
                  disabled={isSavingPriority}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <button
                  type="button"
                  className="btn btn-zen-primary btn-sm"
                  onClick={handleSavePriority}
                  disabled={isSavingPriority || itPrioritySelection === ticket.itPriority}
                >
                  {isSavingPriority ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" /> Saving...
                    </>
                  ) : (
                    'Save IT Priority'
                  )}
                </button>
              </div>
            </div>
            {priorityError && <div className="alert alert-danger small py-2 mt-3 mb-0">{priorityError}</div>}
            {prioritySuccess && <div className="alert alert-success small py-2 mt-3 mb-0">{prioritySuccess}</div>}
          </div>

          {/* Status control — only the transitions permitted from the
              current status (per §6.5), computed server-side and read
              directly from ticket.permittedStatusTransitions rather than
              re-derived from an independent client-side copy of the
              matrix. */}
          <div className="mt-4 pt-4 border-top">
            <h6 className="fw-bold text-dark mb-3">🔄 Status</h6>
            {statusError && <div className="alert alert-danger small py-2 mb-3">{statusError}</div>}
            {statusSuccess && <div className="alert alert-success small py-2 mb-3">{statusSuccess}</div>}

            {ticket.permittedStatusTransitions.length === 0 ? (
              <p className="text-muted small mb-0">
                This ticket is <strong>{ticket.status.replace(/_/g, ' ')}</strong>, a terminal status with no further transitions.
              </p>
            ) : (
              <div className="d-flex flex-wrap gap-2 align-items-end">
                <div>
                  <label htmlFor="status-select" className="form-label small fw-semibold text-dark d-block">
                    Change status to
                  </label>
                  <select
                    id="status-select"
                    className="form-select"
                    value={statusSelection}
                    onChange={(e) => setStatusSelection(e.target.value)}
                    disabled={isSavingStatus}
                  >
                    <option value="">Select a status…</option>
                    {ticket.permittedStatusTransitions.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-zen-primary btn-sm"
                  onClick={handleApplyStatus}
                  disabled={isSavingStatus || !statusSelection}
                >
                  {isSavingStatus ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" /> Applying...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Attachments panel — unchanged from Lab 2, read-only here (no
              upload/remove controls on the staff screen). */}
          <div className="mt-4 pt-4 border-top">
            <h6 className="fw-bold text-dark mb-3">📎 Attachments ({ticket.attachments.length})</h6>
            {ticket.attachments.length === 0 ? (
              <p className="text-muted small mb-0">No active attachments on this ticket.</p>
            ) : (
              <div className="list-group gap-2">
                {ticket.attachments.map((att) => (
                  <div key={att.id} className="list-group-item d-flex justify-content-between align-items-center p-3 rounded border">
                    <div>
                      <span className="fw-semibold text-zen-primary">{att.fileName}</span>
                      <div className="text-muted small">
                        Size: {formatBytes(att.fileSize)} • Uploaded: {formatDate(att.uploadedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public Comments panel — identical to the Requester's, editable by staff too. */}
          <div className="mt-4 pt-4 border-top">
            <h6 className="fw-bold text-dark mb-3">💬 Public Comments</h6>
            {comments.length === 0 && <p className="text-muted small mb-3">No comments yet on this ticket.</p>}
            {comments.length > 0 && (
              <div className="d-flex flex-column gap-2 mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 rounded border" style={{ backgroundColor: 'var(--zen-neutral-light, #F5F7F6)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-dark small d-flex align-items-center gap-2">
                        {c.authorName}
                        <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                          {ROLE_LABEL[c.authorRole] ?? c.authorRole}
                        </span>
                      </span>
                      <span className="text-muted small">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="text-dark" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  </div>
                ))}
              </div>
            )}
            {commentError && <div className="alert alert-danger small py-2 mb-3">{commentError}</div>}
            <form onSubmit={handlePostComment}>
              <label htmlFor="new-comment" className="form-label small fw-semibold text-dark">
                Add a comment
              </label>
              <textarea
                id="new-comment"
                className="form-control mb-2"
                rows={2}
                maxLength={2000}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isPostingComment}
                placeholder="Share an update visible to the Requester..."
              />
              <div className="d-flex justify-content-end">
                <button type="submit" className="btn btn-zen-primary btn-sm px-3" disabled={isPostingComment || !newComment.trim()}>
                  {isPostingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          </div>

          {/* Internal Notes panel — visually distinct (BR-24, ui-spec.md
              §7): a Requester never reaches this panel at all, but the
              background/label still needs to make it unmistakable to
              IT Staff/Administrator that this content is staff-only. */}
          <div className="mt-4 pt-4 border-top">
            <div
              className="p-3 rounded border"
              style={{ backgroundColor: 'var(--color-internal-note-bg)' }}
              data-testid="internal-notes-panel"
            >
              <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                🔒 Internal Notes
                <span className="badge bg-dark" style={{ fontSize: '0.65rem' }}>
                  Internal — not visible to Requester
                </span>
              </h6>

              {notes.length === 0 && <p className="text-muted small mb-3 mt-2">No internal notes yet.</p>}
              {notes.length > 0 && (
                <div className="d-flex flex-column gap-2 mb-3 mt-2">
                  {notes.map((n) => (
                    <div key={n.id} className="p-3 rounded border bg-white">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold text-dark small">{n.authorName}</span>
                        <span className="text-muted small">{formatDate(n.createdAt)}</span>
                      </div>
                      <div className="text-dark" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
                    </div>
                  ))}
                </div>
              )}

              {noteError && <div className="alert alert-danger small py-2 mb-3">{noteError}</div>}
              <form onSubmit={handlePostNote}>
                <label htmlFor="new-note" className="form-label small fw-semibold text-dark">
                  Add an internal note
                </label>
                <textarea
                  id="new-note"
                  className="form-control mb-2"
                  rows={2}
                  maxLength={2000}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  disabled={isPostingNote}
                  placeholder="Not visible to the Requester..."
                />
                <div className="d-flex justify-content-end">
                  <button type="submit" className="btn btn-dark btn-sm px-3" disabled={isPostingNote || !newNote.trim()}>
                    {isPostingNote ? 'Posting...' : 'Post Internal Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
