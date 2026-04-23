import { createFileRoute } from '@tanstack/react-router';
import DnsPage from '../../../pages/labs/Dns';

export const Route = createFileRoute('/_main/labs/dns')({
  component: DnsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === 'string' ? search.name : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
  }),
});
