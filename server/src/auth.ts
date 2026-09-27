import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";

// D-01 (docs/lab-03/specification.md §12): JWT (HS256) in an httpOnly,
// SameSite=Lax cookie, 2h expiry. Chosen because httpOnly eliminates the
// XSS token-theft class and SameSite=Lax covers CSRF without a separate
// token exchange. Accepted trade-off: a stateless JWT cannot be revoked
// server-side before it expires; logout clears the cookie client-side and
// the short expiry bounds the exposure window.
export const SESSION_COOKIE = "toktickit_session";
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly rather than silently signing with an empty/undefined
    // secret — a missing secret must never be treated as "no auth needed."
    throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env and set a value.");
  }
  return secret;
}

interface SessionClaims {
  userId: number;
}

export function issueSessionCookie(res: Response, userId: number): void {
  const token = jwt.sign({ userId } satisfies SessionClaims, getJwtSecret(), {
    expiresIn: "2h",
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
    // secure: true is intentionally omitted for local HTTP development;
    // a production deployment behind HTTPS should set this via NODE_ENV.
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

// Augment Express's Request type with the authenticated user, resolved
// fresh from the database on every request (see requireAuth) rather than
// trusted from the JWT payload, so isActive/role/mustChangePassword
// changes (e.g. an Administrator deactivating a user) take effect on the
// very next request instead of waiting for token expiry.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        name: string;
        email: string;
        department: string;
        role: Role;
        isActive: boolean;
        mustChangePassword: boolean;
      };
    }
  }
}

/**
 * Verifies the session cookie and attaches the current, DB-fresh user to
 * req.authUser. 401 if there is no valid session or the referenced user no
 * longer exists; 403 if the account has since been deactivated (BR-07 —
 * the account's existence was already proven by a previously-correct
 * credential, so this does not newly leak anything).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
  }

  let claims: SessionClaims;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload === "string" || typeof payload.userId !== "number") {
      throw new Error("Malformed session token payload.");
    }
    claims = { userId: payload.userId };
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Session is invalid or has expired." } });
  }

  const user = await getPrisma().user.findUnique({ where: { id: claims.userId } });
  if (!user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Session is invalid or has expired." } });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: { code: "ACCOUNT_INACTIVE", message: "This account has been deactivated." } });
  }

  req.authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    // Fixed in review: this was missing department, so GET /api/auth/me
    // (which returns req.authUser verbatim) silently dropped it on every
    // call except the one right after login (whose response is built from
    // safeUser() in app.ts, not requireAuth). Every client test happened
    // to hand-mock /api/auth/me with department already present, which is
    // why this didn't surface in the test suite.
    department: user.department,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
  next();
}

// D-12: applied globally to every /api/* route except the three that a
// user with an outstanding forced password change must still be able to
// reach. Decided here in I-3 (auth foundation), not left to individual
// route handlers or the client, per the handout's repeated "hiding a
// button is not authorization."
const PASSWORD_CHANGE_ALLOWLIST = new Set<string>([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
]);

export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    // requireAuth must run first; treat as unauthenticated rather than
    // silently allowing through.
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
  }
  if (req.authUser.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.has(req.path)) {
    return res.status(403).json({
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your password before continuing.",
      },
    });
  }
  next();
}

/** 403 if the authenticated user's role is not in the permitted set. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
    }
    if (!roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
    }
    next();
  };
}
