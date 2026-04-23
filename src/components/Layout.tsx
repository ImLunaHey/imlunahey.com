import { Outlet, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import CommandPalette from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { NavBar } from './NavBar';
import { markSeen } from '../lib/lab-seen';

// matches /labs/{slug} exactly or /labs/{slug}/... (the `year-in-review/:handle/:year`
// style deep routes shouldn't mark the top-level slug — they're their own thing).
const LAB_PATH = /^\/labs\/([a-z0-9-]+)(?:\/|$)/;

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const m = LAB_PATH.exec(pathname);
    if (m) markSeen(m[1]);
  }, [pathname]);

  return (
    <>
      <NavBar />
      <CommandPalette />
      <ErrorBoundary
        key={pathname}
        fallback={
          <main style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ color: 'var(--color-fg-faint)', fontSize: 'var(--fs-xs)', marginBottom: 8 }}>// panic</div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 56,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--color-fg)',
                lineHeight: 1,
                marginBottom: 16,
              }}
            >
              something broke.
            </h1>
            <p style={{ color: 'var(--color-fg-dim)', fontSize: 'var(--fs-md)', marginBottom: 20 }}>
              this page hit an unexpected error. try refreshing or head{' '}
              <a href="/" style={{ color: 'var(--color-accent)' }}>
                home
              </a>
              .
            </p>
          </main>
        }
      >
        <Outlet />
      </ErrorBoundary>
    </>
  );
}
