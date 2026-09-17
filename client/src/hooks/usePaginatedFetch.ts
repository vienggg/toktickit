import { useCallback, useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../api';

// Extracted in review of PR #67 (item 4): MyTickets.tsx and
// StaffTicketQueue.tsx each hand-rolled the same 300ms search debounce,
// the same categories-dropdown fetch effect, and the same
// fetch/loading/error request shape — and had already started to drift
// (StaffTicketQueue didn't use parseApiError like MyTickets did). These
// three hooks are the shared core; each screen still owns its own filter
// state, query-string construction, and response shape.

/** Debounces a rapidly-changing value (e.g. a search box) by `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface CategoryOption {
  id: number;
  name: string;
}

/** Loads the shared /api/categories dropdown list. Non-fatal on failure — the filter simply stays empty. */
export function useCategoryOptions(): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadCategories() {
      try {
        const res = await apiFetch('/api/categories', { signal: controller.signal });
        if (res.ok) setCategories(await res.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load categories:', err);
        }
      }
    }
    loadCategories();
    return () => controller.abort();
  }, []);
  return categories;
}

/**
 * Generic "fetch a paginated list, track loading/error" state machine.
 * `fetchPage` receives an AbortSignal and must return the parsed response
 * body; it should throw (with a message from `parseApiError`) on a
 * non-ok response. Re-runs whenever `fetchPage` itself changes identity,
 * so callers should wrap it in `useCallback` with their filter/sort/page
 * state as dependencies (mirroring the previous per-component pattern).
 */
export function usePaginatedFetch<T>(fetchPage: (signal: AbortSignal) => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchPage(controller.signal);
        setData(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Unable to load data right now.');
        }
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  return { data, setData, isLoading, error, setError } as const;
}

export { parseApiError };

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
