import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import App from "../../src/App";
import * as api from "../../src/api";

describe("App & Lab 1 API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the TokTickIT brand and navigation", () => {
    render(<App />);
    const brandElements = screen.getAllByText(/TokTickIT/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });

  it("checkSystem returns online and categories on success", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/health")) {
        return { ok: true, json: async () => ({ status: "ok" }) } as Response;
      }
      if (urlStr.includes("/api/categories")) {
        return {
          ok: true,
          json: async () => [
            { id: 1, name: "Account and Access" },
            { id: 2, name: "Hardware" },
            { id: 3, name: "Software" },
            { id: 4, name: "Network" },
          ],
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await api.checkSystem();
    expect(result.online).toBe(true);
    expect(result.categories).toHaveLength(4);
    expect(result.categories[0].name).toBe("Account and Access");
  });

  it("checkSystem throws an error when health check fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(api.checkSystem()).rejects.toThrow("Health check failed");
  });
});

