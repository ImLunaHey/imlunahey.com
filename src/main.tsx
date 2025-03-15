import './App.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { cn } from './cn.ts';
import { RouterProvider, Routes } from './lib/router.tsx';
import { HomePage } from './pages/Home.tsx';
import { NotFoundPage } from './pages/NotFound.tsx';
import { ContactPage } from './pages/Contact.tsx';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BlogPage } from './pages/Blog.tsx';
import { PhotosPage } from './pages/Photos.tsx';
import { BlogEntryPage } from './pages/BlogEntry.tsx';
import { Favicon } from './components/Favicon.tsx';
import { ProjectsPage } from './pages/Projects.tsx';

const queryClient = new QueryClient();

const routes = [
  { path: '/', component: HomePage, exact: true },
  { path: '/blog', component: BlogPage, exact: true },
  { path: '/blog/:id', component: BlogEntryPage },
  { path: '/contact', component: ContactPage },
  { path: '/projects', component: ProjectsPage },
  { path: '/photos', component: PhotosPage },
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
