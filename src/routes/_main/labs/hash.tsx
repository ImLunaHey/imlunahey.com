import { createFileRoute } from '@tanstack/react-router';
import HashPage from '../../../pages/labs/Hash';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/hash')({
  component: HashPage,
  head: () => pageMeta('lab/hash'),
});
