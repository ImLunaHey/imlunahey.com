import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '../App.css';
import { cn } from '../cn';
import { Favicon } from '../components/Favicon';
import { QueryProvider } from '../components/QueryProvider';
import { DevTools } from '../components/DevTools';
import NotFoundPage from '../pages/NotFound';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'luna' },
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
        <div
          className={cn(
            'absolute inset-0 -z-20 size-full',
            'bg-[radial-gradient(circle,#73737350_1px,transparent_1px)]',
            'bg-[size:10px_10px]',
            'after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:to-black after:opacity-40',
            'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:to-black before:opacity-30',
          )}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-black opacity-40" />
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
