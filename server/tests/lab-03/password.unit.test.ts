import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, meetsPasswordPolicy } from "../../src/utils/password.js";

describe("Password utility (UNIT-01, UNIT-02)", () => {
  it("UNIT-01a: hashPassword never returns the plaintext, and produces a bcrypt-format hash", () => {
    const hash = hashPassword("SomePassword123");
    expect(hash).not.toBe("SomePassword123");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("UNIT-01b: verifyPassword succeeds only for the correct plaintext (BR-12)", () => {
    const hash = hashPassword("CorrectHorse123");
    expect(verifyPassword("CorrectHorse123", hash)).toBe(true);
    expect(verifyPassword("WrongPassword123", hash)).toBe(false);
  });

  it("UNIT-01c: two hashes of the same password are not identical (salted)", () => {
    const a = hashPassword("SamePassword123");
    const b = hashPassword("SamePassword123");
    expect(a).not.toBe(b);
    expect(verifyPassword("SamePassword123", a)).toBe(true);
    expect(verifyPassword("SamePassword123", b)).toBe(true);
  });

  it.each([
    ["short1", false, "under 8 characters"],
    ["nodigitshere", false, "no digit"],
    ["12345678", false, "no letter"],
    ["ValidPass1", true, "letter + digit, 8+ chars"],
    ["exactly8a", true, "exactly 9 characters, letter + digit"],
  ])("UNIT-02: meetsPasswordPolicy(%s) === %s (%s)", (candidate, expected) => {
    expect(meetsPasswordPolicy(candidate)).toBe(expected);
  });
});
