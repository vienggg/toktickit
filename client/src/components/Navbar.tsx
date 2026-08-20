import React from "react";
import { useDevRequester } from "../context/DevRequesterContext";

interface NavbarProps {
  activeTab: "create" | "my-tickets";
  onTabChange: (tab: "create" | "my-tickets") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { selectedRequester, openModal } = useDevRequester();

  return (
    <header className="navbar-header" data-testid="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <span className="brand-logo" aria-hidden="true">🎫</span>
          <span className="brand-title">TokTickIT</span>
          <span className="badge-pill dev-badge">Requester Portal</span>
        </div>

        <nav className="navbar-nav" aria-label="Main Navigation">
          <button
            className={`nav-link-btn ${activeTab === "create" ? "active" : ""}`}
            onClick={() => onTabChange("create")}
            data-testid="nav-create-ticket"
          >
            Create Ticket
          </button>
          <button
            className={`nav-link-btn ${activeTab === "my-tickets" ? "active" : ""}`}
            onClick={() => onTabChange("my-tickets")}
            data-testid="nav-my-tickets"
          >
            My Tickets
          </button>
        </nav>

        <div className="navbar-user-section" data-testid="navbar-user-section">
          {selectedRequester ? (
            <div className="user-profile-badge">
              <span className="user-avatar" aria-hidden="true">👤</span>
              <div className="user-info">
                <span className="user-name" data-testid="active-user-name">
                  {selectedRequester.name}
                </span>
                <span className="user-email">{selectedRequester.email}</span>
              </div>
              <button
                className="btn-change-user"
                onClick={openModal}
                data-testid="change-requester-btn"
                title="Switch simulated requester"
              >
                Change Requester
              </button>
            </div>
          ) : (
            <button className="btn-zen-secondary btn-sm" onClick={openModal}>
              Select Requester
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
