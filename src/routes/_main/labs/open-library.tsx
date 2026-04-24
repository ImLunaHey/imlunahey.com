import { createFileRoute } from '@tanstack/react-router';
import OpenLibraryPage from '../../../pages/labs/OpenLibrary';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/open-library')({
  component: OpenLibraryPage,
  head: () => pageMeta('lab/open-library'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
