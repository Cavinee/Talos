import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useLiveData } from "./useLiveData";

describe("useLiveData", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns fallback while loading", () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    const { result } = renderHook(() =>
      useLiveData("/api/test", { items: [] }, 5000)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual({ items: [] });
  });

  it("returns data after fetch resolves", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [1, 2, 3] }),
    } as Response);

    const { result } = renderHook(() =>
      useLiveData("/api/test", { items: [] as number[] }, 5000)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() =>
      useLiveData("/api/test", { items: [] }, 5000)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network error");
  });

  it("polls at the given interval", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 2 }),
      } as Response);

    const { result } = renderHook(() =>
      useLiveData("/api/test", { count: 0 }, 1000)
    );

    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));

    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
  });
});
