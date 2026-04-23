import { createFileRoute } from '@tanstack/react-router';
import CertsPage from '../../../pages/labs/Certs';

export const Route = createFileRoute('/_main/labs/certs')({
  component: CertsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    domain: typeof search.domain === 'string' ? search.domain : undefined,
  }),
});
