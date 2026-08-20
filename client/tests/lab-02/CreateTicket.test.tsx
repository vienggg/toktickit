import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevRequesterProvider } from "../../src/context/DevRequesterContext";
import { CreateTicket } from "../../src/components/CreateTicket";

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

describe("UI-03 & UI-04: CreateTicket Component Tests", () => {
  beforeEach(() => {
    localStorage.setItem("toktickit_dev_requester", JSON.stringify(mockRequester));
    vi.restoreAllMocks();

    vi.spyOn(global, "fetch").mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/categories")) {
        return { ok: true, json: async () => mockCategories } as Response;
      }
      if (urlStr.includes("/api/systems")) {
        return { ok: true, json: async () => mockSystems } as Response;
      }
      if (urlStr.includes("/api/dev/requesters")) {
        return { ok: true, json: async () => [mockRequester] } as Response;
      }
      if (urlStr.includes("/api/tickets")) {
        return {
          ok: true,
          json: async () => ({
            id: 10,
            ticketNumber: "TKT-2026-000010",
            summary: "VPN is disconnecting constantly",
            description: "Connection drops every 5 minutes during remote work.",
            requestedPriority: "HIGH",
            currentStatus: "New",
            requesterId: 1,
            categoryId: 1,
            relatedSystemId: 1,
            attachments: []
          })
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it("UI-03: displays pre-populated locked requester and loaded reference dropdowns", async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      const requesterInput = screen.getByTestId("locked-requester-input") as HTMLInputElement;
      expect(requesterInput.value).toContain("Jennifer Anderson");
      expect(requesterInput.readOnly).toBe(true);
    });

    const categorySelect = screen.getByTestId("category-select") as HTMLSelectElement;
    expect(categorySelect.children.length).toBe(2);

    const systemSelect = screen.getByTestId("system-select") as HTMLSelectElement;
    expect(systemSelect.children.length).toBe(2);
  });

  it("UI-04: displays field-level validation errors directly beneath invalid inputs", async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("submit-ticket-btn")).toBeDefined();
    });

    const submitBtn = screen.getByTestId("submit-ticket-btn");
    fireEvent.click(submitBtn);

    // Assert validation error messages appear
    expect(screen.getByText("Summary is required.")).toBeDefined();
    expect(screen.getByText("Description is required.")).toBeDefined();
  });

  it("handles successful ticket creation with generated ticket number banner", async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("summary-input")).toBeDefined();
    });

    fireEvent.change(screen.getByTestId("summary-input"), {
      target: { value: "VPN is disconnecting constantly" }
    });
    fireEvent.change(screen.getByTestId("description-input"), {
      target: { value: "Connection drops every 5 minutes during remote work." }
    });

    const submitBtn = screen.getByTestId("submit-ticket-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("ticket-success-card")).toBeDefined();
      expect(screen.getByTestId("created-ticket-number").textContent).toBe("TKT-2026-000010");
    });
  });

  it("rejects invalid attachment formats on file selection", async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-input")).toBeDefined();
    });

    const fileInput = screen.getByTestId("file-upload-input");
    const badFile = new File(["binary"], "malware.exe", { type: "application/x-msdownload" });

    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByTestId("attachment-error-msg")).toBeDefined();
      expect(screen.getByText(/not a supported format/)).toBeDefined();
    });
  });
});
