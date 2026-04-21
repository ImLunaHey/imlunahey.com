import { createFileRoute } from '@tanstack/react-router';
import WatchingPage from '../../../pages/Watching';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/watching/')({
  component: WatchingPage,
  head: () => pageMeta('watching'),
});
