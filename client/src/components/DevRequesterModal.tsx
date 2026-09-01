import React from 'react';
import { useDevRequester, Requester } from '../context/DevRequesterContext';

export const DevRequesterModal: React.FC = () => {
  const { isModalOpen, setIsModalOpen, requesters, currentRequester, setCurrentRequester, isLoading, error } =
    useDevRequester();

  if (!isModalOpen) return null;

  const handleSelect = (req: Requester) => {
    setCurrentRequester(req);
    setIsModalOpen(false);
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="devRequesterModalLabel"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(2px)' }}
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
          <div
            className="modal-header border-0 px-4 pt-4 pb-2"
            style={{ backgroundColor: 'var(--zen-light-tint)' }}
          >
            <div>
              <h5 className="modal-title fw-bold text-zen-primary" id="devRequesterModalLabel">
                👤 Simulated Requester Login
              </h5>
              <p className="text-muted small mb-0 mt-1">
                Select an active employee identity for testing permissions and ticket isolation.
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close modal"
              onClick={() => setIsModalOpen(false)}
            ></button>
          </div>

          <div className="modal-body p-4">
            {isLoading && (
              <div className="text-center py-4">
                <div className="spinner-border text-zen-primary" role="status">
                  <span className="visually-hidden">Loading users...</span>
                </div>
                <p className="text-muted small mt-2">Loading active requesters from database...</p>
              </div>
            )}

            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                <strong>Error:</strong> {error}
              </div>
            )}

            {!isLoading && !error && (
              <div className="list-group list-group-flush gap-2">
                {requesters.map((req) => {
                  const isSelected = currentRequester?.id === req.id;
                  return (
                    <button
                      key={req.id}
                      type="button"
                      className={`list-group-item list-group-item-action p-3 rounded border text-start d-flex justify-content-between align-items-center transition ${
                        isSelected ? 'border-success bg-zen-light shadow-sm' : 'border-light-subtle'
                      }`}
                      onClick={() => handleSelect(req)}
                    >
                      <div>
                        <div className="fw-semibold text-dark">
                          {req.name} {isSelected && <span className="badge badge-zen ms-1">Active Context</span>}
                        </div>
                        <div className="small text-muted">{req.email}</div>
                        <div className="small text-secondary mt-1">
                          🏢 Department: <strong>{req.department}</strong>
                        </div>
                      </div>
                      <div>
                        <span
                          className={`btn btn-sm ${
                            isSelected ? 'btn-zen-primary' : 'btn-outline-secondary'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Switch'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer border-top px-4 py-3 bg-light d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-3"
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
