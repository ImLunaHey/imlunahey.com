import { createFileRoute } from '@tanstack/react-router';
import GalleryPage from '../../pages/Gallery';

export const Route = createFileRoute('/_main/gallery')({
  component: GalleryPage,
});
