import { createFileRoute } from '@tanstack/react-router';
import UnitsPage from '../../../pages/labs/Units';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/units')({
  component: UnitsPage,
  head: () => pageMeta('lab/units'),
});
