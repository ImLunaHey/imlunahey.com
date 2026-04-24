import { createFileRoute } from '@tanstack/react-router';
import WhtwndPage from '../../../pages/labs/Whtwnd';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/whtwnd')({
  component: WhtwndPage,
  head: () => pageMeta('lab/whtwnd'),
});
