import { createFileRoute } from '@tanstack/react-router';
import TflAirPage from '../../../pages/labs/TflAir';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-air')({
  component: TflAirPage,
  head: () => pageMeta('lab/tfl-air'),
});
