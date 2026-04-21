import { createFileRoute } from '@tanstack/react-router';
import CarExplorerPage from '../../../../pages/labs/CarExplorer';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/car-explorer/')({
  component: CarExplorerPage,
  head: () => pageMeta('lab/car-explorer'),
});
