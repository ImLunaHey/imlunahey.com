import { createFileRoute } from '@tanstack/react-router';
import IssPage from '../../../pages/labs/Iss';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/iss')({
  component: IssPage,
  head: () => pageMeta('lab/iss'),
});
