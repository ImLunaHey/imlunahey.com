import { createFileRoute } from '@tanstack/react-router';
import GalleryPage from '../../pages/Gallery';
import { getGallery } from '../../server/gallery';
import { TTL } from '../../server/cache';

export const Route = createFileRoute('/_main/gallery')({
  component: GalleryPage,
  loader: () => ({ gallery: getGallery() }),
  staleTime: TTL.medium,
});
