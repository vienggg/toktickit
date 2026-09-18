import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, parseApiError, parseApiErrorDetail } from '../api';
import { useDebouncedValue, usePaginatedFetch, useSavingAction } from '../hooks/usePaginatedFetch';

// I-8 (Issue #57): Administrator User Management. A single screen —
// list + modal forms, deliberately minimal per ui-spec.md §8: no
// pagination, no multi-column sort, no multiple simultaneous filters.
// Follows the same self-contained full-page layout (own header/logout,
// not the shared app-shell Navbar) established by StaffTicketQueue.tsx,
// since Navbar's role-specific navigation for non-Requester roles has not
// been built out in this codebase yet.

export type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

const ROLE_LABEL: Record<UserRole, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
};

const ROLE_BADGE_COLOR: Record<UserRole, string> = {
  REQUESTER: '#0B7A46',
  IT_STAFF: '#1D4ED8',
  ADMINISTRATOR: '#7C2D92',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="badge fw-semibold" style={{ backgroundColor: ROLE_BADGE_COLOR[role] }} data-testid="role-badge">
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`} data-testid="status-badge">
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

interface UserFormFields {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_FORM: UserFormFields = { name: '', email: '', role: 'REQUESTER', isActive: true, initialPassword: '' };

interface FieldErrors {
  name?: string;
  email?: string;
  role?: string;
  initialPassword?: string;
}

/** Maps a server error code to the field it belongs beneath, per ui-spec.md ("Duplicate-email and invalid-role errors render inline beneath the offending field"). */
function fieldErrorsFromCode(code: string | undefined, message: string): FieldErrors {
  if (code === 'DUPLICATE_EMAIL') return { email: message };
  if (code === 'VALIDATION_ERROR' && /role/i.test(message)) return { role: message };
  if (code === 'WEAK_PASSWORD') return { initialPassword: message };
  return {};
}

// Review item 7: Create User and Edit User were two fully separate modal
// components duplicating ~90% of the same form fields (name/email/role/
// isActive). This single parameterized modal covers both, driven by
// `mode`. The two modes still differ in real ways that this component
// preserves rather than papers over: Create has an Initial Password field
// and no way to change an existing password; Edit has neither of those in
// the main form, but can render arbitrary extra content below the shared
// fields (`extraContent`) — which UserManagement uses for the separate
// "Set New Initial Password" action and the BR-27/BR-28 blocked-message
// banner, neither of which apply to Create.
interface UserFormModalProps {
  mode: 'create' | 'edit';
  title: string;
  formState: UserFormFields;
  onChange: (patch: Partial<UserFormFields>) => void;
  fieldErrors: FieldErrors;
  /** Generic failure banner — suppressed whenever a field error or blockedMessage is already showing the reason. */
  bannerError?: string | null;
  /** BR-27/BR-28 safety-rule rejection message (edit mode only) — its own dedicated banner per ui-spec.md §8. */
  blockedMessage?: string | null;
  isSaving: boolean;
  submitLabel: string;
  savingLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  extraContent?: React.ReactNode;
}

function UserFormModal({
  mode,
  title,
  formState,
  onChange,
  fieldErrors,
  bannerError,
  blockedMessage,
  isSaving,
  submitLabel,
  savingLabel,
  onSubmit,
  onClose,
  extraContent,
}: UserFormModalProps) {
  const idPrefix = mode;

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form onSubmit={onSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              {blockedMessage && (
                <div className="alert alert-warning small py-2" data-testid="admin-safety-blocked-message">
                  {blockedMessage}
                </div>
              )}
              {bannerError && !blockedMessage && !Object.keys(fieldErrors).length && (
                <div className="alert alert-danger small py-2">{bannerError}</div>
              )}
              <div className="mb-3">
                <label htmlFor={`${idPrefix}-name`} className="form-label small fw-semibold">
                  Name
                </label>
                <input
                  id={`${idPrefix}-name`}
                  type="text"
                  className="form-control"
                  value={formState.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  required
                />
                {fieldErrors.name && <div className="text-danger small mt-1">{fieldErrors.name}</div>}
              </div>
              <div className="mb-3">
                <label htmlFor={`${idPrefix}-email`} className="form-label small fw-semibold">
                  Email
                </label>
                <input
                  id={`${idPrefix}-email`}
                  type="email"
                  className="form-control"
                  value={formState.email}
                  onChange={(e) => onChange({ email: e.target.value })}
                  required
                />
                {fieldErrors.email && <div className="text-danger small mt-1">{fieldErrors.email}</div>}
              </div>
              <div className="mb-3">
                <label htmlFor={`${idPrefix}-role`} className="form-label small fw-semibold">
                  Role
                </label>
                <select
                  id={`${idPrefix}-role`}
                  className="form-select"
                  value={formState.role}
                  onChange={(e) => onChange({ role: e.target.value as UserRole })}
                >
                  <option value="REQUESTER">Requester</option>
                  <option value="IT_STAFF">IT Staff</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
                {fieldErrors.role && <div className="text-danger small mt-1">{fieldErrors.role}</div>}
              </div>
              <div className="mb-3 form-check form-switch">
                <input
                  id={`${idPrefix}-active`}
                  type="checkbox"
                  className="form-check-input"
                  checked={formState.isActive}
                  onChange={(e) => onChange({ isActive: e.target.checked })}
                />
                <label htmlFor={`${idPrefix}-active`} className="form-check-label small fw-semibold">
                  Active
                </label>
              </div>
              {mode === 'create' && (
                <div className="mb-1">
                  <label htmlFor="create-password" className="form-label small fw-semibold">
                    Initial Password
                  </label>
                  <input
                    id="create-password"
                    type="password"
                    className="form-control"
                    value={formState.initialPassword}
                    onChange={(e) => onChange({ initialPassword: e.target.value })}
                    required
                  />
                  {fieldErrors.initialPassword && <div className="text-danger small mt-1">{fieldErrors.initialPassword}</div>}
                  <div className="form-text small">At least 8 characters, including a letter and a digit.</div>
                </div>
              )}
              {extraContent}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                {mode === 'create' ? 'Cancel' : 'Close'}
              </button>
              <button type="submit" className="btn btn-zen-primary btn-sm" disabled={isSaving}>
                {isSaving ? savingLabel : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const UserManagement: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');

  const fetchUsers = useCallback(
    async (signal: AbortSignal): Promise<AdminUser[]> => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (roleFilter !== 'All') params.append('role', roleFilter);
      const qs = params.toString();
      const res = await apiFetch(`/api/admin/users${qs ? `?${qs}` : ''}`, { signal });
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Unable to load users right now.'));
      }
      return res.json();
    },
    [debouncedSearch, roleFilter]
  );

  const { data: users, setData: setUsers, isLoading, error } = usePaginatedFetch<AdminUser[]>(fetchUsers, []);

  // Create User modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormFields>(EMPTY_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors>({});
  const createAction = useSavingAction();

  const openCreateModal = () => {
    setCreateForm(EMPTY_FORM);
    setCreateFieldErrors({});
    createAction.setError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFieldErrors({});
    await createAction.run(
      async () => {
        const res = await apiFetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createForm),
        });
        if (!res.ok) {
          const { code, message } = await parseApiErrorDetail(res, 'Failed to create user.');
          const fieldErrors = fieldErrorsFromCode(code, message);
          if (Object.keys(fieldErrors).length > 0) {
            setCreateFieldErrors(fieldErrors);
          }
          throw new Error(message);
        }
        const created: AdminUser = await res.json();
        setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setShowCreateModal(false);
      },
      'User created.',
      'Failed to create user.'
    );
  };

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormFields>(EMPTY_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editBlockedMessage, setEditBlockedMessage] = useState<string | null>(null);
  const editAction = useSavingAction();

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive, initialPassword: '' });
    setEditFieldErrors({});
    setEditBlockedMessage(null);
    editAction.setError(null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setPasswordConfirmStep(false);
    setNewInitialPassword('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFieldErrors({});
    setEditBlockedMessage(null);
    await editAction.run(
      async () => {
        const res = await apiFetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role, isActive: editForm.isActive }),
        });
        if (!res.ok) {
          const { code, message } = await parseApiErrorDetail(res, 'Failed to update user.');
          // BR-27/BR-28 safety-rule rejections (self-deactivation,
          // last-Administrator) surface as their own inline blocking
          // message rather than a generic failure banner or a field
          // error, per ui-spec.md §8.
          if (code === 'SELF_MODIFICATION_BLOCKED' || code === 'LAST_ADMINISTRATOR') {
            setEditBlockedMessage(message);
            throw new Error(message);
          }
          const fieldErrors = fieldErrorsFromCode(code, message);
          if (Object.keys(fieldErrors).length > 0) {
            setEditFieldErrors(fieldErrors);
          }
          throw new Error(message);
        }
        const updated: AdminUser = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setEditingUser(updated);
      },
      'User updated.',
      'Failed to update user.'
    );
  };

  // Set New Initial Password — its own confirmation step, since it forces
  // the target user's next login into Change Password (ui-spec.md §8).
  const [passwordConfirmStep, setPasswordConfirmStep] = useState(false);
  const [newInitialPassword, setNewInitialPassword] = useState('');
  const passwordAction = useSavingAction();

  const handleSetInitialPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await passwordAction.run(
      async () => {
        const res = await apiFetch(`/api/admin/users/${editingUser.id}/initial-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initialPassword: newInitialPassword }),
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res, 'Failed to set the new initial password.'));
        }
        setPasswordConfirmStep(false);
        setNewInitialPassword('');
      },
      'New initial password set. The user must change it at next login.',
      'Failed to set the new initial password.'
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="container-fluid py-3 px-3 px-lg-4" style={{ backgroundColor: 'var(--zen-neutral-light, #F5F7F6)', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0 fw-bold">🛡️ Administrator User Management</h4>
          <small className="text-muted">Signed in as {user?.name}</small>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-zen-primary" onClick={openCreateModal}>
            + Create User
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label htmlFor="user-search" className="form-label small fw-bold text-muted mb-1">
                SEARCH
              </label>
              <input
                id="user-search"
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-3">
              <label htmlFor="role-filter" className="form-label small fw-bold text-muted mb-1">
                ROLE
              </label>
              <select
                id="role-filter"
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'All' | UserRole)}
              >
                <option value="All">All</option>
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-4">
            <span className="spinner-border spinner-border-sm text-zen-primary" role="status" />
            <span className="ms-2 text-muted small">Loading users...</span>
          </div>
        </div>
      )}

      {!isLoading && !error && users.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <p className="text-muted mb-0">No users match your search.</p>
          </div>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="d-none d-md-block card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td className="font-monospace small">{u.email}</td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td>
                        <StatusBadge isActive={u.isActive} />
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEditModal(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="d-md-none d-flex flex-column gap-2">
            {users.map((u) => (
              <div key={u.id} className="card border-0 shadow-sm" data-testid="user-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="fw-semibold">{u.name}</span>
                    <StatusBadge isActive={u.isActive} />
                  </div>
                  <div className="text-muted small mb-2">{u.email}</div>
                  <div className="d-flex justify-content-between align-items-center">
                    <RoleBadge role={u.role} />
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEditModal(u)}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create User modal */}
      {showCreateModal && (
        <UserFormModal
          mode="create"
          title="Create User"
          formState={createForm}
          onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
          fieldErrors={createFieldErrors}
          bannerError={createAction.error}
          isSaving={createAction.isSaving}
          submitLabel="Create User"
          savingLabel="Creating..."
          onSubmit={handleCreateSubmit}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit User modal */}
      {editingUser && (
        <UserFormModal
          mode="edit"
          title="Edit User"
          formState={editForm}
          onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
          fieldErrors={editFieldErrors}
          bannerError={editAction.error}
          blockedMessage={editBlockedMessage}
          isSaving={editAction.isSaving}
          submitLabel="Save Changes"
          savingLabel="Saving..."
          onSubmit={handleEditSubmit}
          onClose={closeEditModal}
          extraContent={
            <>
              {editAction.success && <div className="alert alert-success small py-2">{editAction.success}</div>}
              <div className="border-top pt-3 mt-3">
                <h6 className="fw-bold small">Set New Initial Password</h6>
                {passwordAction.success && !passwordConfirmStep && (
                  <div className="alert alert-success small py-2">{passwordAction.success}</div>
                )}
                {!passwordConfirmStep ? (
                  <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setPasswordConfirmStep(true)}>
                    Set New Initial Password...
                  </button>
                ) : (
                  <div className="p-2 rounded border bg-light">
                    <p className="small text-muted mb-2">
                      This will force <strong>{editingUser.name}</strong> to change their password at next login. Confirm the new
                      initial password below.
                    </p>
                    {passwordAction.error && <div className="alert alert-danger small py-2">{passwordAction.error}</div>}
                    <input
                      type="password"
                      className="form-control mb-2"
                      placeholder="New initial password"
                      value={newInitialPassword}
                      onChange={(e) => setNewInitialPassword(e.target.value)}
                      aria-label="New initial password"
                    />
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-dark btn-sm"
                        disabled={passwordAction.isSaving || !newInitialPassword}
                        onClick={handleSetInitialPassword}
                      >
                        {passwordAction.isSaving ? 'Setting...' : 'Confirm New Password'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setPasswordConfirmStep(false);
                          setNewInitialPassword('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          }
        />
      )}
    </div>
  );
};
