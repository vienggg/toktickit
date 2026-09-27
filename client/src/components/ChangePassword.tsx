import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, parseApiError } from '../api';

function checkRule(value: string, test: (v: string) => boolean) {
  return test(value);
}

export const ChangePassword: React.FC = () => {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rules = [
    { label: 'At least 8 characters', met: checkRule(newPassword, (v) => v.length >= 8) },
    { label: 'Contains a letter', met: checkRule(newPassword, (v) => /[A-Za-z]/.test(v)) },
    { label: 'Contains a digit', met: checkRule(newPassword, (v) => /\d/.test(v)) },
    { label: 'Matches confirmation', met: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!rules.every((r) => r.met)) {
      setErrorMessage('Please satisfy all password requirements before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!res.ok) {
        setErrorMessage(await parseApiError(res, 'Unable to change your password right now.'));
        return;
      }
      await refreshUser();
      navigate('/', { replace: true });
    } catch {
      setErrorMessage('Unable to reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center px-3"
      style={{ backgroundColor: 'var(--zen-neutral-light, #F5F7F6)' }}
    >
      <div className="card border-0 shadow-sm bg-white w-100" style={{ maxWidth: 440, borderRadius: '1rem' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <h4 className="fw-bold mb-1">Change Your Password</h4>
            <p className="text-muted small mb-0">
              For security, you must set a new password before continuing.
            </p>
          </div>

          {errorMessage && (
            <div className="alert alert-danger py-2 small" role="alert">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="current-password" className="form-label fw-semibold">
                Current Password
              </label>
              <input
                type="password"
                id="current-password"
                className="form-control"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label htmlFor="new-password" className="form-label fw-semibold">
                New Password
              </label>
              <input
                type="password"
                id="new-password"
                className="form-control"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="confirm-password" className="form-label fw-semibold">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirm-password"
                className="form-control"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <ul className="list-unstyled small mb-4">
              {rules.map((rule) => (
                <li key={rule.label} className={rule.met ? 'text-success' : 'text-muted'}>
                  {rule.met ? '✅' : '⬜'} {rule.label}
                </li>
              ))}
            </ul>

            <button
              type="submit"
              className="btn btn-zen-primary w-100 d-flex align-items-center justify-content-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Saving...</span>
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
