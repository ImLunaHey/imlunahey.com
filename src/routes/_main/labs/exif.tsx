import { createFileRoute } from '@tanstack/react-router';
import ExifPage from '../../../pages/labs/Exif';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/exif')({
  component: ExifPage,
  head: () => pageMeta('lab/exif'),
});
