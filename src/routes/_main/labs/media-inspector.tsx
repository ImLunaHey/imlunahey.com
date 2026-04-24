import { createFileRoute } from '@tanstack/react-router';
import MediaInspectorPage from '../../../pages/labs/MediaInspector';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/media-inspector')({
  component: MediaInspectorPage,
  head: () => pageMeta('lab/media-inspector'),
});
