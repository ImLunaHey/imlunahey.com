import { createFileRoute } from '@tanstack/react-router';
import PdsHealthPage from '../../../pages/labs/PdsHealth';

export const Route = createFileRoute('/_main/labs/pds-health')({
  component: PdsHealthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === 'string' ? search.url : undefined,
  }),
});
