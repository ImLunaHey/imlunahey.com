import { createFileRoute } from '@tanstack/react-router';
import OgPreviewPage from '../../../pages/labs/OgPreview';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/og-preview')({
  component: OgPreviewPage,
  head: () => pageMeta('lab/og-preview'),
});
