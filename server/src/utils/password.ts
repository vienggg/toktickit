import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

/** BR-12: passwords are never stored or transmitted in plaintext. */
export function hashPassword(plaintext: string): string {
  return bcrypt.hashSync(plaintext, BCRYPT_COST);
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  return bcrypt.compareSync(plaintext, hash);
}

/** BR-09: at least 8 characters, at least one letter, at least one digit. */
export function meetsPasswordPolicy(candidate: string): boolean {
  return candidate.length >= 8 && /[A-Za-z]/.test(candidate) && /\d/.test(candidate);
}
