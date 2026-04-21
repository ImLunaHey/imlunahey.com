import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { finalizeAuthorization } from '@atcute/oauth-browser-client';
import { ensureOAuthConfigured } from '../../lib/oauth';

/**
 * OAuth return page. The PDS redirects here with the `code` + `state` in
 * the url fragment (per the spec's `response_mode=fragment`). We finalize
 * the exchange — which stores the session in localStorage — then bounce
 * back to wherever the user started (default: /guestbook).
 */
export const Route = createFileRoute('/oauth/callback')({
  component: OauthCallback,
});

function OauthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // react strict-mode in dev runs effects twice. the first call consumes
  // the stored state; the second sees it gone and throws "unknown state".
  // a module-level ref guards against that and against any other accidental
  // double-execution (remounts, hot reload).
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    ensureOAuthConfigured();
    // the spec uses fragment (#) for response_mode. URLSearchParams only
    // reads search, so parse the hash ourselves.
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash || window.location.search);

    finalizeAuthorization(params)
      .then(() => {
        navigate({ to: '/guestbook' as never, replace: true });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      });
  }, [navigate]);

  return (
    <main className="oauth-cb">
      <style>{`
        .oauth-cb {
          min-height: 50vh;
          display: flex; align-items: center; justify-content: center;
          padding: var(--sp-10);
          font-family: var(--font-mono);
          font-size: var(--fs-sm);
          color: var(--color-fg-faint);
        }
        .oauth-cb .err { color: var(--color-alert); max-width: 60ch; }
      `}</style>
      {error ? (
        <div className="err">
          sign-in failed: {error}
        </div>
      ) : (
        <div>finalising sign-in…</div>
      )}
    </main>
  );
}
