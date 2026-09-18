import React, { useState } from 'react';
import { apiFetch, parseApiError } from '../api';

// Extracted in review of PR #68 (item 5): this panel was copy-pasted
// verbatim from TicketDetail.tsx (Requester) into StaffTicketDetail.tsx
// (I-7), each with its own ROLE_LABEL map, fetch call, and validation —
// and the two had already drifted: the staff copy always rendered the
// author's role badge, while the Requester copy suppresses it for
// REQUESTER authors (a Requester never needs to be told they're a
// Requester). This shared component preserves that exact
// suppress-for-REQUESTER behavior; the only thing that differs between
// the two screens is the ticket id, so that's the only required prop.

export interface PublicCommentData {
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

export interface PublicCommentsPanelProps {
  ticketId: number;
  comments: PublicCommentData[];
  onCommentPosted: (comment: PublicCommentData) => void;
  /** Placeholder text for the add-comment textarea; each screen phrases this slightly differently. */
  placeholder?: string;
}

export const PublicCommentsPanel: React.FC<PublicCommentsPanelProps> = ({
  ticketId,
  comments,
  onCommentPosted,
  placeholder = 'Share an update or ask a question...',
}) => {
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

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
      const created: PublicCommentData = await res.json();
      onCommentPosted(created);
      setNewComment('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
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
                  {/* A Requester author's own role badge is suppressed — a
                      Requester never needs to be told they're a Requester.
                      Staff/Admin authors always show their role badge. */}
                  {c.authorRole !== 'REQUESTER' && (
                    <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                      {ROLE_LABEL[c.authorRole] ?? c.authorRole}
                    </span>
                  )}
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
          placeholder={placeholder}
        />
        <div className="d-flex justify-content-end">
          <button type="submit" className="btn btn-zen-primary btn-sm px-3" disabled={isPostingComment || !newComment.trim()}>
            {isPostingComment ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  );
};
