import { createFileRoute } from '@tanstack/react-router';
import ClipperPage from '../../../pages/labs/Clipper';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/clipper')({
  component: ClipperPage,
  head: () => pageMeta('lab/clipper'),
});
