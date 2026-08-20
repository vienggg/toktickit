import React, { useState, useEffect } from "react";
import { useDevRequester } from "../context/DevRequesterContext";
import { Ticket, Category, RelatedSystem, Priority, Attachment } from "../types";

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, onBack }) => {
  const { selectedRequester } = useDevRequester();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSummary, setEditSummary] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editRelatedSystemId, setEditRelatedSystemId] = useState<string>("");
  const [editPriority, setEditPriority] = useState<Priority>("MEDIUM");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [removeAttachmentId, setRemoveAttachmentId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [ticketRes, catRes, sysRes] = await Promise.all([
          fetch(`/api/tickets/${ticketId}${selectedRequester ? `?requesterId=${selectedRequester.id}` : ""}`),
          fetch("/api/categories"),
          fetch("/api/systems")
        ]);

        if (!ticketRes.ok) {
          throw new Error(`Failed to load ticket (Status ${ticketRes.status})`);
        }

        const ticketData: Ticket = await ticketRes.json();
        setTicket(ticketData);
        setEditSummary(ticketData.summary);
        setEditDescription(ticketData.description);
        setEditCategoryId(String(ticketData.categoryId));
        setEditRelatedSystemId(String(ticketData.relatedSystemId));
        setEditPriority(ticketData.requestedPriority);

        if (catRes.ok) setCategories(await catRes.json());
        if (sysRes.ok) setSystems(await sysRes.json());
      } catch (err: any) {
        setError(err.message || "Failed to load ticket details.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ticketId, selectedRequester]);

  const handleStartEdit = () => {
    if (!ticket) return;
    setEditSummary(ticket.summary);
    setEditDescription(ticket.description);
    setEditCategoryId(String(ticket.categoryId));
    setEditRelatedSystemId(String(ticket.relatedSystemId));
    setEditPriority(ticket.requestedPriority);
    setFieldErrors({});
    setIsEditing(true);
    setSaveSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
  };

  const validateEdit = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedSummary = editSummary.trim();
    if (!trimmedSummary || trimmedSummary.length < 5 || trimmedSummary.length > 200) {
      errors.summary = "Summary must be between 5 and 200 characters.";
    }
    const trimmedDesc = editDescription.trim();
    if (!trimmedDesc || trimmedDesc.length < 10 || trimmedDesc.length > 2000) {
      errors.description = "Description must be between 10 and 2000 characters.";
    }
    if (!editCategoryId) errors.categoryId = "Category is required.";
    if (!editRelatedSystemId) errors.relatedSystemId = "Related System is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !ticket) return;
    if (!validateEdit()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: editSummary.trim(),
          description: editDescription.trim(),
          categoryId: editCategoryId,
          relatedSystemId: editRelatedSystemId,
          requestedPriority: editPriority,
          requesterId: selectedRequester?.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save ticket modifications.");
      }

      setTicket(data);
      setIsEditing(false);
      setSaveSuccessMsg("Ticket updated successfully!");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setFieldErrors({ form: err.message || "Save operation failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: number) => {
    if (!window.confirm("Are you sure you want to remove this attachment?")) return;

    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to remove attachment.");
      }
      // Update local state
      setTicket((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: prev.attachments?.filter((a) => a.id !== attachmentId)
        };
      });
    } catch (err: any) {
      alert(err.message || "Failed to remove attachment.");
    }
  };

  if (loading) {
    return (
      <div className="ticket-detail-container">
        <button className="btn-zen-secondary btn-sm mb-3" onClick={onBack}>
          &larr; Back to My Tickets
        </button>
        <div className="loading-state card-surface">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-container">
        <button className="btn-zen-secondary btn-sm mb-3" onClick={onBack}>
          &larr; Back to My Tickets
        </button>
        <div className="error-state card-surface">
          <p className="error-msg">⚠️ {error || "Ticket not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-detail-container" data-testid="ticket-detail-view">
      {/* Top Header */}
      <div className="detail-top-nav">
        <button className="btn-zen-secondary btn-sm" onClick={onBack} data-testid="back-to-tickets-btn">
          &larr; Back to My Tickets
        </button>
        {!isEditing && ticket.currentStatus === "New" && (
          <button className="btn-zen-primary btn-sm" onClick={handleStartEdit} data-testid="edit-ticket-btn">
            ✏️ Edit Ticket
          </button>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="alert-banner alert-success mb-3" data-testid="save-success-banner">
          <span>✅ {saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Detail / Edit Card */}
      <div className="ticket-detail-card card-surface">
        <div className="detail-header-row">
          <div>
            <span className="detail-ticket-number" data-testid="detail-ticket-number">
              {ticket.ticketNumber}
            </span>
            <span className="detail-date text-muted">
              Submitted on {new Date(ticket.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="detail-badges">
            <span className="status-badge new">{ticket.currentStatus}</span>
            <span className={`priority-pill ${ticket.requestedPriority.toLowerCase()}`}>
              {ticket.requestedPriority}
            </span>
          </div>
        </div>

        {isEditing ? (
          /* Edit Mode Form */
          <form onSubmit={handleSaveEdit} className="edit-ticket-form mt-4" data-testid="edit-ticket-form">
            {fieldErrors.form && (
              <div className="alert-banner alert-danger mb-3">
                <span>⚠️ {fieldErrors.form}</span>
              </div>
            )}

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-category-select">Category</label>
                <select
                  id="edit-category-select"
                  data-testid="edit-category-select"
                  className="form-control"
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {fieldErrors.categoryId && <p className="error-msg">{fieldErrors.categoryId}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-system-select">Related System</label>
                <select
                  id="edit-system-select"
                  data-testid="edit-system-select"
                  className="form-control"
                  value={editRelatedSystemId}
                  onChange={(e) => setEditRelatedSystemId(e.target.value)}
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {fieldErrors.relatedSystemId && <p className="error-msg">{fieldErrors.relatedSystemId}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-summary-input">Summary</label>
              <input
                id="edit-summary-input"
                data-testid="edit-summary-input"
                type="text"
                className={`form-control ${fieldErrors.summary ? "input-error" : ""}`}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                maxLength={200}
              />
              <div className="field-footer">
                {fieldErrors.summary && <p className="error-msg">{fieldErrors.summary}</p>}
                <small className="char-counter">{editSummary.length} / 200</small>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-description-input">Description</label>
              <textarea
                id="edit-description-input"
                data-testid="edit-description-input"
                className={`form-control textarea-input ${fieldErrors.description ? "input-error" : ""}`}
                rows={5}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={2000}
              />
              <div className="field-footer">
                {fieldErrors.description && <p className="error-msg">{fieldErrors.description}</p>}
                <small className="char-counter">{editDescription.length} / 2000</small>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Requested Priority</label>
              <div className="priority-radio-group">
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                  <label key={p} className={`priority-radio-label ${editPriority === p ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="editPriority"
                      value={p}
                      checked={editPriority === p}
                      onChange={() => setEditPriority(p)}
                      data-testid={`edit-priority-${p.toLowerCase()}`}
                    />
                    <span className={`priority-pill ${p.toLowerCase()}`}>{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-actions gap-2">
              <button
                type="button"
                className="btn-zen-secondary"
                onClick={handleCancelEdit}
                data-testid="cancel-edit-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-zen-primary"
                disabled={saving}
                data-testid="save-edit-btn"
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="detail-content-body mt-4">
            <div className="meta-grid-3col">
              <div className="meta-item">
                <span className="meta-label">Category</span>
                <span className="meta-val">{ticket.category?.name || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Related System</span>
                <span className="meta-val">{ticket.relatedSystem?.name || "-"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Requester</span>
                <span className="meta-val">{ticket.requester?.name} ({ticket.requester?.email})</span>
              </div>
            </div>

            <div className="detail-section mt-4">
              <h3 className="section-heading">Summary</h3>
              <p className="summary-display" data-testid="detail-summary-display">
                {ticket.summary}
              </p>
            </div>

            <div className="detail-section mt-3">
              <h3 className="section-heading">Detailed Description</h3>
              <div className="description-display" data-testid="detail-description-display">
                {ticket.description}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="detail-section mt-4" data-testid="detail-attachments-section">
              <h3 className="section-heading">
                Attachments {ticket.attachments ? `(${ticket.attachments.length})` : "(0)"}
              </h3>
              {ticket.attachments && ticket.attachments.length > 0 ? (
                <ul className="attachment-files-list">
                  {ticket.attachments.map((att: Attachment) => (
                    <li key={att.id} className="attachment-file-card" data-testid={`attachment-item-${att.id}`}>
                      <div className="att-info">
                        <span className="att-icon">📎</span>
                        <span className="att-name">{att.fileName}</span>
                        <span className="att-size">({(att.fileSize / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <div className="att-actions">
                        <a
                          href={`/api/attachments/${att.id}/download`}
                          className="btn-att-download"
                          download
                          data-testid={`download-att-${att.id}`}
                        >
                          ⬇ Download
                        </a>
                        {ticket.currentStatus === "New" && (
                          <button
                            type="button"
                            className="btn-att-remove"
                            onClick={() => handleRemoveAttachment(att.id)}
                            data-testid={`remove-att-${att.id}`}
                          >
                            🗑 Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted fst-italic">No attachments uploaded for this ticket.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
