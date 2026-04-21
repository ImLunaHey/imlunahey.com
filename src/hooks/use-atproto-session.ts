import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@atcute/oauth-browser-client';
import { ensureOAuthConfigured, getCurrentSession } from '../lib/oauth';

/**
 * Reactive wrapper around the atcute oauth-browser-client session store.
 * Sessions are persisted to localStorage by atcute; we just read/refresh
 * them and expose a loading/authed state.
 */
export function useAtprotoSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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
