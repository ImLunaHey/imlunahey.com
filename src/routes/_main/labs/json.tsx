import { createFileRoute } from '@tanstack/react-router';
import JsonPage from '../../../pages/labs/Json';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/json')({
  component: JsonPage,
  head: () => pageMeta('lab/json'),
});
