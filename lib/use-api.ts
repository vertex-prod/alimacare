"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet, ApiClientError } from "./client-api";

interface UseApiOptions {
  refreshMs?: number;
  enabled?: boolean;
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  /** The path whose request most recently finished. */
  settledPath: string | null;
}

/**
 * Fetch a JSON admin endpoint, optionally polling it. Previous data stays on
 * screen while a new path loads, so filters and refreshes do not flash.
 */
export function useApi<T>(path: string | null, options: UseApiOptions = {}) {
  const { refreshMs = 0, enabled = true } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    settledPath: null,
  });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!path || !enabled) return;

    let active = true;

    const load = async () => {
      try {
        const result = await apiGet<T>(path);

        if (active) setState({ data: result, error: null, settledPath: path });
      } catch (caught) {
        if (!active) return;

        const message =
          caught instanceof ApiClientError || caught instanceof Error
            ? caught.message
            : "Could not load this page.";

        setState((current) => ({ ...current, error: message, settledPath: path }));
      }
    };

    void load();

    const timer =
      refreshMs > 0 ? window.setInterval(() => void load(), refreshMs) : null;

    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [path, enabled, refreshMs, version]);

  const loading = Boolean(path && enabled) && state.settledPath !== path;

  return { data: state.data, error: state.error, loading, reload };
}
