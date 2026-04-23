import { createFileRoute } from '@tanstack/react-router';
import SubnetPage from '../../../pages/labs/Subnet';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/subnet')({
  component: SubnetPage,
  head: () => pageMeta('lab/subnet'),
});
