import { createFileRoute } from '@tanstack/react-router';
import CurlPage from '../../../pages/labs/Curl';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/curl')({
  component: CurlPage,
  head: () => pageMeta('lab/curl'),
});
