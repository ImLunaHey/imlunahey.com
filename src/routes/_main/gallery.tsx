import { createFileRoute } from '@tanstack/react-router';
import GalleryPage from '../../pages/Gallery';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/gallery')({
  component: GalleryPage,
  head: () => pageMeta('gallery'),
});
