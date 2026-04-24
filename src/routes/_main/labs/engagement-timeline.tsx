import { createFileRoute } from '@tanstack/react-router';
import EngagementTimelinePage from '../../../pages/labs/EngagementTimeline';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/engagement-timeline')({
  component: EngagementTimelinePage,
  head: () => pageMeta('lab/engagement-timeline'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
