import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

// Lab 4 (I-4): Actions Taken section of Ticket Detail.
// Spec: docs/lab-04/ui-spec.md §6 (staff) and §7 (Requester, read-only).
// The backend stays the authority (BR-03): hiding a control here is a usability
// aid only, every write is re-checked by the server.

export type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ActionItem {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string | null;
  status: ActionStatus;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdBy: { id: number; name: string };
  assignee: { id: number; name: string };
  updatedBy?: { id: number; name: string } | null;
  version?: number;
}

interface StaffMemberOption {
  id: number;
  name: string;
}

interface ActionsTakenProps {
  ticketId: number;
  ticketStatus: string;
  mode: 'staff' | 'requester';
  currentUserId?: number;
  currentUserName?: string;
  staffMembers?: StaffMemberOption[];
  /** Called after a successful write so the Ticket summary (blockers, counts) can refresh. */
  onChanged?: () => void;
}

const LOCKED_TICKET_STATUSES = ['RESOLVED', 'CLOSED', 'CANCELLED'];

const STATUS_LABEL: Record<ActionStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
// Non-colour cue (ui-spec §1): every status badge carries a symbol and its text.
const STATUS_SYMBOL: Record<ActionStatus, string> = { PLANNED: '○', IN_PROGRESS: '◐', COMPLETED: '●', CANCELLED: '✕' };

