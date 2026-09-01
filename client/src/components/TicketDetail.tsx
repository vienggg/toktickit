import React, { useState, useEffect, useCallback } from 'react';
import { useDevRequester } from '../context/DevRequesterContext';

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

interface TicketDetailData {
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
  requesterId: number;
  requester: { id: number; name: string; email: string; department: string };
  attachments: Attachment[];
  removedAttachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface SystemOption {
  id: number;
  name: string;
}

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, onBack }) => {
  const { currentRequester } = useDevRequester();

  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // In-Place Edit Mode State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSummary, setEditSummary] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPriority, setEditPriority] = useState<string>('Medium');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editRelatedSystemId, setEditRelatedSystemId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Attachment Upload & Soft-Remove State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState<string>('');
  const [targetAttachmentToRemove, setTargetAttachmentToRemove] = useState<Attachment | null>(null);

  const fetchTicketDetail = useCallback(async (preserveDrafts = false, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { signal });
      if (!res.ok) {
        throw new Error(`Ticket not found or error loading (HTTP ${res.status})`);
      }
      const data: TicketDetailData = await res.json();
      setTicket(data);

      // Populate edit fields only if not currently preserving user draft
      if (!preserveDrafts) {
        setEditSummary(data.summary);
        setEditDescription(data.description);
        setEditPriority(data.priority);
        setEditCategoryId(String(data.categoryId));
        setEditRelatedSystemId(data.relatedSystemId ? String(data.relatedSystemId) : '');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to load ticket details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTicketDetail(false, controller.signal);

    // Load category and system lists
    async function loadRef() {
      try {
        const [catRes, sysRes] = await Promise.all([
          fetch('/api/categories', { signal: controller.signal }),
          fetch('/api/systems', { signal: controller.signal }),
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (sysRes.ok) setSystems(await sysRes.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load options:', err);
        }
      }
    }
    loadRef();
    return () => controller.abort();
  }, [fetchTicketDetail]);

  const handleStartEdit = () => {
    if (!ticket) return;
    setEditSummary(ticket.summary);
    setEditDescription(ticket.description);
    setEditPriority(ticket.priority);
    setEditCategoryId(String(ticket.categoryId));
    setEditRelatedSystemId(ticket.relatedSystemId ? String(ticket.relatedSystemId) : '');
    setEditErrors({});
    setIsEditing(true);
    setSaveSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditErrors({});
  };

  const validateEdit = (): boolean => {
    const errors: Record<string, string> = {};
    if (!editSummary.trim()) {
      errors.summary = 'Summary is required.';
    } else if (editSummary.trim().length < 3) {
      errors.summary = 'Summary must be at least 3 characters.';
    }

    if (!editDescription.trim()) {
      errors.description = 'Description is required.';
    } else if (editDescription.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.';
    }

    if (!editCategoryId) {
      errors.categoryId = 'Category is required.';
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEdit()) return;

    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const payload: Record<string, unknown> = {
        summary: editSummary.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        categoryId: parseInt(editCategoryId, 10),
        relatedSystemId: editRelatedSystemId ? parseInt(editRelatedSystemId, 10) : null,
      };

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Update failed (HTTP ${res.status})`);
      }

      const updatedData: TicketDetailData = await res.json();
      setTicket(updatedData);
      setIsEditing(false);
      setSaveSuccessMsg('Ticket updated successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Attachment upload handler
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    if ((ticket?.attachments.length || 0) + files.length > 5) {
      setUploadError('Maximum 5 attachments allowed.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('attachments', file));

      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Upload failed');
      }

      await fetchTicketDetail();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Soft-remove attachment handler
  const handleConfirmSoftRemove = async () => {
    if (!targetAttachmentToRemove) return;

    try {
      const res = await fetch(
        `/api/tickets/${ticketId}/attachments/${targetAttachmentToRemove.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: removalReason || 'Removed by user' }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to remove attachment');
      }

      setTargetAttachmentToRemove(null);
      setRemovalReason('');
      await fetchTicketDetail(isEditing);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Removal failed');
    }
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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 840 }}>
        <div className="spinner-border text-zen-primary" role="status">
          <span className="visually-hidden">Loading ticket...</span>
        </div>
        <p className="text-muted small mt-2">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container py-4" style={{ maxWidth: 840 }}>
        <div className="alert alert-danger mb-3" role="alert">
          <strong>Error:</strong> {error || 'Ticket not found'}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBack}>
          ← Back to My Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="container py-2" style={{ maxWidth: 880 }}>
      {/* Top Breadcrumb / Action Bar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
          onClick={onBack}
        >
          <span>←</span> Back to My Tickets
        </button>

        {!isEditing && (
          <button
            type="button"
            className="btn btn-zen-outline btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={handleStartEdit}
          >
            <span>✏️</span> Edit Ticket
          </button>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-3" role="alert">
          <strong>Success:</strong> {saveSuccessMsg}
        </div>
      )}

      {/* Main Ticket Card */}
      <div className="card border-0 shadow-sm bg-white mb-4" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
        {/* Ticket Header */}
        <div
          className="card-header border-0 px-4 py-3 text-white d-flex justify-content-between align-items-center"
          style={{ backgroundColor: 'var(--zen-primary)' }}
        >
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fs-5 font-monospace fw-bold">{ticket.ticketNumber}</span>
              {getStatusBadge(ticket.status)}
              {getPriorityBadge(ticket.priority)}
            </div>
            <small className="opacity-75">
              Created on {formatDate(ticket.createdAt)} • Last updated {formatDate(ticket.updatedAt)}
            </small>
          </div>
        </div>

        <div className="card-body p-4">
          {/* Requester Info Box */}
          <div className="mb-4 p-3 rounded border bg-light">
            <label className="form-label text-muted small fw-bold mb-1">REQUESTER DETAILS</label>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fs-5">👤</span>
              <span className="fw-semibold text-dark">{ticket.requester?.name}</span>
              <span className="badge bg-secondary">{ticket.requester?.department}</span>
              <span className="text-muted small ms-auto font-monospace">{ticket.requester?.email}</span>
            </div>
          </div>

          {/* VIEW MODE */}
          {!isEditing && (
            <div>
              {/* Category & System Badges */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="p-3 rounded border border-light-subtle bg-light">
                    <small className="text-muted d-block fw-bold mb-1">CATEGORY</small>
                    <span className="fw-semibold text-dark fs-6">{ticket.category?.name}</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded border border-light-subtle bg-light">
                    <small className="text-muted d-block fw-bold mb-1">RELATED SYSTEM</small>
                    <span className="fw-semibold text-dark fs-6">
                      {ticket.relatedSystem?.name || 'None / General IT'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-4">
                <h5 className="fw-bold text-dark mb-2">{ticket.summary}</h5>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="form-label text-muted small fw-bold mb-1">DESCRIPTION</label>
                <div
                  className="p-3 rounded border bg-light text-dark"
                  style={{ whiteSpace: 'pre-wrap', minHeight: 100, lineHeight: 1.6 }}
                >
                  {ticket.description}
                </div>
              </div>
            </div>
          )}

          {/* IN-PLACE EDIT MODE */}
          {isEditing && (
            <form onSubmit={handleSaveEdit} noValidate>
              <div className="alert alert-info py-2 small mb-3">
                ✏️ <strong>In-Place Edit Mode:</strong> Update the fields below and click Save Changes.
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label htmlFor="edit-category" className="form-label fw-semibold text-dark small">
                    Category <span className="text-danger">*</span>
                  </label>
                  <select
                    id="edit-category"
                    className={`form-select ${editErrors.categoryId ? 'is-invalid' : ''}`}
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label htmlFor="edit-system" className="form-label fw-semibold text-dark small">
                    Related System
                  </label>
                  <select
                    id="edit-system"
                    className="form-select"
                    value={editRelatedSystemId}
                    onChange={(e) => setEditRelatedSystemId(e.target.value)}
                  >
                    <option value="">None / General IT</option>
                    {systems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label htmlFor="edit-priority" className="form-label fw-semibold text-dark small">
                    Priority
                  </label>
                  <select
                    id="edit-priority"
                    className="form-select"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  >
                    <option value="Low">🟢 Low</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="High">🟠 High</option>
                    <option value="Urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="edit-summary" className="form-label fw-semibold text-dark small">
                  Summary <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="edit-summary"
                  className={`form-control ${editErrors.summary ? 'is-invalid' : ''}`}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                />
                {editErrors.summary && (
                  <div className="invalid-feedback d-block">{editErrors.summary}</div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="edit-description" className="form-label fw-semibold text-dark small">
                  Description <span className="text-danger">*</span>
                </label>
                <textarea
                  id="edit-description"
                  rows={4}
                  className={`form-control ${editErrors.description ? 'is-invalid' : ''}`}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                ></textarea>
                {editErrors.description && (
                  <div className="invalid-feedback d-block">{editErrors.description}</div>
                )}
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-zen-primary btn-sm px-4 d-flex align-items-center gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>💾 Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ATTACHMENT LIFECYCLE SECTION */}
          <div className="mt-4 pt-4 border-top">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-dark mb-0">
                📎 Attachments ({ticket.attachments.length} / 5)
              </h6>
              {ticket.attachments.length < 5 && (
                <label className="btn btn-sm btn-zen-outline mb-0 cursor-pointer">
                  {isUploading ? 'Uploading...' : '➕ Add Attachment'}
                  <input
                    type="file"
                    className="d-none"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={handleUploadAttachment}
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>

            {uploadError && <div className="alert alert-danger small py-2 mb-3">{uploadError}</div>}

            {ticket.attachments.length === 0 && (
              <p className="text-muted small mb-0">No active attachments on this ticket.</p>
            )}

            {ticket.attachments.length > 0 && (
              <div className="list-group gap-2">
                {ticket.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="list-group-item d-flex justify-content-between align-items-center p-3 rounded border"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <span className="fs-4">📄</span>
                      <div>
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fw-semibold text-zen-primary text-decoration-none"
                        >
                          {att.fileName}
                        </a>
                        <div className="text-muted small">
                          Size: {formatBytes(att.fileSize)} • Uploaded: {formatDate(att.uploadedAt)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setTargetAttachmentToRemove(att)}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ticket.removedAttachments && ticket.removedAttachments.length > 0 && (
              <div className="mt-4 pt-3 border-top">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-secondary">Audit Trail</span>
                  <h6 className="text-muted small fw-bold mb-0">
                    Soft-Removed Attachments ({ticket.removedAttachments.length})
                  </h6>
                </div>
                <div className="list-group gap-2">
                  {ticket.removedAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="list-group-item bg-light d-flex justify-content-between align-items-center p-3 rounded border"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <span className="fs-4 text-muted">📄</span>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-danger">Soft-Removed</span>
                            <span className="text-decoration-line-through text-muted fw-semibold">
                              {att.fileName}
                            </span>
                            <span className="text-muted small">({formatBytes(att.fileSize)})</span>
                          </div>
                          {att.removedReason && (
                            <div className="text-muted small mt-1">
                              <em>Reason: "{att.removedReason}"</em>
                            </div>
                          )}
                          {att.removedAt && (
                            <div className="text-muted small">
                              Removed on {formatDate(att.removedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="badge bg-light text-muted border px-2 py-1 small">
                        Download Blocked (410 Gone)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Soft-Removal Confirmation Modal */}
      {targetAttachmentToRemove && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(2px)' }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '0.75rem' }}>
              <div className="modal-header border-0 bg-danger text-white">
                <h5 className="modal-title fw-bold">🗑️ Confirm Attachment Removal</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setTargetAttachmentToRemove(null)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-dark">
                  Are you sure you want to remove <strong>{targetAttachmentToRemove.fileName}</strong>?
                </p>
                <div className="mb-3">
                  <label htmlFor="removal-reason" className="form-label small text-muted">
                    Removal Reason (Optional):
                  </label>
                  <input
                    type="text"
                    id="removal-reason"
                    className="form-control form-control-sm"
                    placeholder="e.g., Sensitive info or obsolete document"
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                  />
                </div>
                <small className="text-muted">
                  Note: The attachment will be soft-removed for audit compliance.
                </small>
              </div>
              <div className="modal-footer border-top bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setTargetAttachmentToRemove(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-3"
                  onClick={handleConfirmSoftRemove}
                >
                  Confirm Removal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
