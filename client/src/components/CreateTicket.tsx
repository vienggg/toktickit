import React, { useState, useEffect } from "react";
import { useDevRequester } from "../context/DevRequesterContext";
import { Category, RelatedSystem, Priority, Ticket } from "../types";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const CreateTicket: React.FC = () => {
  const { selectedRequester, openModal } = useDevRequester();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [loadingRefData, setLoadingRefData] = useState<boolean>(true);

  // Form State
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("");
  const [requestedPriority, setRequestedPriority] = useState<Priority>("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);

  // UI & Validation States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    async function loadReferenceData() {
      setLoadingRefData(true);
      try {
        const [catRes, sysRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/systems")
        ]);
        if (catRes.ok && sysRes.ok) {
          const catData = await catRes.json();
          const sysData = await sysRes.json();
          setCategories(catData);
          setSystems(sysData);
          if (catData.length > 0) setCategoryId(String(catData[0].id));
          if (sysData.length > 0) setRelatedSystemId(String(sysData[0].id));
        }
      } catch {
        // Handled silently; dropdowns will remain empty
      } finally {
        setLoadingRefData(false);
      }
    }
    loadReferenceData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const newFiles: File[] = [];

    if (files.length + selectedFiles.length > 5) {
      setAttachmentError("Maximum of 5 attachments allowed per ticket.");
      return;
    }

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setAttachmentError(`File "${file.name}" exceeds the 5 MB size limit.`);
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setAttachmentError(`File "${file.name}" is not a supported format. Please upload JPG, PNG, WEBP, or PDF.`);
        return;
      }
      newFiles.push(file);
    }

    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = ""; // Reset file input
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      errors.summary = "Summary is required.";
    } else if (trimmedSummary.length < 5 || trimmedSummary.length > 200) {
      errors.summary = "Summary must be between 5 and 200 characters.";
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = "Description is required.";
    } else if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) {
      errors.description = "Description must be between 10 and 2000 characters.";
    }

    if (!categoryId) {
      errors.categoryId = "Please select a Category.";
    }
    if (!relatedSystemId) {
      errors.relatedSystemId = "Please select a Related System.";
    }
    if (!selectedRequester) {
      errors.requester = "Active requester context is missing. Please select a requester.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate submission

    setSubmitError(null);
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("summary", summary.trim());
      formData.append("description", description.trim());
      formData.append("categoryId", categoryId);
      formData.append("relatedSystemId", relatedSystemId);
      formData.append("requestedPriority", requestedPriority);
      formData.append("requesterId", String(selectedRequester!.id));

      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await fetch("/api/tickets", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.details) {
          const backendErrors: Record<string, string> = {};
          data.error.details.forEach((d: { field: string; message: string }) => {
            backendErrors[d.field] = d.message;
          });
          setFieldErrors(backendErrors);
        }
        throw new Error(data.error?.message || "Failed to create ticket.");
      }

      // Success
      setCreatedTicket(data);
      // Reset form
      setSummary("");
      setDescription("");
      setFiles([]);
      setFieldErrors({});
    } catch (err: any) {
      // Retain form data; display safe error banner
      setSubmitError(err.message || "An error occurred while submitting your ticket. All entered data has been preserved.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setCreatedTicket(null);
  };

  if (createdTicket) {
    return (
      <div className="ticket-card success-banner-card" data-testid="ticket-success-card">
        <div className="success-icon" aria-hidden="true">✅</div>
        <h2 className="success-title">Support Ticket Created Successfully!</h2>
        <p className="success-subtitle">
          Your ticket has been submitted to the TokTickIT Service Desk.
        </p>

        <div className="ticket-number-display">
          <span className="label">Official Ticket Number:</span>
          <span className="ticket-num-badge" data-testid="created-ticket-number">
            {createdTicket.ticketNumber}
          </span>
        </div>

        <div className="created-details-summary">
          <p><strong>Summary:</strong> {createdTicket.summary}</p>
          <p><strong>Initial Status:</strong> <span className="status-badge new">New</span></p>
          <p><strong>Requested Priority:</strong> <span className={`priority-badge ${createdTicket.requestedPriority.toLowerCase()}`}>{createdTicket.requestedPriority}</span></p>
          <p><strong>Requester:</strong> {selectedRequester?.name}</p>
          {createdTicket.attachments && createdTicket.attachments.length > 0 && (
            <p><strong>Attachments:</strong> {createdTicket.attachments.length} file(s) attached</p>
          )}
        </div>

        <div className="mt-4 text-center">
          <button className="btn-zen-primary" onClick={handleCreateAnother} data-testid="create-another-btn">
            Create Another Ticket
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-form-container" data-testid="create-ticket-form-container">
      <form onSubmit={handleSubmit} noValidate className="ticket-form-card">
        {submitError && (
          <div className="alert-banner alert-danger" data-testid="submit-error-alert">
            <span className="alert-icon" aria-hidden="true">⚠️</span>
            <div className="alert-content">
              <strong>Submission Failed:</strong> {submitError}
            </div>
          </div>
        )}

        <div className="form-grid-2col">
          {/* Locked Requester */}
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-requester-display">
              Requester <span className="text-muted">(Locked Identity)</span>
            </label>
            <div className="locked-input-group">
              <input
                id="ticket-requester-display"
                data-testid="locked-requester-input"
                type="text"
                className="form-control read-only"
                readOnly
                value={selectedRequester ? `${selectedRequester.name} (${selectedRequester.email})` : "No Requester Selected"}
              />
              <button
                type="button"
                className="btn-change-inline"
                onClick={openModal}
                data-testid="form-change-requester-btn"
              >
                Change
              </button>
            </div>
            {fieldErrors.requester && <p className="error-msg">{fieldErrors.requester}</p>}
          </div>

          {/* Ticket Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-date-display">
              Ticket Date <span className="text-muted">(System Default)</span>
            </label>
            <input
              id="ticket-date-display"
              type="text"
              className="form-control read-only"
              readOnly
              value={new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            />
          </div>
        </div>

        <div className="form-grid-2col">
          {/* Category Dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-category-select">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="ticket-category-select"
              data-testid="category-select"
              className={`form-control ${fieldErrors.categoryId ? "input-error" : ""}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loadingRefData}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="error-msg">{fieldErrors.categoryId}</p>}
          </div>

          {/* Related System Dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-system-select">
              Related System <span className="text-danger">*</span>
            </label>
            <select
              id="ticket-system-select"
              data-testid="system-select"
              className={`form-control ${fieldErrors.relatedSystemId ? "input-error" : ""}`}
              value={relatedSystemId}
              onChange={(e) => setRelatedSystemId(e.target.value)}
              disabled={loadingRefData}
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {fieldErrors.relatedSystemId && <p className="error-msg">{fieldErrors.relatedSystemId}</p>}
          </div>
        </div>

        {/* Summary Input */}
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-summary-input">
            Summary <span className="text-danger">*</span>
          </label>
          <input
            id="ticket-summary-input"
            data-testid="summary-input"
            type="text"
            className={`form-control ${fieldErrors.summary ? "input-error" : ""}`}
            placeholder="Brief summary of the issue (5–200 characters)"
            maxLength={200}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              if (fieldErrors.summary) {
                setFieldErrors((prev) => ({ ...prev, summary: "" }));
              }
            }}
          />
          <div className="field-footer">
            {fieldErrors.summary ? (
              <p className="error-msg">{fieldErrors.summary}</p>
            ) : (
              <small className="form-helper">Provide a clear, high-level overview.</small>
            )}
            <small className="char-counter">{summary.length} / 200</small>
          </div>
        </div>

        {/* Description Textarea */}
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-description-input">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="ticket-description-input"
            data-testid="description-input"
            className={`form-control textarea-input ${fieldErrors.description ? "input-error" : ""}`}
            placeholder="Provide detailed description of the problem, steps to reproduce, and error messages (10–2000 characters)"
            rows={5}
            maxLength={2000}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (fieldErrors.description) {
                setFieldErrors((prev) => ({ ...prev, description: "" }));
              }
            }}
          />
          <div className="field-footer">
            {fieldErrors.description ? (
              <p className="error-msg">{fieldErrors.description}</p>
            ) : (
              <small className="form-helper">Detailed descriptions help IT resolve issues faster.</small>
            )}
            <small className="char-counter">{description.length} / 2000</small>
          </div>
        </div>

        {/* Requested Priority */}
        <div className="form-group">
          <label className="form-label">
            Requested Priority <span className="text-danger">*</span>
          </label>
          <div className="priority-radio-group" role="radiogroup" aria-label="Requested Priority">
            {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
              <label key={p} className={`priority-radio-label ${requestedPriority === p ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="requestedPriority"
                  value={p}
                  checked={requestedPriority === p}
                  onChange={() => setRequestedPriority(p)}
                  data-testid={`priority-${p.toLowerCase()}`}
                />
                <span className={`priority-pill ${p.toLowerCase()}`}>{p}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="form-group attachment-form-group">
          <label className="form-label" htmlFor="ticket-attachments-input">
            Attachments <span className="text-muted">(Max 5 files, up to 5 MB each; JPG, PNG, WEBP, PDF)</span>
          </label>
          
          <div className="file-upload-box">
            <input
              id="ticket-attachments-input"
              data-testid="file-upload-input"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              disabled={files.length >= 5}
            />
          </div>

          {attachmentError && (
            <p className="error-msg mt-2" data-testid="attachment-error-msg">
              ⚠️ {attachmentError}
            </p>
          )}

          {files.length > 0 && (
            <ul className="selected-files-list" data-testid="selected-files-list">
              {files.map((file, idx) => (
                <li key={idx} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    className="btn-remove-file"
                    onClick={() => handleRemoveFile(idx)}
                    aria-label={`Remove file ${file.name}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-zen-primary btn-submit"
            data-testid="submit-ticket-btn"
            disabled={submitting || loadingRefData}
          >
            {submitting ? (
              <>
                <span className="spinner-inline" aria-hidden="true"></span>
                <span>Submitting Ticket...</span>
              </>
            ) : (
              "Submit Ticket"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
