import { createFileRoute } from '@tanstack/react-router';
import UaPage from '../../../pages/labs/Ua';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/ua')({
  component: UaPage,
  head: () => pageMeta('lab/ua'),
});
