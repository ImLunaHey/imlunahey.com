import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '../App.css';
import { Favicon } from '../components/Favicon';
import { QueryProvider } from '../components/QueryProvider';
import { DevTools } from '../components/DevTools';
import { SITE } from '../data';
import NotFoundPage from '../pages/NotFound';
import { ogMeta } from '../lib/og-meta';

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
