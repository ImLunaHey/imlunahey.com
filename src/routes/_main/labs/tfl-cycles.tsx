import { createFileRoute } from '@tanstack/react-router';
import TflCyclesPage from '../../../pages/labs/TflCycles';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-cycles')({
  component: TflCyclesPage,
  head: () => pageMeta('lab/tfl-cycles'),
});
