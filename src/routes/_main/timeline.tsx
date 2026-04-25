import { createFileRoute } from '@tanstack/react-router';
import TimelinePage from '../../pages/Timeline';
import { pageMeta } from '../../lib/og-meta';
import { getTimelineEvents } from '../../server/timeline';

export const Route = createFileRoute('/_main/timeline')({
  loader: () => getTimelineEvents(),
  component: TimelinePage,
  head: () => pageMeta('timeline'),
});
