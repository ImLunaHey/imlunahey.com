import './App.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { cn } from './cn.ts';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Favicon } from './components/Favicon.tsx';
import React from 'react';
import { QueryProvider } from './components/QueryProvider.tsx';

const HomePage = React.lazy(() => import('./pages/Home.tsx'));
const ProjectsPage = React.lazy(() => import('./pages/Projects.tsx'));
const BlogPage = React.lazy(() => import('./pages/Blog.tsx'));
const BlogEntryPage = React.lazy(() => import('./pages/BlogEntry.tsx'));
const GalleryPage = React.lazy(() => import('./pages/Gallery.tsx'));
const ContactPage = React.lazy(() => import('./pages/Contact.tsx'));

const ShowcasePage = React.lazy(() => import('./pages/Showcase.tsx'));
const BlueskyToolsPage = React.lazy(() => import('./pages/BlueskyTools.tsx'));
const BlueskyToolsFeedPage = React.lazy(() => import('./pages/BlueskyTools/Feed.tsx'));
const PDFUploaderPage = React.lazy(() => import('./pages/BlueskyTools/PDFUploader.tsx'));
const ListCleanerPage = React.lazy(() => import('./pages/BlueskyTools/ListCleaner.tsx'));
const CARExplorerPage = React.lazy(() => import('./pages/BlueskyTools/CARExplorer.tsx'));

const WhiteWindPage = React.lazy(() => import('./pages/WhiteWind.tsx'));
const ReferrerCheckerPage = React.lazy(() => import('./pages/ReferrerChecker.tsx'));

const InfiniteCanvasPage = React.lazy(() => import('./pages/InfiniteCanvas.tsx'));

const MoviesPage = React.lazy(() => import('./pages/Movies.tsx'));
const ShowsPage = React.lazy(() => import('./pages/Shows.tsx'));
const NotFoundPage = React.lazy(() => import('./pages/NotFound.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <BrowserRouter>
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
        <Routes>
          <Route index element={<HomePage />} />

          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:rkey" element={<BlogEntryPage />} />

          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/gallery/:id?" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />

          <Route path="/showcase" element={<ShowcasePage />} />
          <Route path="/bluesky/tools" element={<BlueskyToolsPage />} />
          <Route path="/bluesky/tools/pdf-uploader" element={<PDFUploaderPage />} />
          <Route path="/bluesky/tools/feed/:id?" element={<BlueskyToolsFeedPage />} />
          <Route path="/bluesky/tools/list-cleaner" element={<ListCleanerPage />} />

          <Route path="/bluesky/tools/car-explorer" element={<CARExplorerPage />} />

          <Route path="/whitewind/:rkey?" element={<WhiteWindPage />} />
          <Route path="/referrer-checker" element={<ReferrerCheckerPage />} />

          <Route path="/infinite-canvas" element={<InfiniteCanvasPage />} />

          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/shows" element={<ShowsPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools />
    </QueryProvider>
  </StrictMode>,
);
