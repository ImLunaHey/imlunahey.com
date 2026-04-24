import { createFileRoute } from '@tanstack/react-router';
import FrameExtractorPage from '../../../pages/labs/FrameExtractor';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/frame-extractor')({
  component: FrameExtractorPage,
  head: () => pageMeta('lab/frame-extractor'),
});
