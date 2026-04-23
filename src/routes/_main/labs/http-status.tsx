import { createFileRoute } from '@tanstack/react-router';
import HttpStatusPage from '../../../pages/labs/HttpStatus';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/http-status')({
  component: HttpStatusPage,
  head: () => pageMeta('lab/http-status'),
});
