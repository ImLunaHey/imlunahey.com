import { createFileRoute } from '@tanstack/react-router';
import ReplyRatioPage from '../../../pages/labs/ReplyRatio';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/reply-ratio')({
  component: ReplyRatioPage,
  head: () => pageMeta('lab/reply-ratio'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
