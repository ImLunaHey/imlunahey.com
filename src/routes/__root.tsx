import { lazy, type ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '../App.css';
import { Favicon } from '../components/Favicon';
import { QueryProvider } from '../components/QueryProvider';
import { SITE } from '../data';
import NotFoundPage from '../pages/NotFound';
import { ogMeta } from '../lib/og-meta';
import { CRITICAL_CSS } from '../lib/critical-css';

// Font URLs resolved by vite at build time — each \`?url\` import
// becomes a hashed asset path identical to the one referenced by the
// bundled @font-face rule, so the preload below matches and the
// browser doesn't double-fetch. Only the latin subsets are preloaded
// — latin-ext / cyrillic / greek lazy-load on demand via unicode-range.
import dotoLatinUrl from '@fontsource-variable/doto/files/doto-latin-wght-normal.woff2?url';
import jetbrainsLatinUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';

// Dev-only: react-query devtools + the debug-mode bug toggle. The
// lazy import + the `DEV` guard together guarantee the entire
// DevTools module (and @tanstack/react-query-devtools) is tree-shaken
// out of the production bundle — zero bytes shipped to visitors.
const DevTools = import.meta.env.DEV
  ? lazy(() => import('../components/DevTools').then((m) => ({ default: m.DevTools })))
  : null;

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
      // Preload the critical-path fonts so their download runs in
      // parallel with the main stylesheet instead of starting only
      // after the CSS parser discovers the @font-face rules. Cuts
      // the critical-path waterfall by one full RTT on cold loads.
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href: dotoLatinUrl },
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href: jetbrainsLatinUrl },
      // Feed-reader autodiscovery — crawlers and rss readers find /rss.xml
      // without anyone having to remember the exact path.
      { rel: 'alternate', type: 'application/rss+xml', title: 'luna · writing', href: '/rss.xml' },
      // humanstxt.org convention — pairs with the file at /humans.txt.
      { rel: 'author', href: '/humans.txt' },
      // webmention.io endpoints — other indieweb sites can notify this
      // domain of replies/likes/reposts pointing at any of its pages.
      // pingback is the legacy xmlrpc equivalent, kept for broader
      // client compatibility (wordpress etc).
      { rel: 'webmention', href: 'https://webmention.io/imlunahey.com/webmention' },
      { rel: 'pingback', href: 'https://webmention.io/imlunahey.com/xmlrpc' },
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
        {DevTools ? <DevTools /> : null}
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
