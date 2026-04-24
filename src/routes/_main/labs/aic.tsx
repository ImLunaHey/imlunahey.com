import { createFileRoute } from '@tanstack/react-router';
import ArtInstitutePage from '../../../pages/labs/ArtInstitute';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/aic')({
  component: ArtInstitutePage,
  head: () => pageMeta('lab/aic'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
