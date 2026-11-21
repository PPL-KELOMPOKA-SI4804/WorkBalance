import { useEffect, useRef } from 'react';

/**
 * Silently triggers a refetch callback when the browser tab regains focus,
 * throttled to avoid redundant API requests.
 */
export function useRefetchOnFocus(callback, { minIntervalMs = 60000, enabled = true } = {}) {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(Date.now());

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const triggerIfStale = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) {
        return;
      }
      lastRunRef.current = now;
      callbackRef.current?.();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerIfStale();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', triggerIfStale);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', triggerIfStale);
    };
  }, [enabled, minIntervalMs]);
}
