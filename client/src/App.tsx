import React, { useState } from "react";
import { DevRequesterProvider } from "./context/DevRequesterContext";
import { Navbar } from "./components/Navbar";
import { DevRequesterModal } from "./components/DevRequesterModal";
import "./index.css";

export function AppContent() {
  const [activeTab, setActiveTab] = useState<"create" | "my-tickets">("create");

  return (
    <div className="app-layout">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content" style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px" }}>
        {activeTab === "create" ? (
          <div data-testid="create-ticket-tab">
            <h1 className="h2 mb-3" style={{ color: "var(--color-primary-green)", fontSize: "1.75rem", fontWeight: 700 }}>
              Create New Support Ticket
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
              Submit an IT support request to the TokTickIT Service Desk.
            </p>
            {/* Create Ticket form component will be mounted here in Issue 4 */}
          </div>
        ) : (
          <div data-testid="my-tickets-tab">
            <h1 className="h2 mb-3" style={{ color: "var(--color-primary-green)", fontSize: "1.75rem", fontWeight: 700 }}>
              My Tickets
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
              Track and manage support tickets submitted under your requester account.
            </p>
            {/* My Tickets list component will be mounted here in Issue 5 */}
          </div>
        )}
      </main>
      <DevRequesterModal />
    </div>
  );
}

export default function App() {
  return (
    <DevRequesterProvider>
      <AppContent />
    </DevRequesterProvider>
  );
}
