import { createFileRoute } from '@tanstack/react-router';
import TidPage from '../../../pages/labs/Tid';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tid')({
  component: TidPage,
  head: () => pageMeta('lab/tid'),
});
