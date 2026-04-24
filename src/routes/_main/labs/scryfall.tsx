import { createFileRoute } from '@tanstack/react-router';
import ScryfallPage from '../../../pages/labs/Scryfall';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/scryfall')({
  component: ScryfallPage,
  head: () => pageMeta('lab/scryfall'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
