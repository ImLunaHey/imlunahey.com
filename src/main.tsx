import './App.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { cn } from './cn.ts';
import { Routes } from './lib/router/Routes.tsx';
import { RouterProvider } from './lib/router/RouterProvider.tsx';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Favicon } from './components/Favicon.tsx';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // mark the data as stale after 5 minutes
      staleTime: 1_000 * 60 * 5,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 1_000,
  key: 'cache',
});

const HomePage = React.lazy(() => import('./pages/Home.tsx'));
const ProjectsPage = React.lazy(() => import('./pages/Projects.tsx'));
const BlogPage = React.lazy(() => import('./pages/Blog.tsx'));
const BlogEntryPage = React.lazy(() => import('./pages/BlogEntry.tsx'));
const GalleryPage = React.lazy(() => import('./pages/Gallery.tsx'));
const ContactPage = React.lazy(() => import('./pages/Contact.tsx'));

const NotFoundPage = React.lazy(() => import('./pages/NotFound.tsx'));

const ShowcasePage = React.lazy(() => import('./pages/Showcase.tsx'));
const BlueskyToolsPage = React.lazy(() => import('./pages/BlueskyTools.tsx'));
const BlueskyToolsFeedPage = React.lazy(() => import('./pages/BlueskyTools/Feed.tsx'));
const PDFUploaderPage = React.lazy(() => import('./pages/BlueskyTools/PDFUploader.tsx'));
const WhiteWindPage = React.lazy(() => import('./pages/WhiteWind.tsx'));
const ReferrerCheckerPage = React.lazy(() => import('./pages/ReferrerChecker.tsx'));

const routes = [
  { path: '/', component: HomePage, exact: true },
  { path: '/blog', component: BlogPage, exact: true },
  { path: '/blog/:id', component: BlogEntryPage },
  { path: '/projects', component: ProjectsPage },
  { path: '/gallery/:id?', component: GalleryPage },
  { path: '/contact', component: ContactPage },

  // non-nav routes
  { path: '/showcase', component: ShowcasePage },
  { path: '/bluesky/tools', component: BlueskyToolsPage },
  { path: '/bluesky/tools/pdf-uploader', component: PDFUploaderPage },
  { path: '/bluesky/tools/feed/:id?', component: BlueskyToolsFeedPage },
  { path: '/whitewind/:id?', component: WhiteWindPage },
  { path: '/referrer-checker', component: ReferrerCheckerPage },
  // not found
  { path: '*', component: NotFoundPage },
];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1_000 * 60 * 60 * 24,
      }}
      onSuccess={() => {
        console.log('Cache successfully restored!');
        queryClient.resumePausedMutations();
      }}
    >
      <RouterProvider>
        <div
          className={cn(
            'absolute -z-10 inset-0 size-full',
            'bg-[radial-gradient(circle,#73737350_1px,transparent_1px)]',
            'bg-[size:10px_10px]',
            'after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:to-black after:opacity-40',
            'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:to-black before:opacity-30',
          )}
        />
        <Favicon />
        <Routes routes={routes} />
      </RouterProvider>
      <ReactQueryDevtools />
    </PersistQueryClientProvider>
  </StrictMode>,
);
