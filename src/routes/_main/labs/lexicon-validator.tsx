import { createFileRoute } from '@tanstack/react-router';
import LexiconValidatorPage from '../../../pages/labs/LexiconValidator';

export const Route = createFileRoute('/_main/labs/lexicon-validator')({
  component: LexiconValidatorPage,
  validateSearch: (search: Record<string, unknown>) => ({
    nsid: typeof search.nsid === 'string' ? search.nsid : undefined,
  }),
});
