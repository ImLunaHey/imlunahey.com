import { createFileRoute } from '@tanstack/react-router';
import PngChunksPage from '../../../pages/labs/PngChunks';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/png-chunks')({
  component: PngChunksPage,
  head: () => pageMeta('lab/png-chunks'),
});
