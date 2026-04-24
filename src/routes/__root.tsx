import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '../App.css';
import { Favicon } from '../components/Favicon';
import { QueryProvider } from '../components/QueryProvider';
import { DevTools } from '../components/DevTools';
import { SITE } from '../data';
import NotFoundPage from '../pages/NotFound';
import { ogMeta } from '../lib/og-meta';
import { CRITICAL_CSS } from '../lib/critical-css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'luna' },
      { name: 'description', content: `${SITE.name} · software engineer in ${SITE.location}.` },
      ...ogMeta({
        slug: 'home',
        title: 'luna',
        description: `${SITE.name} · software engineer in ${SITE.location}.`,
        url: `https://${SITE.domain}`,
      }),
    ],
    // NB: no canonical <link> here. The root match contributes to every
    // nested route, so emitting it from __root would render two competing
    // canonicals on child pages (root's "/" and the child's own). The "/"
    // canonical lives on the /_main/ index route instead.
    //
    // Preconnect to plausible so DNS + TCP + TLS run in parallel with the
    // rest of the page render. The analytics script is `defer`'d, but the
    // handshake to a third-party origin still has to happen eventually —
    // this just starts it earlier. Typical mobile FCP win: ~150ms.
    links: [
      { rel: 'preconnect', href: 'https://plausible.io', crossorigin: 'anonymous' },
      { rel: 'dns-prefetch', href: 'https://plausible.io' },
    ],
    // Inline the critical above-the-fold CSS so first paint doesn't wait
    // for the external stylesheet. Tokens + nav + CRT overlay cover every
    // visible pixel on first render; the rest of App.css still loads via
    // <link rel="stylesheet"> and takes over as soon as it arrives.
    styles: [{ children: CRITICAL_CSS }],
    scripts: [
      {
        defer: true,
        src: 'https://plausible.io/js/script.outbound-links.js',
        'data-domain': 'imlunahey.com',
      } as { src: string; defer: boolean },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <RootDocument>
      <QueryProvider>
        <div className="crt" />
        <div className="noise" />
        <Favicon />
        <Outlet />
        <DevTools />
      </QueryProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
