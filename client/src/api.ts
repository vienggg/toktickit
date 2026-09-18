const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) throw new Error("Health check failed");
  // Fixed in review (PR #65): /api/categories has required authentication
  // since I-4. This was unused in the app but would 401 silently the
  // moment it's reused, with no cookie attached to explain why.
  const catRes = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
  if (!catRes.ok) throw new Error("Failed to fetch categories");
  const categories: Category[] = await catRes.json();
  return { online: true, categories };
}

// Lab 3 (I-4): thin fetch wrapper defaulting to credentials: 'include' —
// required for the httpOnly session cookie (D-01) to be sent with every
// request. Every component fetch call for the authenticated app goes
// through this instead of raw fetch().
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { ...init, credentials: "include" });
}

export interface ApiError {
  code?: string;
  message: string;
}

/**
 * Extracts the displayable message AND (when present) the error `code`
 * from either the Lab 3 `{error:{code,message}}` shape or the older Lab 2
 * `{error: string}` shape. `parseApiError` below is a thin wrapper around
 * this for the common case where only the message is needed — callers that
 * need to branch on the error code (e.g. UserManagement's BR-27/BR-28
 * inline blocking-message UI) should use this instead of duplicating the
 * body-parsing logic themselves.
 */
export async function parseApiErrorDetail(res: Response, fallback: string): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  if (!body) return { message: fallback };
  if (typeof body.error === "string") return { message: body.error };
  if (body.error?.message) return { code: body.error.code, message: body.error.message };
  return { message: fallback };
}

/** Extracts a displayable message from either the Lab 3 {error:{code,message}} shape or the older Lab 2 {error: string} shape. */
export async function parseApiError(res: Response, fallback: string): Promise<string> {
  return (await parseApiErrorDetail(res, fallback)).message;
}
