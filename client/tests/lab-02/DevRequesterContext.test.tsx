import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevRequesterProvider } from "../../src/context/DevRequesterContext";
import { DevRequesterModal } from "../../src/components/DevRequesterModal";
import { Navbar } from "../../src/components/Navbar";

const mockRequesters = [
  { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.local", isActive: true },
  { id: 2, name: "Michael Brown", email: "michael.brown@toktickit.local", isActive: true }
];

describe("UI-01 & UI-02: DevRequesterContext and Modal Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("UI-01: loads active requesters and displays selection modal when none selected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockRequesters
    } as Response);

    render(
      <DevRequesterProvider>
        <DevRequesterModal />
      </DevRequesterProvider>
    );

    // Initial loading state
    expect(screen.getByTestId("loading-requesters")).toBeDefined();

    // After data loads
    await waitFor(() => {
      expect(screen.getByTestId("requester-dropdown")).toBeDefined();
    });

    const dropdown = screen.getByTestId("requester-dropdown") as HTMLSelectElement;
    expect(dropdown.children.length).toBe(2);
    expect(screen.getByText(/Jennifer Anderson/)).toBeDefined();
    expect(screen.getByText(/Michael Brown/)).toBeDefined();
  });

  it("UI-02: updates active requester in navbar and persists to localStorage on selection", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockRequesters
    } as Response);

    const TestComponent = () => {
      const [tab, setTab] = React.useState<"create" | "my-tickets">("create");
      return (
        <>
          <Navbar activeTab={tab} onTabChange={setTab} />
          <DevRequesterModal />
        </>
      );
    };

    render(
      <DevRequesterProvider>
        <TestComponent />
      </DevRequesterProvider>
    );

    // Wait for dropdown in modal
    await waitFor(() => {
      expect(screen.getByTestId("confirm-requester-btn")).toBeDefined();
    });

    // Select Jennifer Anderson
    const confirmBtn = screen.getByTestId("confirm-requester-btn");
    fireEvent.click(confirmBtn);

    // Verify navbar displays Jennifer Anderson
    await waitFor(() => {
      expect(screen.getByTestId("active-user-name").textContent).toBe("Jennifer Anderson");
    });

    // Click "Change Requester" button in navbar
    const changeBtn = screen.getByTestId("change-requester-btn");
    fireEvent.click(changeBtn);

    // Modal should re-open
    expect(screen.getByTestId("dev-requester-modal")).toBeDefined();

    // Select Michael Brown
    const dropdown = screen.getByTestId("requester-dropdown");
    fireEvent.change(dropdown, { target: { value: "2" } });

    // Click confirm
    const confirmBtn2 = screen.getByTestId("confirm-requester-btn");
    fireEvent.click(confirmBtn2);

    // Verify navbar displays Michael Brown
    await waitFor(() => {
      expect(screen.getByTestId("active-user-name").textContent).toBe("Michael Brown");
    });

    // Verify localStorage has Michael Brown
    const stored = JSON.parse(localStorage.getItem("toktickit_dev_requester") || "{}");
    expect(stored.id).toBe(2);
    expect(stored.name).toBe("Michael Brown");
  });

  it("handles API failure gracefully with error alert and retry button", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network Error"));

    render(
      <DevRequesterProvider>
        <DevRequesterModal />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error-requesters")).toBeDefined();
    });

    expect(screen.getByText(/Network Error/)).toBeDefined();
    expect(screen.getByText(/Retry Connection/)).toBeDefined();
  });
});
