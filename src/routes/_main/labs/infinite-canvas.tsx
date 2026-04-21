import { createFileRoute } from '@tanstack/react-router';
import InfiniteCanvasPage from '../../../pages/labs/InfiniteCanvas';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/infinite-canvas')({
  component: InfiniteCanvasPage,
  head: () => pageMeta('lab/infinite-canvas'),
});
