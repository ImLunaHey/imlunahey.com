import { createFileRoute } from '@tanstack/react-router';
import SnakePage from '../../../pages/labs/Snake';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/snake')({
  component: SnakePage,
  head: () => pageMeta('lab/snake'),
});
