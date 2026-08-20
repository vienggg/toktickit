import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevRequesterProvider } from "../../src/context/DevRequesterContext";
import { TicketDetail } from "../../src/components/TicketDetail";

const mockRequester = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@toktickit.local",
  isActive: true
};

const mockCategories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" }
];

const mockSystems = [
  { id: 1, name: "Email", isActive: true },
  { id: 2, name: "Campus Wi-Fi", isActive: true }
];

const mockTicket = {
  id: 101,
  ticketNumber: "TKT-2026-000101",
  summary: "MacBook charging port defect",
  description: "MagSafe LED does not turn on and battery is not charging.",
  requestedPriority: "HIGH",
  currentStatus: "New",
  createdAt: "2026-08-20T10:00:00.000Z",
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 1,
  requester: mockRequester,
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 1, name: "Corporate Laptop" },
  attachments: [
    {
      id: 501,
      fileName: "battery-report.pdf",
      fileSize: 204800,
      mimeType: "application/pdf",
      isRemoved: false,
      createdAt: "2026-08-20T10:00:00.000Z"
    }
  ]
};

describe("UI-07 & UI-08: TicketDetail Component Tests", () => {
  beforeEach(() => {
    localStorage.setItem("toktickit_dev_requester", JSON.stringify(mockRequester));
    vi.restoreAllMocks();

    vi.spyOn(global, "fetch").mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/tickets/101") && (!init || init.method === "GET")) {
        return { ok: true, json: async () => mockTicket } as Response;
      }
      if (urlStr.includes("/api/categories")) {
        return { ok: true, json: async () => mockCategories } as Response;
      }
      if (urlStr.includes("/api/systems")) {
        return { ok: true, json: async () => mockSystems } as Response;
      }
      if (urlStr.includes("/api/dev/requesters")) {
        return { ok: true, json: async () => [mockRequester] } as Response;
      }
      if (urlStr.includes("/api/tickets/101") && init?.method === "PUT") {
        const body = JSON.parse(init.body as string);
        return {
          ok: true,
          json: async () => ({
            ...mockTicket,
            summary: body.summary,
            description: body.description,
            requestedPriority: body.requestedPriority
          })
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it("UI-07: renders ticket detail view mode with metadata, summary, description, and attachments", async () => {
    const handleBack = vi.fn();
    render(
      <DevRequesterProvider>
        <TicketDetail ticketId={101} onBack={handleBack} />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-ticket-number").textContent).toBe("TKT-2026-000101");
    });

    expect(screen.getByTestId("detail-summary-display").textContent).toBe("MacBook charging port defect");
    expect(screen.getByTestId("detail-description-display").textContent).toContain("MagSafe LED");
    expect(screen.getByText("battery-report.pdf")).toBeDefined();
    expect(screen.getByTestId("download-att-501")).toBeDefined();
    expect(screen.getByTestId("remove-att-501")).toBeDefined();
  });

  it("UI-08: switches to edit mode, allows updating fields, and saves modifications", async () => {
    const handleBack = vi.fn();
    render(
      <DevRequesterProvider>
        <TicketDetail ticketId={101} onBack={handleBack} />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("edit-ticket-btn")).toBeDefined();
    });

    // Click Edit button
    fireEvent.click(screen.getByTestId("edit-ticket-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("edit-ticket-form")).toBeDefined();
    });

    const summaryInput = screen.getByTestId("edit-summary-input");
    fireEvent.change(summaryInput, { target: { value: "Updated MacBook Charger Defect Summary" } });

    const saveBtn = screen.getByTestId("save-edit-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("save-success-banner")).toBeDefined();
      expect(screen.getByTestId("detail-summary-display").textContent).toBe("Updated MacBook Charger Defect Summary");
    });
  });
});
