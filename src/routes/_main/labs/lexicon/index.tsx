import { createFileRoute } from '@tanstack/react-router';
import LexiconPage from '../../../../pages/labs/Lexicon';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/lexicon/')({
  component: LexiconPage,
  head: () => pageMeta('lab/lexicon'),
});
