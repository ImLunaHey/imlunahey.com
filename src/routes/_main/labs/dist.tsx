import { createFileRoute } from '@tanstack/react-router';
import DistPage from '../../../pages/labs/Dist';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/dist')({
  component: DistPage,
  head: () => pageMeta('lab/dist'),
});
