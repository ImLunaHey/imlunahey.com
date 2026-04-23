import { createFileRoute } from '@tanstack/react-router';
import TflRoadsPage from '../../../pages/labs/TflRoads';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-roads')({
  component: TflRoadsPage,
  head: () => pageMeta('lab/tfl-roads'),
});
