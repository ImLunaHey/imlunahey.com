import { createFileRoute } from '@tanstack/react-router';
import HomelabPage from '../../pages/Homelab';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/homelab')({
  component: HomelabPage,
  head: () => pageMeta('homelab'),
});
