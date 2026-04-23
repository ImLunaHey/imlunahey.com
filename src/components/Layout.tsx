import { Outlet, useLocation } from '@tanstack/react-router';
import CommandPalette from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { NavBar } from './NavBar';

export default function Layout() {
  const { pathname } = useLocation();
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
