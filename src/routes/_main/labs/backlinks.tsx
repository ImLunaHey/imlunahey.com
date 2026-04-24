import { createFileRoute } from '@tanstack/react-router';
import BacklinksPage from '../../../pages/labs/Backlinks';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/backlinks')({
  component: BacklinksPage,
  head: () => pageMeta('lab/backlinks'),
  validateSearch: (search: Record<string, unknown>) => ({
    // paste an at-uri, did, or http url; url-backed so a search is shareable.
    q: typeof search.q === 'string' ? search.q : undefined,
    // which preset was selected (see PRESETS in the page).
    p: typeof search.p === 'string' ? search.p : undefined,
  }),
});
