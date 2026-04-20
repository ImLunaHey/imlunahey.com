import { createFileRoute } from '@tanstack/react-router';
import GalleryPage from '../../pages/Gallery';

export const Route = createFileRoute('/gallery/$id')({
  component: GalleryPage,
});
