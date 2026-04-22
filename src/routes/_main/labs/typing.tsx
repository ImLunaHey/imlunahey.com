import { createFileRoute } from '@tanstack/react-router';
import TypingPage from '../../../pages/labs/Typing';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/typing')({
  component: TypingPage,
  head: () => pageMeta('lab/typing'),
});
