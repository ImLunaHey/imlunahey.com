import { createFileRoute } from '@tanstack/react-router';
import BskyCardsPage from '../../../pages/labs/BskyCards';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/bsky-cards')({
  component: BskyCardsPage,
  head: () => pageMeta('lab/bsky-cards'),
  validateSearch: (search: Record<string, unknown>) => ({
    handle: typeof search.handle === 'string' ? search.handle : undefined,
  }),
});
