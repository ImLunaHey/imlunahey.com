import { createFileRoute } from '@tanstack/react-router';
import WordlePage from '../../../pages/labs/Wordle';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/wordle')({
  component: WordlePage,
  head: () => pageMeta('lab/wordle'),
});