// BR-11
const NEXT_STATUSES: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
const INITIAL_STATUSES: ActionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span className={`badge zen-badge-action-${status.toLowerCase().replace('_', '-')}`} data-testid="action-status-badge" data-status={status}>
      <span aria-hidden="true">{STATUS_SYMBOL[status]} </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FormValues {
  actionAt: string;
  description: string;
  status: ActionStatus;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

type FieldKey = 'actionAt' | 'description' | 'status' | 'result' | 'assigneeId' | 'followUpNote' | 'attachmentNotes';
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_IDS: Record<FieldKey, string> = {
  actionAt: 'action-at',
  description: 'action-description',
  status: 'action-status',
  result: 'action-result',
  assigneeId: 'action-assignee',
  followUpNote: 'action-followup-note',
  attachmentNotes: 'action-attachment-notes',
};
const FIELD_ORDER: FieldKey[] = ['actionAt', 'description', 'status', 'result', 'assigneeId', 'followUpNote', 'attachmentNotes'];

function valuesFromItem(item: ActionItem): FormValues {
  return {
    actionAt: toLocalInputValue(new Date(item.actionAt)),
    description: item.description,
    status: item.status,
    result: item.result ?? '',
    assigneeId: String(item.assignee.id),
    followUpRequired: item.followUpRequired,
    followUpNote: item.followUpNote ?? '',
    attachmentNotes: item.attachmentNotes ?? '',
  };
}

// Mirrors the server rules (BR-06..BR-10) so the user gets instant, field-level feedback.
function validate(values: FormValues, actionAtTouched: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (actionAtTouched) {
    const when = new Date(values.actionAt);
    if (Number.isNaN(when.getTime())) errors.actionAt = 'Enter a valid date and time.';
    else if (when.getTime() > Date.now() + 5 * 60_000) errors.actionAt = 'Action date/time cannot be in the future.';
  }
  const description = values.description.trim();
  if (!description) errors.description = 'Description is required.';
  else if (description.length > 2000) errors.description = 'Description must be at most 2000 characters.';
  if (values.status === 'COMPLETED' && !values.result.trim()) errors.result = 'Result is required when the action is completed.';
  if (values.result.trim().length > 2000) errors.result = 'Result must be at most 2000 characters.';
  if (values.followUpRequired && !values.followUpNote.trim()) errors.followUpNote = 'Follow-up note is required when follow-up is required.';
  if (values.followUpNote.trim().length > 1000) errors.followUpNote = 'Follow-up note must be at most 1000 characters.';
  if (values.attachmentNotes.trim().length > 1000) errors.attachmentNotes = 'Attachment notes must be at most 1000 characters.';
  return errors;
}

interface ServerError {
  code?: string;
  message?: string;
  field?: string;
  current?: ActionItem;
}

function serverFieldFor(error: ServerError): FieldKey | null {
  if (error.code === 'INVALID_ASSIGNEE') return 'assigneeId';
  const field = error.field ?? /^Invalid '(\w+)'/.exec(error.message ?? '')?.[1];
  if (field === 'assigneeId' || field === 'actionAt' || field === 'description' || field === 'status' || field === 'result' || field === 'followUpNote' || field === 'attachmentNotes') {
    return field;
  }
  return null;
}

function stripPrefix(message: string): string {
  return message.replace(/^Invalid '\w+':\s*/, '');
}

interface ActionFormProps {
  mode: 'create' | 'edit';
  item?: ActionItem;
  initialStatus?: ActionStatus;
  currentUserId?: number;
  currentUserName?: string;
  staffMembers: StaffMemberOption[];
  ticketId: number;
  onSaved: () => void;
  onCancel: () => void;
}

function ActionForm({ mode, item, initialStatus, currentUserId, currentUserName, staffMembers, ticketId, onSaved, onCancel }: ActionFormProps) {
  const [values, setValues] = useState<FormValues>(() =>
    item
      ? { ...valuesFromItem(item), status: initialStatus ?? item.status }
      : {
          actionAt: toLocalInputValue(new Date()),
          description: '',
          status: 'PLANNED',
          result: '',
          assigneeId: currentUserId ? String(currentUserId) : '',
          followUpRequired: false,
          followUpNote: '',
          attachmentNotes: '',
        }
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState<ActionItem | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | undefined>(item?.version);
  const [actionAtTouched, setActionAtTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  // One id per opened form: a retry after a network failure is recognised by the
  // server as the same request (BR-26), so it cannot create a duplicate.
  const requestIdRef = useRef<string>(newRequestId());

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const focusFirst = (errs: FieldErrors) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) setTimeout(() => document.getElementById(FIELD_IDS[first])?.focus(), 0);
  };

  const statusOptions: ActionStatus[] =
    mode === 'create' ? INITIAL_STATUSES : item ? [item.status, ...NEXT_STATUSES[item.status]] : INITIAL_STATUSES;
  const assigneeOptions = staffMembers.length > 0 ? staffMembers : currentUserId ? [{ id: currentUserId, name: currentUserName ?? 'Me' }] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setFormError(null);
    const found = validate(values, actionAtTouched);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }

    const body: Record<string, unknown> = {
      description: values.description.trim(),
      status: values.status,
      assigneeId: values.assigneeId ? Number(values.assigneeId) : undefined,
      followUpRequired: values.followUpRequired,
      followUpNote: values.followUpRequired ? values.followUpNote.trim() : null,
      attachmentNotes: values.attachmentNotes.trim() || null,
    };
    if (values.result.trim() || mode === 'edit') body.result = values.result.trim() || null;
    // Sent only when the user picked a time: omitting it lets the server use "now".
    if (actionAtTouched) body.actionAt = new Date(values.actionAt).toISOString();

    let url: string;
    let method: 'POST' | 'PATCH';
    if (mode === 'create') {
      url = `/api/staff/tickets/${ticketId}/actions`;
      method = 'POST';
      body.clientRequestId = requestIdRef.current;
    } else {
      url = `/api/staff/tickets/${ticketId}/actions/${item!.id}`;
      method = 'PATCH';
      body.expectedVersion = baseVersion;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        onSaved();
        return;
      }
      const payload = await res.json().catch(() => null);
      const error: ServerError = payload?.error ?? {};
      if (res.status === 409 && error.code === 'STALE_UPDATE' && error.current) {
        setStale(error.current);
        return;
      }
      const field = serverFieldFor(error);
      const message = stripPrefix(error.message ?? 'Could not save the action.');
      if (field) {
        const fieldErrors = { [field]: message } as FieldErrors;
        setErrors(fieldErrors);
        focusFirst(fieldErrors);
      } else {
        setFormError(`${message} Your changes are still here.`);
      }
    } catch {
      setFormError('Something went wrong. Your changes are still here — try again.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const describedBy = (key: FieldKey) => (errors[key] ? `err-${FIELD_IDS[key]}` : undefined);
  const fieldError = (key: FieldKey) =>
    errors[key] ? (
      <div id={`err-${FIELD_IDS[key]}`} className="invalid-feedback d-block">
        {errors[key]}
      </div>
    ) : null;
  const recorder = item?.createdBy.name ?? currentUserName ?? 'you';

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label={mode === 'create' ? 'New action' : 'Edit action'}
      className="p-3 rounded border bg-white mb-3"
      data-testid="action-form"
    >
      {stale && (
        <div className="alert alert-warning small" role="alert">
          <strong>This action was changed by someone else.</strong> Latest saved text: “{stale.description}”
          {stale.result ? ` — Result: “${stale.result}”` : ''} ({STATUS_LABEL[stale.status]}).
          <div className="d-flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="btn btn-sm btn-zen-outline"
              onClick={() => {
                setBaseVersion(stale.version);
                setStale(null);
              }}
            >
              Keep my edits and use the latest version
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setValues(valuesFromItem(stale));
                setBaseVersion(stale.version);
                setStale(null);
              }}
            >
              Discard my edits
            </button>
          </div>
        </div>
      )}
      {formError && (
        <div className="alert alert-danger small" role="alert">
          {formError}
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor={FIELD_IDS.actionAt} className="form-label small fw-semibold">
            Action date/time
          </label>
          <input
            id={FIELD_IDS.actionAt}
            type="datetime-local"
            className={`form-control ${errors.actionAt ? 'is-invalid' : ''}`}
            value={values.actionAt}
            onChange={(e) => {
              setActionAtTouched(true);
              set('actionAt', e.target.value);
            }}
            aria-invalid={errors.actionAt ? 'true' : undefined}
            aria-describedby={describedBy('actionAt')}
          />
          {fieldError('actionAt')}
        </div>
        <div className="col-md-6">
          <div className="form-control-plaintext small fw-semibold pt-4">Recorded by {recorder}</div>
        </div>

        <div className="col-12">
          <label htmlFor={FIELD_IDS.description} className="form-label small fw-semibold">
            Description <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={FIELD_IDS.description}
            className={`form-control ${errors.description ? 'is-invalid' : ''}`}
            rows={2}
            maxLength={2100}
            required
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            aria-invalid={errors.description ? 'true' : undefined}
            aria-describedby={describedBy('description')}
          />
          <div className="form-text">{values.description.trim().length}/2000</div>
          {fieldError('description')}
        </div>

        <div className="col-md-6">
          <label htmlFor={FIELD_IDS.status} className="form-label small fw-semibold">
            Status
          </label>
          <select
            id={FIELD_IDS.status}
            className="form-select"
            value={values.status}
            onChange={(e) => set('status', e.target.value as ActionStatus)}
            aria-describedby={describedBy('status')}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {fieldError('status')}
        </div>
        <div className="col-md-6">
          <label htmlFor={FIELD_IDS.assigneeId} className="form-label small fw-semibold">
            Assignee
          </label>
          <select
            id={FIELD_IDS.assigneeId}
            className={`form-select ${errors.assigneeId ? 'is-invalid' : ''}`}
            value={values.assigneeId}
            onChange={(e) => set('assigneeId', e.target.value)}
            aria-invalid={errors.assigneeId ? 'true' : undefined}
            aria-describedby={describedBy('assigneeId')}
          >
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {fieldError('assigneeId')}
        </div>

        <div className="col-12">
          <label htmlFor={FIELD_IDS.result} className="form-label small fw-semibold">
            Result {values.status === 'COMPLETED' && <span aria-hidden="true">*</span>}
          </label>
          <textarea
            id={FIELD_IDS.result}
            className={`form-control ${errors.result ? 'is-invalid' : ''}`}
            rows={2}
            required={values.status === 'COMPLETED'}
            value={values.result}
            onChange={(e) => set('result', e.target.value)}
            aria-invalid={errors.result ? 'true' : undefined}
            aria-describedby={describedBy('result')}
          />
          {fieldError('result')}
        </div>

        <div className="col-12">
          <div className="form-check">
            <input
              id="action-followup-required"
              type="checkbox"
              className="form-check-input"
              checked={values.followUpRequired}
              onChange={(e) => set('followUpRequired', e.target.checked)}
            />
            <label htmlFor="action-followup-required" className="form-check-label small fw-semibold">
              Follow-up required?
            </label>
          </div>
        </div>
        {values.followUpRequired && (
          <div className="col-12">
            <label htmlFor={FIELD_IDS.followUpNote} className="form-label small fw-semibold">
              Follow-up note <span aria-hidden="true">*</span>
            </label>
            <textarea
              id={FIELD_IDS.followUpNote}
              className={`form-control ${errors.followUpNote ? 'is-invalid' : ''}`}
              rows={2}
              required
              value={values.followUpNote}
              onChange={(e) => set('followUpNote', e.target.value)}
              aria-invalid={errors.followUpNote ? 'true' : undefined}
              aria-describedby={describedBy('followUpNote')}
            />
            {fieldError('followUpNote')}
          </div>
        )}

        <div className="col-12">
          <label htmlFor={FIELD_IDS.attachmentNotes} className="form-label small fw-semibold">
            Attachment notes
          </label>
          <textarea
            id={FIELD_IDS.attachmentNotes}
            className={`form-control ${errors.attachmentNotes ? 'is-invalid' : ''}`}
            rows={2}
            value={values.attachmentNotes}
            onChange={(e) => set('attachmentNotes', e.target.value)}
            aria-invalid={errors.attachmentNotes ? 'true' : undefined}
            aria-describedby={describedBy('attachmentNotes') ?? 'attachment-notes-help'}
          />
          <div id="attachment-notes-help" className="form-text">
            Say which file or image to look for and where it is stored. Files cannot be uploaded here.
          </div>
          {fieldError('attachmentNotes')}
        </div>
      </div>

      <p className="text-muted small mt-3 mb-2">Everything here is visible to the requester. Use an Internal Note for staff-only remarks.</p>
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-zen-primary btn-sm" disabled={isSaving}>
          {isSaving ? 'Saving…' : mode === 'create' ? 'Save action' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FollowUp({ item }: { item: ActionItem }) {
  if (!item.followUpRequired) return <span className="text-muted">—</span>;
  return (
    <div>
      <span className="badge zen-chip-followup">
        <span aria-hidden="true">⚑ </span>Follow-up
      </span>
      <div className="small mt-1">{item.followUpNote}</div>
    </div>
  );
}

export const ActionsTaken: React.FC<ActionsTakenProps> = ({
  ticketId,
  ticketStatus,
  mode,
  currentUserId,
  currentUserName,
  staffMembers = [],
  onChanged,
}) => {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState<
    { kind: 'none' } | { kind: 'create' } | { kind: 'view'; id: number } | { kind: 'edit'; id: number; status?: ActionStatus }
  >({ kind: 'none' });
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);

  const isStaff = mode === 'staff';
  const locked = LOCKED_TICKET_STATUSES.includes(ticketStatus);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await apiFetch(`/api/tickets/${ticketId}/actions`, { signal });
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
    },
    [ticketId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const afterSave = async () => {
    setPanel({ kind: 'none' });
    await load();
    onChanged?.();
  };

  const patchStatus = async (item: ActionItem, status: ActionStatus) => {
    if (rowBusy) return;
    setRowBusy(true);
    setRowError(null);
    try {
      const res = await apiFetch(`/api/staff/tickets/${ticketId}/actions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedVersion: item.version }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setRowError(stripPrefix(payload?.error?.message ?? 'Could not change the action status.'));
        if (payload?.error?.code === 'STALE_UPDATE') await load();
        return;
      }
      await load();
      onChanged?.();
    } catch {
      setRowError('Something went wrong. Please try again.');
    } finally {
      setRowBusy(false);
    }
  };

  const selected = panel.kind === 'view' || panel.kind === 'edit' ? items.find((a) => a.id === panel.id) : undefined;

  const assigneeCell = (a: ActionItem) => (
    <div>
      <div>{a.assignee.name}</div>
      <div className="text-muted small">{`Recorded by ${a.createdBy.name}`}</div>
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-top" id="actions" data-testid="actions-taken">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h6 className="fw-bold text-dark mb-0">🛠️ Actions Taken ({items.length})</h6>
        {isStaff && !locked && panel.kind !== 'create' && (
          <button type="button" className="btn btn-zen-primary btn-sm" onClick={() => setPanel({ kind: 'create' })}>
            Add Action
          </button>
        )}
      </div>

      {!isStaff && <p className="text-muted small">These are the steps IT has taken on your ticket.</p>}
      {isStaff && locked && (
        <div className="alert alert-secondary small py-2" role="note">
          Actions are locked while the ticket is Resolved, Closed or Cancelled — reopen it to add actions.
        </div>
      )}

      {isStaff && panel.kind === 'create' && (
        <ActionForm
          mode="create"
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          staffMembers={staffMembers}
          ticketId={ticketId}
          onSaved={afterSave}
          onCancel={() => setPanel({ kind: 'none' })}
        />
      )}

      {isLoading && (
        <div className="text-center py-3" aria-busy="true">
          <div className="spinner-border spinner-border-sm text-zen-primary" role="status">
            <span className="visually-hidden">Loading actions…</span>
          </div>
        </div>
      )}

      {!isLoading && loadError && (
        <div className="alert alert-danger small" role="alert">
          Could not load the actions.{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => { setIsLoading(true); load(); }}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !loadError && items.length === 0 && <p className="text-muted small mb-0">No actions recorded yet.</p>}
      {rowError && (
        <div className="alert alert-danger small py-2" role="alert">
          {rowError}
        </div>
      )}

      {!isLoading && !loadError && items.length > 0 && (
        <>
          {/* Desktop table (≥ 768px) */}
          <div className="table-responsive d-none d-md-block" data-testid="actions-table">
            <table className="table table-sm align-top mb-0">
              <thead>
                <tr>
                  <th scope="col">Date/time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Follow-up</th>
                  <th scope="col">Attachment notes</th>
                  {isStaff && <th scope="col"><span className="visually-hidden">Open</span></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td className="text-nowrap small">{formatDateTime(a.actionAt)}</td>
                    <td style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.description}</td>
                    <td style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.result ?? <span className="text-muted">—</span>}</td>
                    <td><ActionStatusBadge status={a.status} /></td>
                    <td>{assigneeCell(a)}</td>
                    <td><FollowUp item={a} /></td>
                    <td style={{ overflowWrap: 'anywhere' }}>{a.attachmentNotes ?? <span className="text-muted">—</span>}</td>
                    {isStaff && (
                      <td>
                        <button type="button" className="btn btn-sm btn-zen-outline" aria-label={`View action ${a.id}`} onClick={() => { setRowError(null); setPanel({ kind: 'view', id: a.id }); }}>
                          View
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (< 768px) */}
          <div className="d-md-none d-flex flex-column gap-2" data-testid="actions-cards">
            {items.map((a) => (
              <div key={a.id} className="p-3 rounded border bg-white">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span className="text-muted small">{formatDateTime(a.actionAt)}</span>
                  <ActionStatusBadge status={a.status} />
                </div>
                <div className="mb-2" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.description}</div>
                <dl className="small mb-0">
                  <dt>Result</dt>
                  <dd style={{ overflowWrap: 'anywhere' }}>{a.result ?? '—'}</dd>
                  <dt>Assignee</dt>
                  <dd>{assigneeCell(a)}</dd>
                  <dt>Follow-up</dt>
                  <dd><FollowUp item={a} /></dd>
                  <dt>Attachment notes</dt>
                  <dd style={{ overflowWrap: 'anywhere' }}>{a.attachmentNotes ?? '—'}</dd>
                </dl>
                {isStaff && (
                  <button type="button" className="btn btn-sm btn-zen-outline mt-2" aria-label={`View action ${a.id} (card)`} onClick={() => { setRowError(null); setPanel({ kind: 'view', id: a.id }); }}>
                    View
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {isStaff && panel.kind === 'view' && selected && (
        <section className="p-3 rounded border bg-white mt-3" role="region" aria-label="Action details">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Action #{selected.id}</strong>
            <ActionStatusBadge status={selected.status} />
          </div>
          <dl className="small mb-3">
            <dt>Date/time</dt>
            <dd>{formatDateTime(selected.actionAt)}</dd>
            <dt>Description</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{selected.description}</dd>
            <dt>Result</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{selected.result ?? '—'}</dd>
            <dt>Assignee</dt>
            <dd>{assigneeCell(selected)}</dd>
            {selected.updatedBy && (
              <>
                <dt>Last edited by</dt>
                <dd>{selected.updatedBy.name}</dd>
              </>
            )}
            <dt>Follow-up</dt>
            <dd><FollowUp item={selected} /></dd>
            <dt>Attachment notes</dt>
            <dd>{selected.attachmentNotes ?? '—'}</dd>
          </dl>
          {NEXT_STATUSES[selected.status].length === 0 ? (
            <p className="text-muted small mb-2">This action is locked ({STATUS_LABEL[selected.status].toLowerCase()}). Record a new action to add more.</p>
          ) : locked ? (
            <p className="text-muted small mb-2">The ticket is locked, so this action cannot be changed.</p>
          ) : (
            <div className="d-flex flex-wrap gap-2 mb-2">
              <button type="button" className="btn btn-sm btn-zen-primary" onClick={() => setPanel({ kind: 'edit', id: selected.id })}>
                Edit
              </button>
              {selected.status === 'PLANNED' && (
                <button type="button" className="btn btn-sm btn-zen-outline" disabled={rowBusy} onClick={() => patchStatus(selected, 'IN_PROGRESS')}>
                  Start
                </button>
              )}
              <button type="button" className="btn btn-sm btn-zen-outline" onClick={() => setPanel({ kind: 'edit', id: selected.id, status: 'COMPLETED' })}>
                Complete
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" disabled={rowBusy} onClick={() => patchStatus(selected, 'CANCELLED')}>
                Cancel action
              </button>
            </div>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPanel({ kind: 'none' })}>
            Close
          </button>
        </section>
      )}

      {isStaff && panel.kind === 'edit' && selected && (
        <div className="mt-3">
          <ActionForm
            key={`${selected.id}-${panel.status ?? 'edit'}`}
            mode="edit"
            item={selected}
            initialStatus={panel.status}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            staffMembers={staffMembers}
            ticketId={ticketId}
            onSaved={afterSave}
            onCancel={() => setPanel({ kind: 'view', id: selected.id })}
          />
        </div>
      )}
    </div>
  );
};
