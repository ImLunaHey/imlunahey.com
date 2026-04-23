import { createFileRoute } from '@tanstack/react-router';
import LexiconValidatorPage from '../../../pages/labs/LexiconValidator';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/lexicon-validator')({
  component: LexiconValidatorPage,
  head: () => pageMeta('lab/lexicon-validator'),
  validateSearch: (search: Record<string, unknown>) => ({
    nsid: typeof search.nsid === 'string' ? search.nsid : undefined,
  }),
});
