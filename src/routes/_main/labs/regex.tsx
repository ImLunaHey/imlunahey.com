import { createFileRoute } from '@tanstack/react-router';
import RegexPage from '../../../pages/labs/Regex';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/regex')({
  component: RegexPage,
  head: () => pageMeta('lab/regex'),
});
