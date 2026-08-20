import React, { useState, useEffect } from "react";
import { useDevRequester } from "../context/DevRequesterContext";
import { RequesterUser } from "../types";

export const DevRequesterModal: React.FC = () => {
  const {
    selectedRequester,
    requesters,
    loading,
    error,
    isModalOpen,
    selectRequester,
    closeModal,
    refreshRequesters
  } = useDevRequester();

  const [tempSelectedId, setTempSelectedId] = useState<number | "">(
    selectedRequester ? selectedRequester.id : ""
  );

  useEffect(() => {
    if (requesters.length > 0 && (tempSelectedId === "" || !requesters.some(r => r.id === Number(tempSelectedId)))) {
      setTempSelectedId(selectedRequester ? selectedRequester.id : requesters[0].id);
    }
  }, [requesters, selectedRequester]);

  if (!isModalOpen && selectedRequester) {
    return null;
  }

  const handleConfirm = () => {
    const targetId = tempSelectedId !== "" ? tempSelectedId : (requesters[0]?.id ?? "");
    const found = requesters.find((r) => r.id === Number(targetId));
    if (found) {
      selectRequester(found);
    }
  };

  return (
    <div className="modal-backdrop" data-testid="dev-requester-modal">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Select Development Requester</h2>
          {selectedRequester && (
            <button className="close-btn" onClick={closeModal} aria-label="Close modal">
              &times;
            </button>
          )}
        </div>

        <div className="notice-banner">
          <span className="notice-icon" aria-hidden="true">&#9432;</span>
          <p>
            <strong>Testing Environment:</strong> This selector simulates requester login for Lab 2
            to test multi-user ticket isolation and ownership. Real authentication will be implemented in Lab 3.
          </p>
        </div>

        {loading ? (
          <div className="loading-state" data-testid="loading-requesters">
            <div className="spinner" aria-hidden="true"></div>
            <p>Loading active development requesters...</p>
          </div>
        ) : error ? (
          <div className="error-state" data-testid="error-requesters">
            <p className="error-msg">⚠️ {error}</p>
            <button className="btn-zen-secondary btn-sm" onClick={refreshRequesters}>
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="modal-body">
            <label htmlFor="dev-requester-select" className="form-label">
              Active Requester Identity <span className="text-danger">*</span>
            </label>
            <select
              id="dev-requester-select"
              data-testid="requester-dropdown"
              className="form-control"
              value={tempSelectedId}
              onChange={(e) => setTempSelectedId(Number(e.target.value))}
            >
              {requesters.map((user: RequesterUser) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <small className="form-helper">
              Switching requester updates all displayed tickets and enforces ownership isolation.
            </small>
          </div>
        )}

        <div className="modal-footer">
          {selectedRequester && (
            <button className="btn-zen-secondary" onClick={closeModal}>
              Cancel
            </button>
          )}
          <button
            className="btn-zen-primary"
            data-testid="confirm-requester-btn"
            disabled={loading || !!error || requesters.length === 0}
            onClick={handleConfirm}
          >
            Continue as Requester
          </button>
        </div>
      </div>
    </div>
  );
};
