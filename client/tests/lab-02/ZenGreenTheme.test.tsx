import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("STYLE-01: Zen Green Design System & Tokens Verification", () => {
  const cssPath = path.resolve(__dirname, "../../src/index.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  it("defines the mandatory Zen Green color tokens in :root", () => {
    expect(cssContent).toContain("--color-primary-green: #006B3C");
    expect(cssContent).toContain("--color-secondary-green: #0B7A46");
    expect(cssContent).toContain("--color-pale-green: #EAF6EF");
    expect(cssContent).toContain("--color-bg-page: #F5F7F6");
  });

  it("defines primary and secondary button hierarchy classes", () => {
    expect(cssContent).toContain(".btn-zen-primary");
    expect(cssContent).toContain(".btn-zen-secondary");
  });

  it("defines field error and read-only state rules", () => {
    expect(cssContent).toContain(".form-control.read-only");
    expect(cssContent).toContain(".input-error");
    expect(cssContent).toContain(".text-danger");
  });

  it("includes mobile responsive layout rules for viewports < 768px", () => {
    expect(cssContent).toContain("@media (max-width: 767px)");
  });
});
