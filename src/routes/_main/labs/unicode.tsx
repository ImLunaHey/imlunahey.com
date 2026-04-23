import { createFileRoute } from '@tanstack/react-router';
import UnicodePage from '../../../pages/labs/Unicode';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/unicode')({
  component: UnicodePage,
  head: () => pageMeta('lab/unicode'),
});
