import { createFileRoute } from '@tanstack/react-router';
import HttpHeadersPage from '../../../pages/labs/HttpHeaders';

export const Route = createFileRoute('/_main/labs/http-headers')({
  component: HttpHeadersPage,
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === 'string' ? search.url : undefined,
    method: search.method === 'GET' || search.method === 'HEAD' ? search.method : undefined,
  }),
});
