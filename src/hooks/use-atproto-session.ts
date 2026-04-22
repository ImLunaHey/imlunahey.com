import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@atcute/oauth-browser-client';
import { ensureOAuthConfigured, getCurrentSession } from '../lib/oauth';

/**
 * Reactive wrapper around the atcute oauth-browser-client session store.
 * Sessions are persisted to localStorage by atcute under the `imlunahey-oauth`
 * prefix (see `storageName` in lib/oauth.ts).
 */

/** Cheap sync check — do we have any atcute-oauth keys in localStorage? */
function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('imlunahey-oauth')) return true;
    }
  } catch {
    /* localStorage might be unavailable (sandboxed iframe) */
  }
  return false;
}

export function useAtprotoSession() {
  const [session, setSession] = useState<Session | null>(null);
  // Only start in a loading state if there's *something* in storage worth
  // checking. For a first-time visitor, skip straight to "signed out" so
  // they don't see a flash of "checking session…" that's meaningless.
  const [loading, setLoading] = useState<boolean>(() => hasStoredSession());

  const refresh = useCallback(async () => {
    if (!hasStoredSession()) {
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    ensureOAuthConfigured();
    const s = await getCurrentSession();
    setSession(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, loading, refresh };
}
