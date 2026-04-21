import { createFileRoute } from '@tanstack/react-router';
import ScreenshotMakerPage from '../../../pages/labs/ScreenshotMaker';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/screenshot-maker')({
  component: ScreenshotMakerPage,
  head: () => pageMeta('lab/screenshot-maker'),
});
