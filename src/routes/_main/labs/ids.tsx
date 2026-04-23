import { createFileRoute } from '@tanstack/react-router';
import IdsPage from '../../../pages/labs/Ids';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/ids')({
  component: IdsPage,
  head: () => pageMeta('lab/ids'),
});
