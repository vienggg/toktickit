import React, { useState, useEffect } from 'react';
import { useDevRequester } from '../context/DevRequesterContext';

interface Category {
  id: number;
  name: string;
}

interface RelatedSystem {
  id: number;
  name: string;
  description?: string;
}

interface CreatedTicketResult {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  category: { name: string };
  relatedSystem?: { name: string } | null;
  attachments?: { id: number; fileName: string; fileSize: number }[];
  createdAt: string;
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const CreateTicket: React.FC = () => {
  const { currentRequester, setIsModalOpen } = useDevRequester();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [isLoadingRefData, setIsLoadingRefData] = useState<boolean>(true);

  // Form Fields
  const [summary, setSummary] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [relatedSystemId, setRelatedSystemId] = useState<string>('');
  const [priority, setPriority] = useState<string>('Medium');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // UI State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicketResult | null>(null);

  useEffect(() => {
    async function loadReferenceData() {
      setIsLoadingRefData(true);
      try {
        const [catRes, sysRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/systems'),
        ]);

        if (catRes.ok) {
          const cats: Category[] = await catRes.json();
          setCategories(cats);
          if (cats.length > 0) setCategoryId(String(cats[0].id));
        }

        if (sysRes.ok) {
          const sys: RelatedSystem[] = await sysRes.json();
          setSystems(sys);
        }
      } catch (err) {
        console.error('Failed to load reference data:', err);
      } finally {
        setIsLoadingRefData(false);
      }
    }

    loadReferenceData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const newFilesList: File[] = [...selectedFiles];

    for (const file of files) {
      if (newFilesList.length >= 5) {
        setFileError('Maximum of 5 attachments allowed per ticket.');
        break;
      }

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(`Invalid format for "${file.name}". Permitted: JPG, PNG, WEBP, PDF.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }

      newFilesList.push(file);
    }

    setSelectedFiles(newFilesList);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!summary.trim()) {
      errors.summary = 'Summary is required.';
    } else if (summary.trim().length < 3) {
      errors.summary = 'Summary must be at least 3 characters.';
    } else if (summary.length > 200) {
      errors.summary = 'Summary cannot exceed 200 characters.';
    }

    if (!description.trim()) {
      errors.description = 'Description is required.';
    } else if (description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.';
    }

    if (!categoryId) {
      errors.categoryId = 'Please select an IT category.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;
    if (!currentRequester) {
      setSubmitError('Please select a development requester before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('summary', summary.trim());
      formData.append('description', description.trim());
      formData.append('priority', priority);
      formData.append('categoryId', categoryId);
      if (relatedSystemId) {
        formData.append('relatedSystemId', relatedSystemId);
      }
      formData.append('requesterId', String(currentRequester.id));

      selectedFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      const res = await fetch('/api/tickets', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      const result: CreatedTicketResult = await res.json();
      setCreatedTicket(result);

      // Reset form fields
      setSummary('');
      setDescription('');
      setSelectedFiles([]);
      setFieldErrors({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred while creating the ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="container py-2" style={{ maxWidth: 840 }}>
      {/* Success Confirmation Banner */}
      {createdTicket && (
        <div
          className="alert alert-success border-success shadow-sm mb-4 p-4"
          role="alert"
          style={{ borderRadius: '0.75rem', backgroundColor: 'var(--zen-light-tint)' }}
        >
          <div className="d-flex align-items-start justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <span className="fs-2">🎉</span>
              <div>
                <h5 className="alert-heading fw-bold mb-1 text-zen-primary">
                  Ticket Created Successfully!
                </h5>
                <p className="mb-2 text-dark">
                  Your ticket has been recorded in the database with official number:
                </p>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success fs-5 px-3 py-2 font-monospace">
                    {createdTicket.ticketNumber}
                  </span>
                  <span className="badge bg-white text-dark border">
                    Priority: <strong>{createdTicket.priority}</strong>
                  </span>
                  <span className="badge bg-white text-dark border">
                    Category: <strong>{createdTicket.category?.name}</strong>
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-zen-outline btn-sm"
              onClick={() => setCreatedTicket(null)}
            >
              ➕ Create Another Ticket
            </button>
          </div>
        </div>
      )}

      {/* Main Ticket Creation Card */}
      <div className="card border-0 shadow-sm bg-white" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
        <div
          className="card-header border-0 px-4 py-3 text-white"
          style={{ backgroundColor: 'var(--zen-primary)' }}
        >
          <h4 className="mb-0 fw-bold">🎫 Create IT Support Ticket</h4>
          <small className="opacity-75">Submit a problem report or service request to the TokTickIT team</small>
        </div>

        <div className="card-body p-4">
          {submitError && (
            <div className="alert alert-danger mb-4" role="alert">
              <strong>Submission Failed:</strong> {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Requester Identity (Read-only / Locked) */}
            <div className="mb-3 p-3 rounded border bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label text-muted small fw-bold mb-0">
                  🔒 REQUESTER (LOCKED CONTEXT)
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success px-2 py-0.5 d-flex align-items-center gap-1 shadow-sm fw-semibold"
                  style={{ fontSize: '0.8rem', borderRadius: '0.4rem' }}
                  onClick={() => setIsModalOpen(true)}
                >
                  <span>🔄</span> Change Requester
                </button>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-5">👤</span>
                <span className="fw-semibold text-dark fs-6">
                  {currentRequester ? currentRequester.name : 'Loading...'}
                </span>
                <span className="badge bg-secondary ms-1">{currentRequester?.department}</span>
                <span className="text-muted small ms-auto font-monospace">{currentRequester?.email}</span>
              </div>
            </div>

            {/* Category and Related System */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="ticket-category" className="form-label fw-semibold text-dark">
                  Category <span className="text-danger">*</span>
                </label>
                <select
                  id="ticket-category"
                  className={`form-select ${fieldErrors.categoryId ? 'is-invalid' : ''}`}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (fieldErrors.categoryId) {
                      setFieldErrors({ ...fieldErrors, categoryId: '' });
                    }
                  }}
                  disabled={isLoadingRefData}
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <div className="invalid-feedback d-block">{fieldErrors.categoryId}</div>
                )}
              </div>

              <div className="col-md-6">
                <label htmlFor="ticket-system" className="form-label fw-semibold text-dark">
                  Related System <span className="text-muted small">(Optional)</span>
                </label>
                <select
                  id="ticket-system"
                  className="form-select"
                  value={relatedSystemId}
                  onChange={(e) => setRelatedSystemId(e.target.value)}
                  disabled={isLoadingRefData}
                >
                  <option value="">None / General IT</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority and Summary */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label htmlFor="ticket-priority" className="form-label fw-semibold text-dark">
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="Low">🟢 Low</option>
                  <option value="Medium">🟡 Medium (Default)</option>
                  <option value="High">🟠 High</option>
                  <option value="Urgent">🔴 Urgent</option>
                </select>
              </div>

              <div className="col-md-8">
                <div className="d-flex justify-content-between">
                  <label htmlFor="ticket-summary" className="form-label fw-semibold text-dark">
                    Summary <span className="text-danger">*</span>
                  </label>
                  <span className="text-muted small">{summary.length} / 200</span>
                </div>
                <input
                  type="text"
                  id="ticket-summary"
                  className={`form-control ${fieldErrors.summary ? 'is-invalid' : ''}`}
                  placeholder="e.g. ERP Core Reconciliation Error on Q2 Close"
                  maxLength={200}
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    if (fieldErrors.summary) {
                      setFieldErrors({ ...fieldErrors, summary: '' });
                    }
                  }}
                />
                {fieldErrors.summary && (
                  <div className="invalid-feedback d-block">{fieldErrors.summary}</div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-3">
              <label htmlFor="ticket-description" className="form-label fw-semibold text-dark">
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="ticket-description"
                rows={4}
                className={`form-control ${fieldErrors.description ? 'is-invalid' : ''}`}
                placeholder="Provide detailed information about the issue, error messages, and reproduction steps..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors({ ...fieldErrors, description: '' });
                  }
                }}
              ></textarea>
              {fieldErrors.description && (
                <div className="invalid-feedback d-block">{fieldErrors.description}</div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="mb-4 p-3 rounded border border-light-subtle bg-light">
              <label className="form-label fw-semibold text-dark mb-1">
                📎 Attachments <span className="text-muted small">(Max 5 files, ≤ 5MB each: JPG, PNG, WEBP, PDF)</span>
              </label>

              <div className="input-group mb-2">
                <input
                  type="file"
                  className="form-control"
                  id="attachment-input"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={handleFileChange}
                  disabled={selectedFiles.length >= 5 || isSubmitting}
                />
              </div>

              {fileError && <div className="text-danger small mb-2">{fileError}</div>}

              {/* Selected Files Chip Preview */}
              {selectedFiles.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2 shadow-sm"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <span>📄</span>
                      <span className="fw-medium text-truncate" style={{ maxWidth: 180 }}>
                        {file.name}
                      </span>
                      <span className="text-muted small">({formatBytes(file.size)})</span>
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.65rem' }}
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeFile(idx)}
                        disabled={isSubmitting}
                      ></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit & Action Buttons */}
            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary px-3"
                onClick={() => {
                  setSummary('');
                  setDescription('');
                  setSelectedFiles([]);
                  setFieldErrors({});
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
              >
                Clear Form
              </button>

              <button
                type="submit"
                className="btn btn-zen-primary px-4 d-flex align-items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Submitting Ticket...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Submit Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
