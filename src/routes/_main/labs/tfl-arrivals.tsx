import { createFileRoute } from '@tanstack/react-router';
import TflArrivalsPage from '../../../pages/labs/TflArrivals';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-arrivals')({
  component: TflArrivalsPage,
  head: () => pageMeta('lab/tfl-arrivals'),
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : undefined,
    name: typeof search.name === 'string' ? search.name : undefined,
  }),
});
