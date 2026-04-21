import { createFileRoute } from '@tanstack/react-router';
import VerseRevealPage from '../../../pages/labs/VerseReveal';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/verse-reveal')({
  component: VerseRevealPage,
  head: () => pageMeta('lab/verse-reveal'),
});
