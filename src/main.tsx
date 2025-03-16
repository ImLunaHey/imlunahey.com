import './App.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { cn } from './cn.ts';
import { RouterProvider, Routes } from './lib/router.tsx';
import { NotFoundPage } from './pages/NotFound.tsx';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Favicon } from './components/Favicon.tsx';
import React from 'react';

const queryClient = new QueryClient();

const HomePage = React.lazy(() => import('./pages/Home.tsx').then((module) => ({ default: module.HomePage })));
const ProjectsPage = React.lazy(() => import('./pages/Projects.tsx').then((module) => ({ default: module.ProjectsPage })));
const BlogPage = React.lazy(() => import('./pages/Blog.tsx').then((module) => ({ default: module.BlogPage })));
const BlogEntryPage = React.lazy(() =>
  import('./pages/BlogEntry.tsx').then((module) => ({ default: module.BlogEntryPage })),
);
const GalleryPage = React.lazy(() => import('./pages/Gallery.tsx').then((module) => ({ default: module.GalleryPage })));
const ContactPage = React.lazy(() => import('./pages/Contact.tsx').then((module) => ({ default: module.ContactPage })));
const ShowcasePage = React.lazy(() => import('./pages/Showcase.tsx').then((module) => ({ default: module.ShowcasePage })));

const routes = [
  { path: '/', component: HomePage, exact: true },
  { path: '/blog', component: BlogPage, exact: true },
  { path: '/blog/:id', component: BlogEntryPage },
  { path: '/projects', component: ProjectsPage },
  { path: '/gallery', component: GalleryPage },
  { path: '/contact', component: ContactPage },

  // non-nav routes
  { path: '/showcase', component: ShowcasePage },
];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <div
          className={cn(
            'absolute -z-10 inset-0 h-full w-full',
            'bg-[radial-gradient(circle,#73737350_1px,transparent_1px)]',
            'bg-[size:10px_10px]',
            'after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:to-black after:opacity-40',
            'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:to-black before:opacity-30',
          )}
        />
        <Favicon />
        <Routes routes={routes} notFound={NotFoundPage} />
      </RouterProvider>
      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>,
);
