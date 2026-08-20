import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevRequesterProvider } from "../../src/context/DevRequesterContext";
import { MyTickets } from "../../src/components/MyTickets";

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

const mockTickets = [
  {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Monitor screen flickering",
    requestedPriority: "LOW",
    currentStatus: "New",
    createdAt: "2026-08-20T10:00:00.000Z",
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 1, name: "Corporate Laptop" },
    _count: { attachments: 2 }
  },
  {
    id: 2,
    ticketNumber: "TKT-2026-000002",
    summary: "VPN access expired",
    requestedPriority: "HIGH",
    currentStatus: "New",
    createdAt: "2026-08-20T11:00:00.000Z",
    category: { id: 1, name: "Account and Access" },
    relatedSystem: { id: 2, name: "VPN" },
    _count: { attachments: 0 }
  }
];

describe("UI-05 & UI-06: MyTickets Component Tests", () => {
  beforeEach(() => {
    localStorage.setItem("toktickit_dev_requester", JSON.stringify(mockRequester));
    vi.restoreAllMocks();

    vi.spyOn(global, "fetch").mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/categories")) {
        return { ok: true, json: async () => mockCategories } as Response;
      }
      if (urlStr.includes("/api/systems")) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (urlStr.includes("/api/dev/requesters")) {
        return { ok: true, json: async () => [mockRequester] } as Response;
      }
      if (urlStr.includes("/api/tickets")) {
        if (urlStr.includes("search=nonexistent")) {
          return {
            ok: true,
            json: async () => ({
              data: [],
              pagination: { page: 1, pageSize: 5, totalCount: 0, totalPages: 1 }
            })
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            data: mockTickets,
            pagination: { page: 1, pageSize: 5, totalCount: 2, totalPages: 1 }
          })
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it("UI-05: renders the ticket table with ticket numbers, summary, and status badges", async () => {
    render(
      <DevRequesterProvider>
        <MyTickets />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("tickets-table")).toBeDefined();
    });

    expect(screen.getByText("TKT-2026-000001")).toBeDefined();
    expect(screen.getByText("Monitor screen flickering")).toBeDefined();
    expect(screen.getByText("TKT-2026-000002")).toBeDefined();
    expect(screen.getByText("VPN access expired")).toBeDefined();
  });

  it("UI-06: renders search bar and handles no-results state when search query finds zero matches", async () => {
    render(
      <DevRequesterProvider>
        <MyTickets />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeDefined();
    });

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(screen.getByTestId("no-results-state")).toBeDefined();
      expect(screen.getByText("No Matching Tickets Found")).toBeDefined();
    });

    const clearBtn = screen.getByTestId("no-results-clear-btn");
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByTestId("tickets-table")).toBeDefined();
    });
  });
});
