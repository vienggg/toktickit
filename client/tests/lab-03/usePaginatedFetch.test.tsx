import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePaginatedFetch } from '../../src/hooks/usePaginatedFetch';

describe('usePaginatedFetch refresh', () => {
  it('ignores an older list response after a post-write refresh', async () => {
    let resolveOld!: (value: string[]) => void;
    let resolveFresh!: (value: string[]) => void;
    const oldResponse = new Promise<string[]>((resolve) => { resolveOld = resolve; });
    const freshResponse = new Promise<string[]>((resolve) => { resolveFresh = resolve; });
    const fetchPage = vi.fn()
      .mockImplementationOnce(() => oldResponse)
      .mockImplementationOnce(() => freshResponse);

    const { result } = renderHook(() => usePaginatedFetch(fetchPage, [] as string[]));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

    act(() => result.current.refresh());
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[0][0].aborted).toBe(true);

    await act(async () => resolveFresh(['new account']));
    await waitFor(() => expect(result.current.data).toEqual(['new account']));
    await act(async () => resolveOld(['stale snapshot']));
    expect(result.current.data).toEqual(['new account']);
  });
});
